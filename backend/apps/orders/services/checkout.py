"""Turn a bag into an order. Stock is locked and taken inside one transaction, so nothing oversells."""

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.cart.services.pricing import Quote, price_cart
from apps.catalog.models import ProductVariant, StockMovement
from apps.core.exceptions import ConflictError, DomainError
from apps.core.money import rupees
from apps.offers.models import Coupon, CouponRedemption, FlashSaleItem
from apps.orders.models import Order, OrderItem, OrderStatus, OrderStatusEvent
from apps.payments.providers import ProviderError, get_provider

from .numbering import next_order_number


@dataclass
class CheckoutInput:
    email: str
    phone: str
    shipping_address: dict
    billing_address: dict
    items: list[tuple[int, int]]
    shipping_method: str
    payment_method: str
    coupon_code: str = ""
    customer_note: str = ""
    expected_total: int | None = None


def _line_image(variant: ProductVariant) -> str:
    images = list(variant.product.images.all())
    if not images:
        return ""
    image = images[0]
    return image.renditions.get("400") or image.image.url


def _validate(quote: Quote, data: CheckoutInput) -> None:
    if quote.is_empty:
        raise DomainError("Your bag is empty.", code="empty_cart")
    if quote.serviceable is False:
        raise DomainError(
            f"We don't deliver to {data.shipping_address['pincode']} yet. Please choose another address.",
            code="unserviceable",
        )
    problems = [
        {
            "variant_id": line.variant.pk,
            "name": line.product.name,
            "issue": line.issue,
            "available": line.variant.stock,
        }
        for line in quote.lines
        if line.issue
    ]
    if problems:
        raise ConflictError(
            "Some pieces in your bag have changed. Please review them before placing your order.",
            code="stock_changed",
            extra={"lines": problems},
        )
    if data.coupon_code and not quote.coupon_applied:
        raise DomainError(quote.coupon_message or "That code no longer applies.", code="coupon_invalid")
    if quote.shipping_method != data.shipping_method:
        raise DomainError("That delivery option isn't available for this address.", code="shipping_unavailable")
    if data.payment_method == "cod" and not quote.cod_available:
        raise DomainError(quote.cod_unavailable_reason, code="cod_unavailable")
    if data.expected_total is not None and data.expected_total != quote.total:
        raise ConflictError(
            f"Your total has been updated to {rupees(quote.total)}. Please review before paying.",
            code="price_changed",
            extra={"total_paise": quote.total},
        )


def place_order(data: CheckoutInput, *, user=None) -> tuple[Order, dict | None]:
    provider = get_provider(data.payment_method)
    if not provider.is_available():
        raise DomainError("That payment method isn't available right now.", code="payment_unavailable")

    with transaction.atomic():
        variant_ids = sorted({vid for vid, _ in data.items})
        # Lock in a fixed order so concurrent checkouts can't deadlock each other.
        locked = list(ProductVariant.objects.select_for_update().filter(pk__in=variant_ids).order_by("pk"))
        product_ids = {v.product_id for v in locked}
        list(FlashSaleItem.objects.select_for_update().filter(product_id__in=product_ids).order_by("pk"))

        quote = price_cart(
            data.items,
            user=user,
            email=data.email,
            coupon_code=data.coupon_code or None,
            pincode=data.shipping_address["pincode"],
            shipping_method=data.shipping_method,
            payment_method=data.payment_method,
            destination_state_code=data.shipping_address.get("state_code"),
        )
        _validate(quote, data)

        status = OrderStatus.PENDING_PAYMENT if provider.prepaid else OrderStatus.PLACED
        now = timezone.now()
        order = Order.objects.create(
            number=next_order_number(),
            user=user if user is not None and user.is_authenticated else None,
            email=data.email.lower(),
            phone=data.phone,
            status=status,
            payment_method=provider.code,
            shipping_address=data.shipping_address,
            billing_address=data.billing_address,
            shipping_method=quote.shipping_method,
            coupon_code=quote.coupon_code if quote.coupon_applied else "",
            subtotal_paise=quote.subtotal,
            item_discount_paise=max(0, quote.mrp_total - quote.subtotal),
            bundle_discount_paise=quote.bundle_discount,
            coupon_discount_paise=quote.coupon_discount,
            shipping_fee_paise=quote.shipping_fee,
            cod_fee_paise=quote.cod_fee,
            tax_total_paise=quote.tax_total,
            cgst_paise=quote.cgst,
            sgst_paise=quote.sgst,
            igst_paise=quote.igst,
            grand_total_paise=quote.total,
            customer_note=data.customer_note[:500],
            placed_at=now if status == OrderStatus.PLACED else None,
            reservation_expires_at=(
                now + timedelta(minutes=settings.PAYMENT_RESERVATION_MINUTES) if provider.prepaid else None
            ),
            estimated_delivery_date=next(
                (o.eta_to for o in quote.shipping_options if o.code == quote.shipping_method), None
            ),
        )

        for line in quote.lines:
            variant = line.variant
            OrderItem.objects.create(
                order=order,
                variant=variant,
                product_id_snapshot=variant.product_id,
                product_name=variant.product.name,
                product_slug=variant.product.slug,
                variant_label=variant.label,
                sku=variant.sku,
                image_url=_line_image(variant),
                hsn_code=variant.product.hsn_code,
                mrp_paise=line.mrp,
                unit_price_paise=line.unit_price,
                quantity=line.quantity,
                line_discount_paise=line.discount,
                tax_rate=variant.product.tax_rate,
                tax_paise=line.tax,
                line_total_paise=line.net,
                flash_sale_item_id=line.flash_item.pk if line.flash_item else None,
            )
            ProductVariant.objects.filter(pk=variant.pk).update(stock=F("stock") - line.quantity)
            StockMovement.objects.create(
                variant=variant,
                delta=-line.quantity,
                balance_after=variant.stock - line.quantity,
                reason=StockMovement.Reason.ORDER_RESERVED,
                reference=order.number,
            )
            if line.flash_item:
                FlashSaleItem.objects.filter(pk=line.flash_item.pk).update(sold_count=F("sold_count") + line.quantity)

        if quote.coupon_applied:
            coupon = Coupon.objects.select_for_update().get(code=quote.coupon_code)
            if coupon.usage_limit_total is not None and coupon.times_used >= coupon.usage_limit_total:
                raise DomainError(f"{coupon.code} has just been fully redeemed.", code="coupon_invalid")
            CouponRedemption.objects.create(
                coupon=coupon,
                order=order,
                user=order.user,
                email=order.email,
                discount_paise=quote.coupon_discount,
            )
            Coupon.objects.filter(pk=coupon.pk).update(times_used=F("times_used") + 1)

        OrderStatusEvent.objects.create(order=order, from_status="", to_status=status)
        try:
            payment = provider.create_payment(order)
        except ProviderError as exc:
            raise DomainError(str(exc), code="payment_provider_error") from exc

        from apps.catalog.services.aggregates import refresh_products

        transaction.on_commit(lambda: refresh_products(product_ids))
        if status == OrderStatus.PLACED:
            from .notifications import order_placed
            from .state_machine import _count_sales

            _count_sales(order, +1)

            order_id = order.pk
            transaction.on_commit(lambda: order_placed.delay(order_id))

    return order, provider.client_payload(payment)
