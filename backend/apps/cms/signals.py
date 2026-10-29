from django.db.models.signals import m2m_changed, post_delete, post_save

from apps.core import caching
from apps.core.tasks import register_renditions

from .models import Counter, HeroSlide, HomeSection, Page, PromoBanner, Testimonial, TrustBadge


def _bump_home(**_kwargs):
    caching.bump(caching.HOME)


for model in (HeroSlide, HomeSection, PromoBanner, TrustBadge, Counter, Testimonial):
    post_save.connect(_bump_home, sender=model, dispatch_uid=f"home-save-{model.__name__}")
    post_delete.connect(_bump_home, sender=model, dispatch_uid=f"home-delete-{model.__name__}")
m2m_changed.connect(_bump_home, sender=HomeSection.products.through, dispatch_uid="home-products")
m2m_changed.connect(_bump_home, sender=HomeSection.categories.through, dispatch_uid="home-categories")


def _bump_pages(**_kwargs):
    # Page meta and the sitemap are cached under the catalogue namespace.
    caching.bump(caching.CATALOG)


post_save.connect(_bump_pages, sender=Page, dispatch_uid="page-save")
post_delete.connect(_bump_pages, sender=Page, dispatch_uid="page-delete")

for model in (HeroSlide, HomeSection, PromoBanner):
    register_renditions(model)
