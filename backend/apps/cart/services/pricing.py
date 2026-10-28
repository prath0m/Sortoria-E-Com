"""The pricing engine. Every amount a shopper sees or pays is computed here, server-side.

Order of operations (all integer paise, all prices GST-inclusive):
  1. unit price  = variant price, or the live flash-sale price while its quantity cap allows
  2. bundles     = discount for complete sets in the bag, best saving first
  3. coupon      = validated against the post-bundle subtotal, applied to eligible lines
  4. allocation  = bundle + coupon discounts spread over lines by value (largest remainder)
  5. shipping    = method + zone fee, free above the threshold; bulky surcharges; COD fee
  6. GST         = extracted per line at its rate; shipping/COD at 18%; CGST+SGST or IGST
"""

from collections import defaultdict
from dataclasses import dataclass, field

from django.db.models import Prefetch

from apps.catalog.models import ProductImage, ProductVariant
from apps.core.models import StoreSettings
from apps.core.money import allocate, inclusive_tax, rupees
from apps.offers.models import Bundle, BundleItem, FlashSaleItem
from apps.offers.services.coupons import check_coupon, coupon_discount, find_coupon, line_is_eligible
from apps.offers.services.flash import live_flash_items
from apps.shipping.models import ShippingMethod
from apps.shipping.services import ShippingOption, free_shipping_threshold, lookup_pincode, shipping_options

SERVICE_TAX_RATE = 18
MAX_LINE_QUANTITY = 10


@dataclass
class QuoteLine:
    variant: ProductVariant
    quantity: int
    unit_price: int
    mrp: int
    flash_item: FlashSaleItem | None
    cart_item_id: int | None = None
    bundle_discount: int = 0
    coupon_discount: int = 0
    tax: int = 0
    issue: str = ""

    @property
    def gross(self) -> int:
        return self.unit_price * self.quantity

    @property
    def discount(self) -> int:
        return self.bundle_discount + self.coupon_discount

    @property
    def net(self) -> int:
        return self.gross - self.discount

    @property
    def product(self):
        return self.variant.product


@dataclass
class Quote:
    lines: list[QuoteLine]
    subtotal: int = 0
    mrp_total: int = 0
    bundle_discount: int = 0
    bundles_applied: list[dict] = field(default_factory=list)
    coupon_code: str = ""
    coupon_discount: int = 0
    coupon_applied: bool = False
    coupon_message: str = ""
    pincode: str = ""
    serviceable: bool | None = None
    destination: dict | None = None
    shipping_options: list[ShippingOption] = field(default_factory=list)
    shipping_method: str = ""
    shipping_fee: int = 0
    payment_method: str = ""
    cod_available: bool = True
    cod_unavailable_reason: str = ""
    cod_fee: int = 0
    tax_total: int = 0
    cgst: int = 0
    sgst: int = 0
    igst: int = 0
    total: int = 0
    free_shipping_threshold: int | None = None
    free_shipping_remaining: int = 0
    messages: list[str] = field(default_factory=list)

    @property
    def savings(self) -> int:
        return (self.mrp_total - self.subtotal) + self.bundle_discount + self.coupon_discount

    @property
    def item_count(self) -> int:
        return sum(line.quantity for line in self.lines)

    @property
    def has_issues(self) -> bool:
        return any(line.issue for line in self.lines)

    @property
    def is_empty(self) -> bool:
        return not self.lines


def _load_variants(variant_ids):
    return {
        v.pk: v
        for v in ProductVariant.objects.filter(pk__in=variant_ids)
        .select_related("product__category", "product__brand")
        .prefetch_related(
            "option_values__attribute",
            Prefetch("product__images", queryset=ProductImage.objects.order_by("position", "id")),
        )
    }


def _apply_bundles(lines: list[QuoteLine]) -> tuple[int, list[dict]]:
    """Greedily apply live bundles, best saving per set first. Mutates line.bundle_discount."""
    by_product: dict[int, list[QuoteLine]] = defaultdict(list)
    for line in lines:
        by_product[line.variant.product_id].append(line)
    if not by_product:
        return 0, []
    bundles = (
        Bundle.objects.live()
        .filter(items__product_id__in=by_product)
        .prefetch_related(Prefetch("items", queryset=BundleItem.objects.all()))
        .distinct()
    )
    remaining = {pid: sum(line.quantity for line in ls) for pid, ls in by_product.items()}

    def set_value(bundle):
        value = 0
        for item in bundle.items.all():
            matching = by_product.get(item.product_id)
            if not matching:
                return None
            value += min(line.unit_price for line in matching) * item.quantity
        return value

    def saving(bundle, value):
        if bundle.discount_type == Bundle.DiscountType.PERCENT:
            return value * min(bundle.value, 90) // 100
        if bundle.discount_type == Bundle.DiscountType.FIXED_OFF:
            return min(bundle.value, value)
        return max(0, value - bundle.value)

    candidates = []
    for bundle in bundles:
        value = set_value(bundle)
        if value:
            candidates.append((saving(bundle, value), value, bundle))
    candidates.sort(key=lambda c: c[0], reverse=True)

    total = 0
    applied = []
    for per_set, _value, bundle in candidates:
        items = list(bundle.items.all())
        sets = min(remaining.get(i.product_id, 0) // i.quantity for i in items)
        if sets <= 0 or per_set <= 0:
            continue
        discount = per_set * sets
        participating = [line for i in items for line in by_product[i.product_id]]
        shares = allocate(discount, [line.gross for line in participating])
        for line, share in zip(participating, shares, strict=True):
            line.bundle_discount += min(share, line.gross - line.bundle_discount)
        for i in items:
            remaining[i.product_id] -= i.quantity * sets
        total += discount
        applied.append({"title": bundle.title, "slug": bundle.slug, "sets": sets, "discount_paise": discount})
    return total, applied


def price_cart(
    items,
    *,
    user=None,
    email: str | None = None,
    coupon_code: str | None = None,
    pincode: str | None = None,
    shipping_method: str | None = None,
    payment_method: str | None = None,
    destination_state_code: str | None = None,
) -> Quote:
    """Price `items`, an iterable of (variant_id, quantity) or (variant_id, quantity, cart_item_id)."""
    store = StoreSettings.load()
    wanted: dict[int, tuple[int, int | None]] = {}
    for entry in items:
        variant_id, quantity = int(entry[0]), int(entry[1])
        cart_item_id = entry[2] if len(entry) > 2 else None
        prev = wanted.get(variant_id, (0, cart_item_id))[0]
        wanted[variant_id] = (prev + max(quantity, 0), cart_item_id)

    variants = _load_variants(wanted)
    flash = live_flash_items({v.product_id for v in variants.values()})
    lines: list[QuoteLine] = []
    for variant_id, (quantity, cart_item_id) in wanted.items():
        variant = variants.get(variant_id)
        if variant is None or quantity <= 0:
            continue
        product = variant.product
        item = flash.get(product.pk)
        issue = ""
        if not (variant.is_active and product.is_active):
            issue = "This piece is no longer available."
        elif variant.stock <= 0:
            issue = "Sold out."
        elif variant.stock < quantity:
            issue = f"Only {variant.stock} left."
        quantity = min(quantity, MAX_LINE_QUANTITY)
        if item and item.remaining is not None and item.remaining < quantity:
            item = None  # the sale allocation can't cover this many units; regular price applies
        unit = item.price_for(variant.price_paise) if item else variant.price_paise
        lines.append(
            QuoteLine(
                variant=variant,
                quantity=quantity,
                unit_price=unit,
                mrp=variant.mrp_paise,
                flash_item=item,
                cart_item_id=cart_item_id,
                issue=issue,
            )
        )

    quote = Quote(lines=lines, pincode=(pincode or "").strip(), payment_method=payment_method or "")
    quote.subtotal = sum(line.gross for line in lines)
    quote.mrp_total = sum(line.mrp * line.quantity for line in lines)

    quote.bundle_discount, quote.bundles_applied = _apply_bundles(lines)
    after_bundles = quote.subtotal - quote.bundle_discount

    if coupon_code:
        coupon = find_coupon(coupon_code)
        quote.coupon_code = coupon_code.strip().upper()
        check = check_coupon(coupon, code=coupon_code, user=user, email=email, order_subtotal=after_bundles)
        if check.ok:
            eligible = [line for line in lines if line_is_eligible(coupon, line.product)]
            eligible_value = sum(line.gross - line.bundle_discount for line in eligible)
            discount = coupon_discount(coupon, eligible_value)
            if discount > 0:
                shares = allocate(discount, [line.gross - line.bundle_discount for line in eligible])
                for line, share in zip(eligible, shares, strict=True):
                    line.coupon_discount = share
                quote.coupon_discount = discount
                quote.coupon_applied = True
                quote.coupon_message = f"{coupon.code} applied: you save {rupees(discount)}."
            else:
                quote.coupon_message = f"{coupon.code} doesn't apply to the pieces in your bag."
        else:
            quote.coupon_message = check.message

    merchandise = after_bundles - quote.coupon_discount

    # Shipping
    serviceable = lookup_pincode(quote.pincode)
    zone = serviceable.zone if serviceable else None
    if quote.pincode:
        quote.serviceable = serviceable is not None
        if serviceable:
            quote.destination = {"city": serviceable.city, "state": serviceable.state}
        else:
            quote.messages.append(f"We don't deliver to {quote.pincode} yet.")
    bulky_units = sum(line.quantity for line in lines if line.product.product_type == "bulky")
    quote.shipping_options = shipping_options(
        zone, subtotal_after_discounts=merchandise, bulky_units=bulky_units
    )
    available = [o for o in quote.shipping_options if o.available]
    chosen = next((o for o in available if o.code == shipping_method), None) or next(
        (o for o in available if o.code == ShippingMethod.Code.STANDARD), available[0] if available else None
    )
    if lines and chosen:
        quote.shipping_method = chosen.code
        quote.shipping_fee = chosen.fee_paise
    quote.free_shipping_threshold = free_shipping_threshold()
    if quote.free_shipping_threshold and lines:
        quote.free_shipping_remaining = max(0, quote.free_shipping_threshold - merchandise)
        if quote.free_shipping_remaining:
            quote.messages.append(
                f"Add {rupees(quote.free_shipping_remaining)} more for complimentary shipping."
            )

    # Cash on delivery
    pre_cod_total = merchandise + quote.shipping_fee
    if not store.cod_enabled:
        quote.cod_available, quote.cod_unavailable_reason = (
            False,
            "Cash on delivery is currently unavailable.",
        )
    elif zone is not None and not zone.cod_available:
        quote.cod_available, quote.cod_unavailable_reason = (
            False,
            "Cash on delivery isn't offered at this pincode.",
        )
    elif pre_cod_total > store.cod_max_order_paise:
        quote.cod_available = False
        quote.cod_unavailable_reason = (
            f"Cash on delivery is available on orders up to {rupees(store.cod_max_order_paise)}."
        )
    if payment_method == "cod" and quote.cod_available and lines:
        quote.cod_fee = store.cod_fee_paise

    # GST (prices inclusive)
    for line in lines:
        line.tax = inclusive_tax(line.net, line.product.tax_rate)
    service_tax = inclusive_tax(quote.shipping_fee + quote.cod_fee, SERVICE_TAX_RATE)
    quote.tax_total = sum(line.tax for line in lines) + service_tax
    customer_state = destination_state_code
    if customer_state is None and serviceable is not None:
        customer_state = serviceable.state_code or None
    if customer_state and customer_state == store.state_code:
        quote.cgst = quote.tax_total // 2
        quote.sgst = quote.tax_total - quote.cgst
    elif customer_state:
        quote.igst = quote.tax_total
    else:
        # Destination unknown: show the split as intra-state until an address is given.
        quote.cgst = quote.tax_total // 2
        quote.sgst = quote.tax_total - quote.cgst

    quote.total = merchandise + quote.shipping_fee + quote.cod_fee
    return quote
