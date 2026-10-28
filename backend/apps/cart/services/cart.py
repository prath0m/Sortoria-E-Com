from django.db import transaction

from apps.cart.models import Cart, CartItem, WishlistItem
from apps.catalog.models import Product, ProductVariant
from apps.core.exceptions import DomainError

from .pricing import MAX_LINE_QUANTITY, price_cart


def get_cart(user) -> Cart:
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def quote_for_cart(cart: Cart, *, pincode=None, shipping_method=None, payment_method=None, state_code=None):
    items = cart.items.filter(saved_for_later=False).values_list("variant_id", "quantity", "id")
    return price_cart(
        items,
        user=cart.user,
        email=cart.user.email,
        coupon_code=cart.coupon.code if cart.coupon_id else None,
        pincode=pincode,
        shipping_method=shipping_method,
        payment_method=payment_method,
        destination_state_code=state_code,
    )


def saved_quote(cart: Cart):
    items = cart.items.filter(saved_for_later=True).values_list("variant_id", "quantity", "id")
    return price_cart(items)


def _purchasable_variant(variant_id: int) -> ProductVariant:
    variant = ProductVariant.objects.select_related("product").filter(pk=variant_id).first()
    if variant is None or not variant.is_active or not variant.product.is_active:
        raise DomainError("That piece is no longer available.", code="unavailable")
    if variant.stock <= 0:
        raise DomainError("That option has just sold out.", code="sold_out")
    return variant


@transaction.atomic
def add_item(cart: Cart, variant_id: int, quantity: int) -> CartItem:
    variant = _purchasable_variant(variant_id)
    item, created = CartItem.objects.select_for_update().get_or_create(
        cart=cart, variant=variant, defaults={"quantity": 0}
    )
    item.quantity = min(item.quantity + quantity, variant.stock, MAX_LINE_QUANTITY)
    item.saved_for_later = False
    item.save()
    cart.save(update_fields=["updated_at"])
    return item


def update_quantity(item: CartItem, quantity: int) -> CartItem:
    item.quantity = max(1, min(quantity, max(item.variant.stock, 1), MAX_LINE_QUANTITY))
    item.save(update_fields=["quantity"])
    return item


@transaction.atomic
def merge_guest_cart(cart: Cart, lines: list[dict]) -> None:
    """Merge a guest bag into the account: sum quantities, cap at stock, skip anything unavailable."""
    variants = {
        v.pk: v
        for v in ProductVariant.objects.select_related("product").filter(
            pk__in=[line["variant_id"] for line in lines]
        )
    }
    existing = {i.variant_id: i for i in cart.items.select_for_update()}
    for line in lines:
        variant = variants.get(line["variant_id"])
        if variant is None or not variant.is_active or not variant.product.is_active or variant.stock <= 0:
            continue
        item = existing.get(variant.pk)
        if item is None:
            item = CartItem(
                cart=cart, variant=variant, quantity=0, saved_for_later=line.get("saved_for_later", False)
            )
            existing[variant.pk] = item
        elif not line.get("saved_for_later", False):
            item.saved_for_later = False
        item.quantity = min(item.quantity + line["quantity"], variant.stock, MAX_LINE_QUANTITY)
        item.save()


def clear_cart(cart: Cart) -> None:
    cart.items.filter(saved_for_later=False).delete()
    Cart.objects.filter(pk=cart.pk).update(coupon=None)


def merge_wishlist(user, product_ids: list[int]) -> None:
    have = set(WishlistItem.objects.filter(user=user).values_list("product_id", flat=True))
    valid = (
        Product.objects.filter(pk__in=product_ids, is_active=True)
        .exclude(pk__in=have)
        .values_list("pk", flat=True)
    )
    WishlistItem.objects.bulk_create(
        [WishlistItem(user=user, product_id=pid) for pid in valid], ignore_conflicts=True
    )
