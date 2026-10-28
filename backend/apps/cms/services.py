"""Assemble the homepage from admin-ordered sections, each resolved to the data it needs."""

from django.conf import settings
from django.db.models import Prefetch
from django.utils import timezone

from apps.catalog.services.listing import ListingParams, listing_queryset, visible_products
from apps.catalog.services.navigation import category_tree
from apps.catalog.views import card_queryset, serialize_cards
from apps.core import caching
from apps.core.emails import send_email
from apps.core.exceptions import DomainError
from apps.offers.models import Bundle, BundleItem, FlashSale, FlashSaleItem

from .models import Counter, HeroSlide, HomeSection, NewsletterSubscriber, PromoBanner, Testimonial, TrustBadge


def _url(field):
    return field.url if field else None


def hero_slides() -> list[dict]:
    return [
        {
            "id": s.pk,
            "eyebrow": s.eyebrow,
            "headline": s.headline,
            "subtext": s.subtext,
            "image": _url(s.image),
            "mobile_image": _url(s.mobile_image),
            "image_alt": s.image_alt,
            "cta_label": s.cta_label,
            "cta_url": s.cta_url,
            "secondary_cta_label": s.secondary_cta_label,
            "secondary_cta_url": s.secondary_cta_url,
            "text_theme": s.text_theme,
            "text_align": s.text_align,
        }
        for s in HeroSlide.objects.live()
    ]


def banners(placement: str) -> list[dict]:
    return [
        {
            "id": b.pk,
            "eyebrow": b.eyebrow,
            "title": b.title,
            "subtitle": b.subtitle,
            "image": _url(b.image),
            "mobile_image": _url(b.mobile_image),
            "cta_label": b.cta_label,
            "cta_url": b.cta_url,
            "badge_text": b.badge_text,
        }
        for b in PromoBanner.objects.live().filter(placement=placement)
    ]


def _products(section: HomeSection) -> list[dict]:
    if section.type == HomeSection.Type.FEATURED_PRODUCTS:
        picked = list(section.products.values_list("pk", flat=True))
        products = {p.pk: p for p in card_queryset(visible_products().filter(pk__in=picked))}
        ordered = (
            [products[pk] for pk in picked if pk in products]
            if picked
            else list(card_queryset(visible_products().filter(is_featured=True))[: section.limit])
        )
        return serialize_cards(ordered[: section.limit])
    sort = {
        HomeSection.Type.TRENDING: "trending",
        HomeSection.Type.NEW_ARRIVALS: "newest",
        HomeSection.Type.BEST_SELLERS: "popular",
    }[section.type]
    category = section.categories.first()
    qs = listing_queryset(ListingParams(sort=sort, category=category, in_stock=True))
    return serialize_cards(card_queryset(qs)[: section.limit])


def _categories(section: HomeSection) -> list[dict]:
    chosen = list(section.categories.all())
    if chosen:
        return [
            {"id": c.pk, "name": c.name, "slug": c.slug, "image": _url(c.image) or _url(c.menu_image)}
            for c in chosen
            if c.is_active
        ]
    return [{"id": n["id"], "name": n["name"], "slug": n["slug"], "image": n["image"]} for n in category_tree(True)]


def _sale(kind: str) -> dict | None:
    now = timezone.now()
    sale = (
        FlashSale.objects.filter(kind=kind, is_active=True, starts_at__lte=now, ends_at__gt=now)
        .prefetch_related(Prefetch("items", queryset=FlashSaleItem.objects.order_by("position", "id")))
        .order_by("ends_at")
        .first()
    )
    if sale is None:
        return None
    ids = [i.product_id for i in sale.items.all()]
    products = {p.pk: p for p in card_queryset(visible_products().filter(pk__in=ids))}
    return {
        "title": sale.title,
        "slug": sale.slug,
        "subtitle": sale.subtitle,
        "ends_at": sale.ends_at,
        "products": serialize_cards([products[i] for i in ids if i in products]),
    }


def _bundles() -> list[dict]:
    from apps.offers.views import _bundle_payload

    bundles = Bundle.objects.live().prefetch_related(Prefetch("items", queryset=BundleItem.objects.order_by("id")))
    return [_bundle_payload(b, None) for b in bundles]


def _resolve(section: HomeSection) -> dict | None:
    t = HomeSection.Type
    data = None
    if section.type == t.HERO:
        data = hero_slides()
    elif section.type == t.FEATURED_CATEGORIES:
        data = _categories(section)
    elif section.type in HomeSection.PRODUCT_TYPES:
        data = _products(section)
    elif section.type == t.FLASH_SALE:
        data = _sale(FlashSale.Kind.FLASH)
    elif section.type == t.DAILY_DEALS:
        data = _sale(FlashSale.Kind.DAILY_DEAL)
    elif section.type == t.BUNDLES:
        data = _bundles()
    elif section.type == t.PROMO_BANNERS:
        data = banners(PromoBanner.Placement.HOME)
    elif section.type == t.TRUST_BADGES:
        data = [{"icon": b.icon, "title": b.title, "text": b.text} for b in TrustBadge.objects.filter(is_active=True)]
    elif section.type == t.COUNTERS:
        data = [
            {"value": c.value, "prefix": c.prefix, "suffix": c.suffix, "label": c.label}
            for c in Counter.objects.filter(is_active=True)
        ]
    elif section.type == t.TESTIMONIALS:
        data = [
            {"name": x.name, "location": x.location, "quote": x.quote, "rating": x.rating, "avatar": _url(x.avatar)}
            for x in Testimonial.objects.filter(is_active=True)
        ]
    elif section.type in (t.NEWSLETTER, t.EDITORIAL):
        data = {}
    if data is None or (isinstance(data, list) and not data):
        return None  # nothing to show (e.g. no live sale): skip the section entirely
    return {
        "id": section.pk,
        "type": section.type,
        "eyebrow": section.eyebrow,
        "title": section.title,
        "subtitle": section.subtitle,
        "body": section.body,
        "image": _url(section.image),
        "cta_label": section.cta_label,
        "cta_url": section.cta_url,
        "data": data,
    }


def build_homepage() -> list[dict]:
    sections = HomeSection.objects.filter(is_active=True).prefetch_related("categories", "products")
    return [resolved for s in sections if (resolved := _resolve(s))]


def homepage() -> list[dict]:
    # Short TTL so sale windows open and close on time even without an edit to bump the cache.
    return caching.cached(caching.HOME, "sections", build_homepage, timeout=120)


def subscribe(email: str, source: str = "") -> NewsletterSubscriber:
    sub, created = NewsletterSubscriber.objects.get_or_create(email=email.lower(), defaults={"source": source[:40]})
    if not created and sub.status == NewsletterSubscriber.Status.CONFIRMED:
        return sub
    if sub.status == NewsletterSubscriber.Status.UNSUBSCRIBED:
        sub.status = NewsletterSubscriber.Status.PENDING
        sub.save(update_fields=["status", "updated_at"])
    base = settings.FRONTEND_URL.rstrip("/")
    send_email(
        "newsletter_confirm",
        sub.email,
        {
            "confirm_url": f"{base}/newsletter/confirm/{sub.token}",
            "unsubscribe_url": f"{base}/newsletter/unsubscribe/{sub.token}",
        },
    )
    return sub


def confirm(token: str) -> NewsletterSubscriber:
    sub = NewsletterSubscriber.objects.filter(token=token).first()
    if sub is None:
        raise DomainError("This confirmation link isn't valid. Please sign up again.", code="invalid_token")
    if sub.status != NewsletterSubscriber.Status.CONFIRMED:
        sub.status = NewsletterSubscriber.Status.CONFIRMED
        sub.confirmed_at = timezone.now()
        sub.save(update_fields=["status", "confirmed_at", "updated_at"])
    return sub


def unsubscribe(token: str) -> NewsletterSubscriber:
    sub = NewsletterSubscriber.objects.filter(token=token).first()
    if sub is None:
        raise DomainError("This link isn't valid.", code="invalid_token")
    sub.status = NewsletterSubscriber.Status.UNSUBSCRIBED
    sub.save(update_fields=["status", "updated_at"])
    return sub
