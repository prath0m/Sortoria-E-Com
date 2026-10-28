from celery import shared_task
from django.db.models import Q

from apps.cart.models import Cart, CartItem
from apps.core.emails import send_email
from apps.core.models import AdminNotification
from apps.core.money import rupees
from apps.orders.models import Order, OrderStatus

from .presentation import order_context

STATUS_COPY = {
    OrderStatus.CONFIRMED: (
        "Order confirmed",
        "We've confirmed your order",
        "Our team has checked every piece and your order is being prepared.",
    ),
    OrderStatus.PACKED: (
        "Packed with care",
        "Your order is packed",
        "Everything is wrapped and boxed, waiting for our courier partner.",
    ),
    OrderStatus.SHIPPED: (
        "On its way",
        "Your order has shipped",
        "Your parcel has left our studio. Follow its journey with the tracking details below.",
    ),
    OrderStatus.OUT_FOR_DELIVERY: (
        "Arriving today",
        "Out for delivery",
        "Your parcel is with the delivery partner and should reach you today.",
    ),
    OrderStatus.DELIVERED: (
        "Delivered",
        "Your order has arrived",
        "We hope it was worth the wait. If anything isn't quite right, we're here to help.",
    ),
    OrderStatus.CANCELLED: (
        "Order cancelled",
        "Your order has been cancelled",
        "Your order has been cancelled and any reserved pieces released.",
    ),
    OrderStatus.PAYMENT_FAILED: (
        "Payment didn't go through",
        "We couldn't complete your payment",
        "No money has been taken. Your bag is still saved, and you can try again whenever you're ready.",
    ),
}


@shared_task
def order_placed(order_id: int) -> None:
    from .invoices import ensure_invoice

    order = Order.objects.prefetch_related("items").get(pk=order_id)
    ensure_invoice(order)
    send_email(
        "order_confirmation",
        order.email,
        order_context(order),
        attachments=[(f"Invoice-{order.number}.pdf", order.invoice_pdf.path, "application/pdf")],
    )
    AdminNotification.objects.create(
        kind=AdminNotification.Kind.NEW_ORDER,
        title=f"New order {order.number} · {rupees(order.grand_total_paise)}",
        link=f"/admin-panel/orders/{order.number}",
        payload={"order": order.number, "total_paise": order.grand_total_paise},
    )
    _clear_ordered_lines(order)


def _clear_ordered_lines(order: Order) -> None:
    if order.user_id is None:
        return
    variant_ids = list(order.items.values_list("variant_id", flat=True))
    CartItem.objects.filter(cart__user_id=order.user_id, saved_for_later=False, variant_id__in=variant_ids).delete()
    if order.coupon_code:
        Cart.objects.filter(Q(user_id=order.user_id), coupon__code=order.coupon_code).update(coupon=None)


@shared_task
def notify_status_change(order_id: int, status: str) -> None:
    if status == OrderStatus.PLACED:
        order_placed(order_id)
        return
    copy = STATUS_COPY.get(status)
    if copy is None:
        return
    order = Order.objects.prefetch_related("items").get(pk=order_id)
    eyebrow, title, message = copy
    template = "payment_failed" if status == OrderStatus.PAYMENT_FAILED else "order_status"
    send_email(
        template,
        order.email,
        {**order_context(order), "eyebrow": eyebrow, "title": title, "message": message},
    )
    if status == OrderStatus.PAYMENT_FAILED:
        AdminNotification.objects.create(
            kind=AdminNotification.Kind.PAYMENT_FAILED,
            title=f"Payment failed for {order.number}",
            link=f"/admin-panel/orders/{order.number}",
        )
