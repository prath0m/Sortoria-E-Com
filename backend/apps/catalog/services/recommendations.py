"""Related products. One entry point so a smarter recommender can replace it later."""

from django.db.models import Case, IntegerField, Q, Value, When

from apps.catalog.models import Product
from apps.catalog.services.listing import visible_products


def related_products(product: Product, limit: int = 12):
    """Same leaf category first, then siblings under the parent, preferring the same brand."""
    parent_path = product.category.path[: -product.category.steplen] or product.category.path
    return (
        visible_products()
        .exclude(pk=product.pk)
        .filter(Q(category=product.category) | Q(category__path__startswith=parent_path))
        .annotate(
            affinity=Case(
                When(category=product.category, then=Value(2)), default=Value(0), output_field=IntegerField()
            )
            + Case(When(brand=product.brand, then=Value(1)), default=Value(0), output_field=IntegerField())
        )
        .order_by("-affinity", "-in_stock", "-sales_count", "-rating_avg")[:limit]
    )
