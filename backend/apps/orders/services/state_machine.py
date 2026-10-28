"""Order lifecycle. Only the transitions listed here can happen; everything else is refused (409).

pending_payment ─paid─▶ placed ─▶ confirmed ─▶ packed ─▶ shipped ─▶ out_for_delivery ─▶ delivered
      │                   │           │           │
      └─▶ payment_failed  └───────────┴───────────┴──▶ cancelled   (customer: placed/confirmed; staff: up to packed)
             └─(retry)─▶ pending_payment
"""

import logging
from dataclasses import dataclass

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.catalog.models import Product, StockMovement
from apps.catalog.services.stock import adjust_stock
from apps.core.exceptions import ConflictError, DomainError
from apps.offers.models import Coupon, CouponRedemption, FlashSaleItem
from apps.orders.models import Order, OrderStatus, OrderStatusEvent, PaymentStatus

logger = logging.getLogger(__name__)

SYSTEM, CUSTOMER, STAFF = "system", "customer", "staff"
S = OrderStatus


@dataclass(frozen=True)
class Rule:
    actors: tuple[str, ...]


TRANSITIONS: dict[str, dict[str, Rule]] = {
    S.PENDING_PAYMENT: {
        S.PLACED: Rule((SYSTEM,)),
        S.PAYMENT_FAILED: Rule((SYSTEM,)),
        S.CANCELLED: Rule((CUSTOMER, STAFF)),
    },
    S.PAYMENT_FAILED: {
        S.PENDING_PAYMENT: Rule((CUSTOMER, SYSTEM)),
        S.PLACED: Rule((SYSTEM,)),
        S.CANCELLED: Rule((CUSTOMER, STAFF, SYSTEM)),
    },
    S.PLACED: {S.CONFIRMED: Rule((STAFF,)), S.CANCELLED: Rule((CUSTOMER, STAFF))},
    S.CONFIRMED: {S.PACKED: Rule((STAFF,)), S.CANCELLED: Rule((CUSTOMER, STAFF))},
    S.PACKED: {S.SHIPPED: Rule((STAFF,)), S.CANCELLED: Rule((STAFF,))},
    S.SHIPPED: {S.OUT_FOR_DELIVERY: Rule((STAFF,)), S.DELIVERED: Rule((STAFF,))},
    S.OUT_FOR_DELIVERY: {S.DELIVERED: Rule((STAFF,))},
    S.DELIVERED: {},
    S.CANCELLED: {},
}

#: Statuses from which stock is currently held for the order.
STOCK_HELD = {S.PENDING_PAYMENT, S.PLACED, S.CONFIRMED, S.PACKED}
#: Statuses that send the customer an email.
NOTIFY = {
    S.PLACED,
    S.CONFIRMED,
    S.PACKED,
    S.SHIPPED,
    S.OUT_FOR_DELIVERY,
    S.DELIVERED,
    S.CANCELLED,
    S.PAYMENT_FAILED,
}


def allowed_transitions(order: Order, actor: str) -> list[str]:
    return [to for to, rule in TRANSITIONS.get(order.status, {}).items() if actor in rule.actors]


def can_customer_cancel(order: Order) -> bool:
    return S.CANCELLED in allowed_transitions(order, CUSTOMER)


def release_stock(order: Order, reason: str) -> None:
    for item in order.items.select_related("variant"):
        if item.variant_id:
            adjust_stock(item.variant_id, item.quantity, reason, reference=order.number)
        if item.flash_sale_item_id:
            FlashSaleItem.objects.filter(pk=item.flash_sale_item_id, sold_count__gte=item.quantity).update(
                sold_count=F("sold_count") - item.quantity
            )


def reserve_stock(order: Order) -> None:
    """Re-take stock for an order whose reservation lapsed (payment retried or captured late)."""
    for item in order.items.select_related("variant").order_by("variant_id"):
        if item.variant_id:
            adjust_stock(item.variant_id, -item.quantity, StockMovement.Reason.ORDER_RESERVED, reference=order.number)


def release_coupon(order: Order) -> None:
    redemption = CouponRedemption.objects.filter(order=order).first()
    if redemption:
        Coupon.objects.filter(pk=redemption.coupon_id, times_used__gt=0).update(times_used=F("times_used") - 1)
        redemption.delete()


@transaction.atomic
def transition(order: Order, to: str, *, actor_type: str, actor=None, note: str = "") -> Order:
    order = Order.objects.select_for_update().get(pk=order.pk)
    rule = TRANSITIONS.get(order.status, {}).get(to)
    if rule is None:
        raise ConflictError(
            f"An order that is {order.get_status_display().lower()} can't move to {OrderStatus(to).label.lower()}.",
            code="invalid_transition",
            extra={"status": order.status, "allowed": allowed_transitions(order, actor_type)},
        )
    if actor_type not in rule.actors:
        raise DomainError("You're not able to make this change to the order.", code="transition_not_permitted")
    if to == S.SHIPPED and not (order.courier_name and order.tracking_number):
        raise DomainError(
            "Add the courier and tracking number before marking the order shipped.", code="tracking_required"
        )

    previous = order.status
    now = timezone.now()
    order.status = to
    fields = ["status", "updated_at"]

    if to == S.PLACED:
        order.placed_at = order.placed_at or now
        order.reservation_expires_at = None
        fields += ["placed_at", "reservation_expires_at"]
        if previous == S.PAYMENT_FAILED:
            reserve_stock(order)  # late capture after the reservation lapsed
        _count_sales(order, +1)
    elif to == S.PENDING_PAYMENT:  # retry after failure
        reserve_stock(order)
    elif to == S.PAYMENT_FAILED:
        order.payment_status = PaymentStatus.FAILED
        fields.append("payment_status")
        release_stock(order, StockMovement.Reason.ORDER_RELEASED)
        release_coupon(order)
    elif to == S.CANCELLED:
        order.cancelled_at = now
        order.cancel_reason = note[:300]
        fields += ["cancelled_at", "cancel_reason"]
        if previous in STOCK_HELD:
            release_stock(order, StockMovement.Reason.CANCELLED)
        release_coupon(order)
        if previous not in (S.PENDING_PAYMENT, S.PAYMENT_FAILED):
            _count_sales(order, -1)
        if order.payment_status == PaymentStatus.PAID:
            _refund_in_full(order, reason=f"Order {order.number} cancelled")
    elif to == S.DELIVERED:
        order.delivered_at = now
        fields.append("delivered_at")
        if order.payment_method == "cod":
            order.payment_status = PaymentStatus.PAID
            fields.append("payment_status")
            order.payments.filter(provider="cod").update(status="captured")

    order.save(update_fields=fields)
    OrderStatusEvent.objects.create(order=order, from_status=previous, to_status=to, note=note[:300], actor=actor)

    if to in NOTIFY:
        from .notifications import notify_status_change

        order_id = order.pk
        transaction.on_commit(lambda: notify_status_change.delay(order_id, to))
    return order


def _count_sales(order: Order, sign: int) -> None:
    for item in order.items.all():
        if item.product_id_snapshot:
            Product.objects.filter(pk=item.product_id_snapshot).update(
                sales_count=F("sales_count") + sign * item.quantity
            )


def _refund_in_full(order: Order, *, reason: str) -> None:
    from apps.payments.providers import ProviderError, get_provider

    payment = order.payments.filter(status="captured").first()
    if payment is None:
        return
    amount = payment.amount_paise - payment.refunded_paise
    if amount <= 0:
        return
    try:
        get_provider(payment.provider).refund(payment, amount, reason=reason)
    except ProviderError:
        # The refund row records the failure; staff can retry from the admin.
        logger.warning("Automatic refund failed for %s", order.number)
        return
    payment.status = "refunded"
    payment.save(update_fields=["status"])
    order.payment_status = PaymentStatus.REFUNDED
    order.save(update_fields=["payment_status"])
