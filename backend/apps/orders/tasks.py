import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.core.emails import send_email

from .models import Order, OrderStatus
from .services.state_machine import SYSTEM, transition

logger = logging.getLogger(__name__)


@shared_task
def expire_unpaid_orders() -> int:
    """Release stock held by online orders whose payment window has passed."""
    expired = Order.objects.filter(status=OrderStatus.PENDING_PAYMENT, reservation_expires_at__lt=timezone.now())
    count = 0
    for order in expired:
        try:
            transition(order, OrderStatus.PAYMENT_FAILED, actor_type=SYSTEM, note="Payment window expired")
            count += 1
        except Exception:  # one bad order must not block the rest
            logger.exception("Could not expire %s", order.number)
    return count


@shared_task
def send_review_requests() -> int:
    """Invite a review a week after delivery, once per order."""
    cutoff = timezone.now() - timedelta(days=7)
    orders = Order.objects.filter(
        status=OrderStatus.DELIVERED, delivered_at__lte=cutoff, review_request_sent=False
    ).prefetch_related("items")[:200]
    base = settings.FRONTEND_URL.rstrip("/")
    sent = 0
    for order in orders:
        items = [i for i in order.items.all() if i.product_slug]
        if items:
            send_email(
                "review_request",
                order.email,
                {
                    "first_name": order.shipping_address.get("full_name", "").split(" ")[0],
                    "first_item": items[0].product_name,
                    "review_items": [
                        {"name": i.product_name, "url": f"{base}/products/{i.product_slug}#reviews"} for i in items
                    ],
                },
            )
            sent += 1
        Order.objects.filter(pk=order.pk).update(review_request_sent=True)
    return sent
