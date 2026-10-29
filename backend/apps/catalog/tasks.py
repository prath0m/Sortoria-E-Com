import logging
from datetime import timedelta

from celery import shared_task
from django.db.models import F, Sum
from django.utils import timezone
from PIL import Image

from apps.core.images import build_renditions
from apps.core.models import AdminNotification

logger = logging.getLogger(__name__)


@shared_task
def build_image_renditions(image_id: int) -> None:
    from .models import ProductImage

    image = ProductImage.objects.filter(pk=image_id).first()
    if image is None:
        return
    renditions = build_renditions(image.image)
    image.image.open("rb")
    try:
        with Image.open(image.image) as img:
            width, height = img.size
    finally:
        image.image.close()
    image.renditions = renditions
    image.width, image.height = width, height
    image.save(update_fields=["renditions", "width", "height"])


@shared_task
def recompute_trending_scores() -> int:
    """Trending = recent views (7d) weighted with recent units sold (14d), decayed by age of the signal."""
    from apps.catalog.models import Product, ProductView

    today = timezone.localdate()
    views = dict(
        ProductView.objects.filter(date__gte=today - timedelta(days=7))
        .values("product_id")
        .annotate(total=Sum("views"))
        .values_list("product_id", "total")
    )
    sold = _recent_units_sold(days=14)
    products = list(Product.objects.only("id", "trending_score"))
    for product in products:
        product.trending_score = views.get(product.pk, 0) * 1.0 + sold.get(product.pk, 0) * 8.0
    Product.objects.bulk_update(products, ["trending_score"], batch_size=500)
    return len(products)


def _recent_units_sold(days: int) -> dict[int, int]:
    from apps.orders.models import Order, OrderItem

    since = timezone.now() - timedelta(days=days)
    rows = (
        OrderItem.objects.filter(order__placed_at__gte=since, variant__isnull=False)
        .exclude(order__status__in=Order.UNSUCCESSFUL_STATUSES)
        .values("variant__product_id")
        .annotate(units=Sum("quantity"))
    )
    return {row["variant__product_id"]: row["units"] for row in rows}


@shared_task
def notify_low_stock() -> int:
    """Raise one admin notification per low-stock variant per day."""
    from apps.catalog.models import ProductVariant
    from apps.core.models import StoreSettings

    default = StoreSettings.load().low_stock_threshold_default
    today = timezone.localdate().isoformat()
    low = ProductVariant.objects.filter(is_active=True, product__is_active=True).select_related("product")
    low = low.filter(stock__lte=F("low_stock_threshold")) | low.filter(
        low_stock_threshold__isnull=True, stock__lte=default
    )
    created = 0
    for variant in low:
        key = f"low-stock:{variant.pk}:{today}"
        if AdminNotification.objects.filter(dedupe_key=key).exists():
            continue
        AdminNotification.objects.create(
            kind=AdminNotification.Kind.LOW_STOCK,
            title=f"Low stock: {variant.product.name} ({variant.sku}) has {variant.stock} left",
            link=f"/admin/inventory?search={variant.sku}",
            payload={"variant_id": variant.pk, "stock": variant.stock},
            dedupe_key=key,
        )
        created += 1
    return created
