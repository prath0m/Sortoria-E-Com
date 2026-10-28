"""Keep Product's denormalised columns (price range, stock, rating, search vector) in step."""

from django.contrib.postgres.search import SearchVector
from django.db.models import Avg, CharField, Count, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce

from apps.catalog.models import Brand, Category, Product
from apps.offers.services.flash import effective_price, live_flash_items


def refresh_products(product_ids) -> None:
    product_ids = list(product_ids)
    if not product_ids:
        return
    flash = live_flash_items(product_ids)
    products = Product.objects.filter(pk__in=product_ids).prefetch_related("variants")
    updates = []
    for product in products:
        variants = [v for v in product.variants.all() if v.is_active]
        item = flash.get(product.pk)
        if variants:
            prices = [effective_price(v.price_paise, item) for v in variants]
            cheapest = min(variants, key=lambda v: effective_price(v.price_paise, item))
            product.min_price_paise = min(prices)
            product.max_price_paise = max(prices)
            product.mrp_paise = cheapest.mrp_paise
            product.max_discount_pct = max(
                round((v.mrp_paise - effective_price(v.price_paise, item)) * 100 / v.mrp_paise)
                for v in variants
            )
            product.total_stock = sum(max(v.stock, 0) for v in variants)
            product.in_stock = product.total_stock > 0
        else:
            product.min_price_paise = product.max_price_paise = product.mrp_paise = 0
            product.max_discount_pct = 0
            product.total_stock = 0
            product.in_stock = False
        updates.append(product)
    Product.objects.bulk_update(
        updates,
        ["min_price_paise", "max_price_paise", "mrp_paise", "max_discount_pct", "total_stock", "in_stock"],
    )


def _name_of(model):
    return Coalesce(
        Subquery(model.objects.filter(pk=OuterRef(f"{model.__name__.lower()}_id")).values("name")[:1]),
        Value(""),
        output_field=CharField(),
    )


def refresh_search_vectors(product_ids) -> None:
    # UPDATE can't follow joins, so brand/category names come in through correlated subqueries.
    Product.objects.filter(pk__in=list(product_ids)).update(
        search_vector=(
            SearchVector("name", weight="A", config="english")
            + SearchVector(_name_of(Brand), weight="B", config="english")
            + SearchVector(_name_of(Category), weight="B", config="english")
            + SearchVector("short_description", weight="C", config="english")
            + SearchVector("description", weight="D", config="english")
        )
    )


def refresh_ratings(product_id: int) -> None:
    from apps.reviews.models import Review

    stats = Review.objects.filter(product_id=product_id, status=Review.Status.APPROVED).aggregate(
        avg=Avg("rating"), count=Count("id")
    )
    Product.objects.filter(pk=product_id).update(
        rating_avg=round(stats["avg"] or 0, 2), rating_count=stats["count"] or 0
    )
