"""JSON-safe views of an order for emails, PDFs and notifications (they cross the Celery boundary)."""

from django.conf import settings

from apps.core.money import amount_in_words, rupees
from apps.orders.models import Order


def order_url(order: Order) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/order/{order.number}?token={order.guest_access_token}"


def absolute_media(url: str) -> str:
    if not url or url.startswith("http"):
        return url
    return f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}{url}"


def address_lines(address: dict) -> list[str]:
    return [
        line
        for line in (
            address.get("full_name", ""),
            address.get("line1", ""),
            address.get("line2", ""),
            f"Near {address['landmark']}" if address.get("landmark") else "",
            f"{address.get('city', '')}, {address.get('state', '')} {address.get('pincode', '')}".strip(", "),
            f"+91 {address['phone']}" if address.get("phone") else "",
        )
        if line
    ]


def order_context(order: Order) -> dict:
    items = list(order.items.all())
    discount = order.bundle_discount_paise + order.coupon_discount_paise
    return {
        "number": order.number,
        "status": order.status,
        "status_label": order.get_status_display(),
        "placed_at": order.placed_at.isoformat() if order.placed_at else order.created_at.isoformat(),
        "email": order.email,
        "first_name": order.shipping_address.get("full_name", "").split(" ")[0],
        "payment_method": "Cash on delivery" if order.payment_method == "cod" else "Paid online",
        "shipping_method": order.shipping_method.title(),
        "items": [
            {
                "name": i.product_name,
                "variant": i.variant_label,
                "quantity": i.quantity,
                "unit_price": rupees(i.unit_price_paise),
                "total": rupees(i.line_total_paise),
                "image": absolute_media(i.image_url),
            }
            for i in items
        ],
        "subtotal": rupees(order.subtotal_paise),
        "discount": rupees(discount) if discount else "",
        "coupon_code": order.coupon_code,
        "shipping": rupees(order.shipping_fee_paise) if order.shipping_fee_paise else "Complimentary",
        "cod_fee": rupees(order.cod_fee_paise) if order.cod_fee_paise else "",
        "tax": rupees(order.tax_total_paise),
        "total": rupees(order.grand_total_paise),
        "total_words": amount_in_words(order.grand_total_paise),
        "address": address_lines(order.shipping_address),
        "courier": order.courier_name,
        "tracking_number": order.tracking_number,
        "tracking_url": order.tracking_url,
        "estimated_delivery": order.estimated_delivery_date.strftime("%A, %d %B")
        if order.estimated_delivery_date
        else "",
        "order_url": order_url(order),
        "cancel_reason": order.cancel_reason,
        "refund_note": (
            "Your payment will be refunded to the original method within 5–7 working days."
            if order.payment_status in ("refunded", "partially_refunded")
            or (order.status == "cancelled" and order.payment_method != "cod" and order.payment_status == "paid")
            else ""
        ),
    }
