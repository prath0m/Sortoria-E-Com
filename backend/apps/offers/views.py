from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.catalog.services.listing import visible_products
from apps.catalog.views import card_queryset, serialize_cards
from apps.core import caching

from .models import Bundle, BundleItem, FlashSale, FlashSaleItem


def _sale_payload(sale: FlashSale, request) -> dict:
    items = list(sale.items.all())
    visible = {
        p.pk: p for p in card_queryset(visible_products().filter(pk__in=[i.product_id for i in items]))
    }
    products = [visible[i.product_id] for i in items if i.product_id in visible]
    caps = {i.product_id: {"cap": i.quantity_cap, "sold": i.sold_count} for i in items}
    cards = serialize_cards(products, request)
    for card in cards:
        card["sale_progress"] = caps.get(card["id"])
    return {
        "id": sale.pk,
        "kind": sale.kind,
        "title": sale.title,
        "slug": sale.slug,
        "subtitle": sale.subtitle,
        "banner_image": sale.banner_image.url if sale.banner_image else None,
        "starts_at": sale.starts_at,
        "ends_at": sale.ends_at,
        "is_live": sale.is_live,
        "products": cards,
    }


def _sales(kind: str, request):
    now = timezone.now()
    sales = (
        FlashSale.objects.filter(
            kind=kind, is_active=True, ends_at__gt=now, starts_at__lte=now + timezone.timedelta(days=2)
        )
        .prefetch_related(Prefetch("items", queryset=FlashSaleItem.objects.order_by("position", "id")))
        .order_by("starts_at", "position")
    )
    return [_sale_payload(s, request) for s in sales]


class FlashSalesView(APIView):
    """Live flash sales, plus any starting within two days (shown with a 'starts in' countdown)."""

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(
            caching.cached(caching.OFFERS, "flash", lambda: _sales(FlashSale.Kind.FLASH, request), 60)
        )


class DailyDealsView(APIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(
            caching.cached(caching.OFFERS, "deals", lambda: _sales(FlashSale.Kind.DAILY_DEAL, request), 60)
        )


class FlashSaleDetailView(APIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, slug):
        sale = get_object_or_404(
            FlashSale.objects.filter(is_active=True).prefetch_related(
                Prefetch("items", queryset=FlashSaleItem.objects.order_by("position", "id"))
            ),
            slug=slug,
        )
        return Response(_sale_payload(sale, request))


def _bundle_payload(bundle: Bundle, request) -> dict:
    items = list(bundle.items.all())
    products = {p.pk: p for p in card_queryset(Product.objects.filter(pk__in=[i.product_id for i in items]))}
    cards = serialize_cards([products[i.product_id] for i in items if i.product_id in products], request)
    quantities = {i.product_id: i.quantity for i in items}
    value = sum(c["price_paise"] * quantities[c["id"]] for c in cards)
    if bundle.discount_type == Bundle.DiscountType.PERCENT:
        price = value - value * bundle.value // 100
    elif bundle.discount_type == Bundle.DiscountType.FIXED_OFF:
        price = max(0, value - bundle.value)
    else:
        price = min(value, bundle.value)
    return {
        "title": bundle.title,
        "slug": bundle.slug,
        "description": bundle.description,
        "image": bundle.image.url if bundle.image else None,
        "ends_at": bundle.ends_at,
        "items": [{"quantity": quantities[c["id"]], "product": c} for c in cards],
        "value_paise": value,
        "bundle_price_paise": price,
        "saving_paise": value - price,
    }


class BundlesView(APIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        bundles = Bundle.objects.live().prefetch_related(
            Prefetch("items", queryset=BundleItem.objects.order_by("id"))
        )
        return Response([_bundle_payload(b, request) for b in bundles])


class BundleDetailView(APIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, slug):
        bundle = get_object_or_404(Bundle.objects.live().prefetch_related("items"), slug=slug)
        return Response(_bundle_payload(bundle, request))
