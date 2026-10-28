from django.db import transaction
from django.db.models import F

from apps.catalog.models import ProductVariant, StockMovement
from apps.catalog.services.aggregates import refresh_products
from apps.core.exceptions import ConflictError


@transaction.atomic
def adjust_stock(variant_id: int, delta: int, reason: str, *, reference: str = "", actor=None) -> int:
    """Change a variant's stock atomically and log the movement. Returns the new balance.

    Negative deltas that would take stock below zero raise ConflictError.
    """
    variant = ProductVariant.objects.select_for_update().get(pk=variant_id)
    new_balance = variant.stock + delta
    if new_balance < 0:
        raise ConflictError(
            f"Only {variant.stock} left of {variant.sku}.",
            code="insufficient_stock",
            extra={"variant_id": variant.pk, "available": variant.stock},
        )
    ProductVariant.objects.filter(pk=variant.pk).update(stock=F("stock") + delta)
    StockMovement.objects.create(
        variant=variant,
        delta=delta,
        balance_after=new_balance,
        reason=reason,
        reference=reference,
        actor=actor,
    )
    product_id = variant.product_id
    transaction.on_commit(lambda: refresh_products([product_id]))
    return new_balance


@transaction.atomic
def set_stock(variant_id: int, quantity: int, reason: str, *, reference: str = "", actor=None) -> int:
    variant = ProductVariant.objects.select_for_update().get(pk=variant_id)
    delta = quantity - variant.stock
    if delta:
        return adjust_stock(variant.pk, delta, reason, reference=reference, actor=actor)
    return variant.stock
