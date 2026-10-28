"""Apply gateway outcomes to orders. Every function is idempotent: callbacks and webhooks may repeat."""

import logging

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import ConflictError
from apps.orders.models import Order, OrderStatus, PaymentStatus
from apps.orders.services.state_machine import SYSTEM, _refund_in_full, transition

from .models import Payment, Refund, WebhookEvent
from .providers import WebhookPayload

logger = logging.getLogger(__name__)


@transaction.atomic
def confirm_payment(payment: Payment, *, provider_payment_id: str, method: str = "", raw: dict | None = None) -> Order:
    payment = Payment.objects.select_for_update().select_related("order").get(pk=payment.pk)
    order = payment.order
    if payment.status == Payment.Status.CAPTURED:
        return order
    payment.status = Payment.Status.CAPTURED
    payment.provider_payment_id = provider_payment_id
    payment.signature_verified = True
    payment.method = method[:30]
    payment.raw = {**payment.raw, "capture": raw or {}}
    payment.save()
    Order.objects.filter(pk=order.pk).update(payment_status=PaymentStatus.PAID)
    order.refresh_from_db()

    if order.status in (OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_FAILED):
        try:
            with transaction.atomic():
                order = transition(order, OrderStatus.PLACED, actor_type=SYSTEM, note="Payment received")
        except ConflictError:
            # Captured after the reservation lapsed and the stock has since sold: refund rather than oversell.
            logger.warning("Late capture for %s could not be fulfilled; refunding", order.number)
            _refund_in_full(order, reason="Payment arrived after the item sold out")
            transition(order, OrderStatus.CANCELLED, actor_type=SYSTEM, note="Sold out before payment completed")
    elif order.status == OrderStatus.CANCELLED:
        _refund_in_full(order, reason="Payment received for a cancelled order")
    return order


@transaction.atomic
def fail_payment(payment: Payment, *, reason: str = "", raw: dict | None = None) -> Order:
    payment = Payment.objects.select_for_update().select_related("order").get(pk=payment.pk)
    if payment.status == Payment.Status.CAPTURED:
        return payment.order
    payment.status = Payment.Status.FAILED
    payment.error_description = reason[:300]
    payment.raw = {**payment.raw, "failure": raw or {}}
    payment.save()
    order = payment.order
    if order.status == OrderStatus.PENDING_PAYMENT:
        order = transition(order, OrderStatus.PAYMENT_FAILED, actor_type=SYSTEM, note=reason[:300])
    return order


def handle_webhook(provider_code: str, event: WebhookPayload) -> bool:
    """Process a verified webhook once. Returns False when the event was already handled."""
    with transaction.atomic():
        record, created = WebhookEvent.objects.get_or_create(
            event_id=event.event_id,
            defaults={"provider": provider_code, "event_type": event.event_type, "payload": event.payload},
        )
        if not created and record.processed_at:
            return False
    entity = event.payload.get("payload", {})
    if event.event_type in ("payment.captured", "order.paid", "payment.failed"):
        data = entity.get("payment", {}).get("entity", {})
        payment = Payment.objects.filter(provider=provider_code, provider_order_id=data.get("order_id")).first()
        if payment:
            if event.event_type == "payment.failed":
                fail_payment(payment, reason=data.get("error_description", "Payment failed"), raw=data)
            else:
                confirm_payment(
                    payment, provider_payment_id=data.get("id", ""), method=data.get("method", ""), raw=data
                )
    elif event.event_type in ("refund.processed", "refund.failed"):
        data = entity.get("refund", {}).get("entity", {})
        status = Refund.Status.PROCESSED if event.event_type == "refund.processed" else Refund.Status.FAILED
        Refund.objects.filter(provider_refund_id=data.get("id")).update(status=status)
    WebhookEvent.objects.filter(pk=record.pk).update(processed_at=timezone.now())
    return True
