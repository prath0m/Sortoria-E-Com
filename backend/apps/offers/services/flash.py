"""Which flash-sale price applies to a product right now."""

from django.db.models import F, Q
from django.utils import timezone

from apps.offers.models import FlashSaleItem


def live_flash_items(product_ids, at=None) -> dict[int, FlashSaleItem]:
    """Best live sale item per product (largest discount on a ₹1,000 reference), skipping sold-out caps."""
    at = at or timezone.now()
    items = (
        FlashSaleItem.objects.filter(
            product_id__in=list(product_ids),
            sale__is_active=True,
            sale__starts_at__lte=at,
            sale__ends_at__gt=at,
        )
        .filter(Q(quantity_cap__isnull=True) | Q(sold_count__lt=F("quantity_cap")))
        .select_related("sale")
    )
    best: dict[int, FlashSaleItem] = {}
    for item in items:
        current = best.get(item.product_id)
        if current is None or item.price_for(100000) < current.price_for(100000):
            best[item.product_id] = item
    return best


def effective_price(base_price: int, item: FlashSaleItem | None) -> int:
    return item.price_for(base_price) if item else base_price
