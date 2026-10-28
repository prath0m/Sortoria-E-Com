"""Returns and replacements: eligibility, requests, and the return lifecycle.

requested ─▶ approved ─▶ pickup_scheduled ─▶ received ─▶ refunded | replaced
    └──────▶ rejected                            └──────▶ rejected (failed inspection)
"""

from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.catalog.models import Product, ReturnPolicy, StockMovement
from apps.catalog.services.stock import adjust_stock
from apps.core.emails import send_email
from apps.core.exceptions import ConflictError, DomainError
from apps.core.images import reencode_upload, validate_image_file
from apps.core.models import AdminNotification, StoreSettings
from apps.core.money import allocate, rupees
from apps.orders.models import (
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    ReturnItem,
    ReturnPhoto,
    ReturnRequest,
    ReturnStatus,
    ReturnStatusEvent,
)

from .numbering import next_return_number
from .presentation import order_url

R = ReturnStatus
FAULT_REASONS = {ReturnRequest.Reason.DAMAGED, ReturnRequest.Reason.DEFECTIVE, ReturnRequest.Reason.NOT_AS_DESCRIBED}
MAX_PHOTOS = 5

TRANSITIONS = {
    R.REQUESTED: {R.APPROVED, R.REJECTED},
    R.APPROVED: {R.PICKUP_SCHEDULED, R.REJECTED},
    R.PICKUP_SCHEDULED: {R.RECEIVED},
    R.RECEIVED: {R.REFUNDED, R.REPLACED, R.REJECTED},
    R.REFUNDED: set(),
    R.REPLACED: set(),
    R.REJECTED: set(),
}

COPY = {
    R.REQUESTED: ("Return requested", "We've received your request and will review it within one working day."),
    R.APPROVED: ("Return approved", "Your return is approved. We'll arrange a pickup from your delivery address."),
    R.REJECTED: ("Return update", "We weren't able to accept this return. Our note below explains why."),
    R.PICKUP_SCHEDULED: ("Pickup scheduled", "Our courier partner will collect the parcel on the date below. Please keep it packed and ready."),
    R.RECEIVED: ("Return received", "Your parcel has reached our studio and is being inspected."),
    R.REFUNDED: ("Refund issued", "Your refund has been issued. Banks usually take 5–7 working days to show it."),
    R.REPLACED: ("Replacement on its way", "Your replacement has been dispatched. You'll receive tracking details separately."),
}


@dataclass
class ItemEligibility:
    item: OrderItem
    returnable_quantity: int
    policy: str
    window_days: int
    eligible: bool
    reason: str


def _terms(item: OrderItem) -> tuple[str, int]:
    product = Product.objects.select_related("category").filter(pk=item.product_id_snapshot).first()
    if product is None:
        return ReturnPolicy.RETURNABLE, StoreSettings.load().return_window_days
    return product.return_terms()


def eligibility(order: Order) -> list[ItemEligibility]:
    open_quantities: dict[int, int] = {}
    for ri in ReturnItem.objects.filter(return_request__order=order).exclude(return_request__status=R.REJECTED):
        open_quantities[ri.order_item_id] = open_quantities.get(ri.order_item_id, 0) + ri.quantity
    result = []
    for item in order.items.all():
        policy, window = _terms(item)
        remaining = item.quantity - open_quantities.get(item.pk, 0)
        eligible, reason = True, ""
        if order.status != OrderStatus.DELIVERED or not order.delivered_at:
            eligible, reason = False, "Returns open once your order is delivered."
        elif timezone.now() > order.delivered_at + timedelta(days=window):
            eligible, reason = False, f"The {window}-day return window has closed."
        elif remaining <= 0:
            eligible, reason = False, "Already being returned."
        elif policy == ReturnPolicy.NON_RETURNABLE:
            reason = "Returnable only if it arrived damaged or faulty."
        result.append(ItemEligibility(item, max(remaining, 0), policy, window, eligible, reason))
    return result


@transaction.atomic
def request_return(
    order: Order,
    *,
    items: list[dict],
    reason: str,
    comments: str = "",
    refund_upi_id: str = "",
    photos=(),
    user=None,
) -> ReturnRequest:
    order = Order.objects.select_for_update().get(pk=order.pk)
    by_id = {e.item.pk: e for e in eligibility(order)}
    chosen = [(by_id.get(int(i["order_item_id"])), int(i["quantity"])) for i in items if int(i.get("quantity", 0)) > 0]
    if not chosen:
        raise DomainError("Choose at least one piece to return.", code="no_items")
    photos = list(photos)
    if len(photos) > MAX_PHOTOS:
        raise DomainError(f"Please add up to {MAX_PHOTOS} photos.", code="too_many_photos")
    needs_photos = reason in FAULT_REASONS
    resolution = ReturnRequest.Resolution.REFUND
    for entry, quantity in chosen:
        if entry is None or not entry.eligible:
            raise DomainError(entry.reason if entry else "That piece isn't part of this order.", code="not_returnable")
        if quantity > entry.returnable_quantity:
            raise DomainError(f"You can return up to {entry.returnable_quantity} of {entry.item.product_name}.", code="quantity")
        if entry.policy == ReturnPolicy.NON_RETURNABLE and reason not in FAULT_REASONS:
            raise DomainError(f"{entry.item.product_name} can only be returned if it arrived damaged or faulty.", code="not_returnable")
        if entry.policy == ReturnPolicy.REPLACEMENT_ONLY:
            resolution = ReturnRequest.Resolution.REPLACEMENT
    if needs_photos and not photos:
        raise DomainError("Please add a photo or two so we can see the problem.", code="photos_required")
    if resolution == ReturnRequest.Resolution.REFUND and order.payment_method == "cod" and not refund_upi_id:
        raise DomainError("Add a UPI ID so we can send your refund.", code="upi_required")
    for photo in photos:
        validate_image_file(photo)

    refund_amount = 0
    if resolution == ReturnRequest.Resolution.REFUND:
        for entry, quantity in chosen:
            # Proportional share of what was actually paid for the line (after discounts).
            refund_amount += allocate(entry.item.line_total_paise, [quantity, entry.item.quantity - quantity])[0]

    ret = ReturnRequest.objects.create(
        number=next_return_number(),
        order=order,
        user=order.user,
        email=order.email,
        reason=reason,
        resolution=resolution,
        comments=comments[:1000],
        refund_upi_id=refund_upi_id[:60],
        refund_amount_paise=refund_amount,
    )
    for entry, quantity in chosen:
        ReturnItem.objects.create(return_request=ret, order_item=entry.item, quantity=quantity)
    for photo in photos:
        ReturnPhoto.objects.create(return_request=ret, image=reencode_upload(photo))
    ReturnStatusEvent.objects.create(return_request=ret, to_status=R.REQUESTED, actor=user)
    AdminNotification.objects.create(
        kind=AdminNotification.Kind.RETURN_REQUESTED,
        title=f"Return {ret.number} requested for {order.number}",
        link=f"/admin-panel/returns/{ret.number}",
    )
    transaction.on_commit(lambda: _notify(ret.pk))
    return ret


@transaction.atomic
def transition_return(ret: ReturnRequest, to: str, *, actor=None, note: str = "", pickup_date=None) -> ReturnRequest:
    ret = ReturnRequest.objects.select_for_update().select_related("order").get(pk=ret.pk)
    if to not in TRANSITIONS[ret.status]:
        raise ConflictError(
            f"A return that is {ret.get_status_display().lower()} can't move to {ReturnStatus(to).label.lower()}.",
            code="invalid_transition",
        )
    if to == R.PICKUP_SCHEDULED and not pickup_date:
        raise DomainError("Choose a pickup date.", code="pickup_date_required")
    if to == R.REFUNDED and ret.resolution != ReturnRequest.Resolution.REFUND:
        raise DomainError("This request is for a replacement, not a refund.", code="wrong_resolution")
    if to == R.REPLACED and ret.resolution != ReturnRequest.Resolution.REPLACEMENT:
        raise DomainError("This request is for a refund, not a replacement.", code="wrong_resolution")

    previous = ret.status
    ret.status = to
    fields = ["status", "updated_at"]
    if pickup_date:
        ret.pickup_date = pickup_date
        fields.append("pickup_date")
    if note:
        ret.admin_note = note
        fields.append("admin_note")
    if to == R.RECEIVED:
        for ri in ret.items.select_related("order_item"):
            if ri.order_item.variant_id:
                adjust_stock(ri.order_item.variant_id, ri.quantity, StockMovement.Reason.RETURN_RESTOCK, reference=ret.number, actor=actor)
            OrderItem.objects.filter(pk=ri.order_item_id).update(returned_quantity=F("returned_quantity") + ri.quantity)
    if to in (R.REFUNDED, R.REPLACED, R.REJECTED):
        ret.resolved_at = timezone.now()
        fields.append("resolved_at")
    if to == R.REFUNDED:
        _issue_refund(ret)
    ret.save(update_fields=fields)
    ReturnStatusEvent.objects.create(return_request=ret, from_status=previous, to_status=to, note=note[:300], actor=actor)
    transaction.on_commit(lambda: _notify(ret.pk))
    return ret


def _issue_refund(ret: ReturnRequest) -> None:
    from apps.payments.models import Payment
    from apps.payments.providers import ProviderError, get_provider

    order = ret.order
    payment = order.payments.filter(status__in=[Payment.Status.CAPTURED, Payment.Status.PARTIALLY_REFUNDED]).first()
    if payment is None:
        raise DomainError("There's no captured payment to refund on this order.", code="no_payment")
    remaining = payment.amount_paise - payment.refunded_paise
    amount = min(ret.refund_amount_paise, remaining)
    if amount <= 0:
        raise DomainError("This order has already been fully refunded.", code="already_refunded")
    try:
        refund = get_provider(payment.provider).refund(payment, amount, reason=f"Return {ret.number}")
    except ProviderError as exc:
        raise DomainError(str(exc), code="refund_failed") from exc
    refund.return_request = ret
    refund.save(update_fields=["return_request"])
    fully = payment.refunded_paise >= payment.amount_paise
    payment.status = Payment.Status.REFUNDED if fully else Payment.Status.PARTIALLY_REFUNDED
    payment.save(update_fields=["status"])
    Order.objects.filter(pk=order.pk).update(
        payment_status=PaymentStatus.REFUNDED if fully else PaymentStatus.PARTIALLY_REFUNDED
    )


def _notify(return_id: int) -> None:
    ret = ReturnRequest.objects.select_related("order").prefetch_related("items__order_item").get(pk=return_id)
    title, message = COPY[ret.status]
    send_email(
        "return_status",
        ret.email,
        {
            "number": ret.number,
            "order_number": ret.order.number,
            "first_name": ret.order.shipping_address.get("full_name", "").split(" ")[0],
            "title": title,
            "message": message,
            "status": ret.status,
            "note": ret.admin_note if ret.status == R.REJECTED else "",
            "pickup_date": ret.pickup_date.strftime("%A, %d %B") if ret.pickup_date else "",
            "refund": rupees(ret.refund_amount_paise) if ret.refund_amount_paise else "",
            "manual_refund": ret.order.payment_method == "cod",
            "items": [{"name": i.order_item.product_name, "quantity": i.quantity} for i in ret.items.all()],
            "url": f"{order_url(ret.order)}#returns",
        },
    )
