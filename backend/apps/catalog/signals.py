from django.db import transaction
from django.db.models.signals import m2m_changed, post_delete, post_save
from django.dispatch import receiver

from apps.core import caching

from .models import Attribute, AttributeValue, Brand, Category, Product, ProductImage, ProductVariant
from .tasks import build_image_renditions


def _bump_catalog(**_kwargs):
    caching.bump(caching.CATALOG, caching.HOME)


def _bump_navigation(**_kwargs):
    caching.bump(caching.NAVIGATION, caching.CATALOG, caching.HOME)


for model in (Product, ProductVariant, Brand, Attribute, AttributeValue):
    post_save.connect(_bump_catalog, sender=model, dispatch_uid=f"bump-catalog-save-{model.__name__}")
    post_delete.connect(_bump_catalog, sender=model, dispatch_uid=f"bump-catalog-del-{model.__name__}")
post_save.connect(_bump_navigation, sender=Category, dispatch_uid="bump-nav-save")
post_delete.connect(_bump_navigation, sender=Category, dispatch_uid="bump-nav-del")


@receiver(post_save, sender=ProductVariant, dispatch_uid="variant-refresh-aggregates")
@receiver(post_delete, sender=ProductVariant, dispatch_uid="variant-delete-refresh-aggregates")
def _variant_changed(sender, instance, **kwargs):
    from .services.aggregates import refresh_products

    product_id = instance.product_id
    transaction.on_commit(lambda: refresh_products([product_id]))


@receiver(post_save, sender=Product, dispatch_uid="product-refresh-search")
def _product_saved(sender, instance, **kwargs):
    from .services.aggregates import refresh_search_vectors

    product_id = instance.pk
    transaction.on_commit(lambda: refresh_search_vectors([product_id]))


@receiver(post_save, sender=ProductImage, dispatch_uid="image-renditions")
def _image_saved(sender, instance, created, update_fields=None, **kwargs):
    if update_fields and set(update_fields) <= {"renditions", "width", "height", "position", "alt_text"}:
        return
    image_id = instance.pk
    transaction.on_commit(lambda: build_image_renditions.delay(image_id))
    _bump_catalog()


@receiver(m2m_changed, sender=ProductVariant.option_values.through, dispatch_uid="variant-options-changed")
def _variant_options_changed(**_kwargs):
    _bump_catalog()
