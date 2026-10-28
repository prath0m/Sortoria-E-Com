from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.core import caching

from .models import Bundle, BundleItem, Coupon, FlashSale, FlashSaleItem


@receiver(post_save, sender=FlashSaleItem, dispatch_uid="flash-item-saved")
@receiver(post_delete, sender=FlashSaleItem, dispatch_uid="flash-item-deleted")
def _flash_item_changed(sender, instance, **kwargs):
    from apps.catalog.services.aggregates import refresh_products

    product_id = instance.product_id
    transaction.on_commit(lambda: refresh_products([product_id]))
    caching.bump(caching.OFFERS, caching.CATALOG, caching.HOME)


@receiver(post_save, sender=FlashSale, dispatch_uid="flash-sale-saved")
def _flash_sale_saved(sender, instance, **kwargs):
    from apps.catalog.services.aggregates import refresh_products

    ids = list(instance.items.values_list("product_id", flat=True))
    transaction.on_commit(lambda: refresh_products(ids))
    caching.bump(caching.OFFERS, caching.CATALOG, caching.HOME)


for model in (Bundle, BundleItem, Coupon):
    post_save.connect(
        lambda **kw: caching.bump(caching.OFFERS, caching.HOME),
        sender=model,
        weak=False,
        dispatch_uid=f"offers-bump-{model.__name__}",
    )
