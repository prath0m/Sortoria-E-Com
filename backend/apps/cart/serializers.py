from rest_framework import serializers

from apps.catalog.models import Attribute

from .services.pricing import Quote, QuoteLine


def _line_image(line: QuoteLine) -> dict | None:
    images = list(line.product.images.all())
    chosen = {v.pk for v in line.variant.option_values.all()}
    image = next((i for i in images if i.option_value_id in chosen), None) or (images[0] if images else None)
    if image is None:
        return None
    return {"url": image.image.url, "renditions": image.renditions, "alt": image.alt_text}


def serialize_line(line: QuoteLine) -> dict:
    product = line.product
    options = sorted(line.variant.option_values.all(), key=lambda v: (v.attribute.position, v.attribute_id))
    return {
        "id": line.cart_item_id,
        "variant_id": line.variant.pk,
        "product_id": product.pk,
        "slug": product.slug,
        "name": product.name,
        "brand": product.brand.name if product.brand else None,
        "sku": line.variant.sku,
        "variant_label": " / ".join(v.value for v in options),
        "options": [
            {
                "name": v.attribute.name,
                "value": v.value,
                "hex": v.hex if v.attribute.kind == Attribute.Kind.SWATCH else "",
            }
            for v in options
        ],
        "image": _line_image(line),
        "quantity": line.quantity,
        "max_quantity": max(0, min(line.variant.stock, 10)),
        "unit_price_paise": line.unit_price,
        "mrp_paise": line.mrp,
        "line_total_paise": line.gross,
        "discount_paise": line.discount,
        "flash_sale": (
            {"title": line.flash_item.sale.title, "ends_at": line.flash_item.sale.ends_at}
            if line.flash_item
            else None
        ),
        "is_bulky": product.product_type == "bulky",
        "issue": line.issue,
    }


def serialize_quote(quote: Quote) -> dict:
    return {
        "lines": [serialize_line(line) for line in quote.lines],
        "item_count": quote.item_count,
        "subtotal_paise": quote.subtotal,
        "mrp_total_paise": quote.mrp_total,
        "bundle_discount_paise": quote.bundle_discount,
        "bundles_applied": quote.bundles_applied,
        "coupon": {
            "code": quote.coupon_code,
            "applied": quote.coupon_applied,
            "discount_paise": quote.coupon_discount,
            "message": quote.coupon_message,
        }
        if quote.coupon_code
        else None,
        "pincode": quote.pincode,
        "serviceable": quote.serviceable,
        "destination": quote.destination,
        "shipping_options": [o.as_dict() for o in quote.shipping_options],
        "shipping_method": quote.shipping_method,
        "shipping_fee_paise": quote.shipping_fee,
        "payment_method": quote.payment_method,
        "cod_available": quote.cod_available,
        "cod_unavailable_reason": quote.cod_unavailable_reason,
        "cod_fee_paise": quote.cod_fee,
        "tax": {
            "total_paise": quote.tax_total,
            "cgst_paise": quote.cgst,
            "sgst_paise": quote.sgst,
            "igst_paise": quote.igst,
        },
        "savings_paise": quote.savings,
        "total_paise": quote.total,
        "free_shipping_threshold_paise": quote.free_shipping_threshold,
        "free_shipping_remaining_paise": quote.free_shipping_remaining,
        "messages": quote.messages,
        "has_issues": quote.has_issues,
    }


class QuoteLineInput(serializers.Serializer):
    variant_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=10)


class QuoteOptions(serializers.Serializer):
    coupon_code = serializers.CharField(required=False, allow_blank=True, max_length=30)
    pincode = serializers.RegexField(r"^[1-9][0-9]{5}$", required=False, allow_blank=True)
    shipping_method = serializers.CharField(required=False, allow_blank=True, max_length=20)
    payment_method = serializers.ChoiceField(choices=["razorpay", "cod"], required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)


class GuestQuoteInput(QuoteOptions):
    lines = QuoteLineInput(many=True, max_length=50)


class CartItemInput(serializers.Serializer):
    variant_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=10, default=1)


class CartItemUpdate(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=10)


class MergeLineInput(QuoteLineInput):
    saved_for_later = serializers.BooleanField(default=False)


class CartMergeInput(serializers.Serializer):
    lines = MergeLineInput(many=True, max_length=50)


class CouponInput(serializers.Serializer):
    code = serializers.CharField(max_length=30)


class WishlistInput(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)


class WishlistMergeInput(serializers.Serializer):
    product_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=100)
