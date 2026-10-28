from celery import shared_task
from django.db.models import Q
from django.utils import timezone

from apps.core import caching

from .models import FlashSale


@shared_task
def sync_flash_sale_prices() -> int:
    """Refresh product price aggregates for sales that started or ended since the last run."""
    from apps.catalog.services.aggregates import refresh_products

    now = timezone.now()
    live = Q(is_active=True, starts_at__lte=now, ends_at__gt=now)
    started = list(FlashSale.objects.filter(live, prices_applied=False))
    ended = list(FlashSale.objects.filter(~live, prices_applied=True))
    changed = started + ended
    if not changed:
        return 0
    product_ids = set()
    for sale in changed:
        product_ids.update(sale.items.values_list("product_id", flat=True))
    refresh_products(product_ids)
    FlashSale.objects.filter(pk__in=[s.pk for s in started]).update(prices_applied=True)
    FlashSale.objects.filter(pk__in=[s.pk for s in ended]).update(prices_applied=False)
    caching.bump(caching.CATALOG, caching.OFFERS, caching.HOME)
    return len(changed)
