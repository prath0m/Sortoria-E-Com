from django.contrib.postgres.search import TrigramSimilarity
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core import caching
from apps.offers.services.flash import live_flash_items

from .models import Brand, Category, Product, ProductImage, ProductVariant
from .serializers import (
    BrandSerializer,
    CategoryDetailSerializer,
    ProductCardSerializer,
    ProductDetailSerializer,
)
from .services.listing import ListingParams, build_facets, listing_queryset, visible_products
from .services.navigation import category_tree
from .services.recommendations import related_products

LISTING_PARAMS = [
    OpenApiParameter("category", str),
    OpenApiParameter("brand", str, many=True),
    OpenApiParameter("price_min", int, description="Whole rupees"),
    OpenApiParameter("price_max", int, description="Whole rupees"),
    OpenApiParameter("rating_min", int),
    OpenApiParameter("in_stock", bool),
    OpenApiParameter("on_sale", bool),
    OpenApiParameter("discount_min", int),
    OpenApiParameter("q", str),
    OpenApiParameter(
        "sort",
        str,
        enum=["relevance", "popular", "trending", "price_asc", "price_desc", "newest", "rating", "discount"],
    ),
    OpenApiParameter("attr.<slug>", str, description="Attribute filter, e.g. attr.colour=black,navy"),
]


def card_queryset(qs):
    return qs.select_related("brand", "category").prefetch_related(
        Prefetch(
            "images", queryset=ProductImage.objects.select_related("option_value").order_by("position", "id")
        ),
        Prefetch(
            "variants",
            queryset=ProductVariant.objects.filter(is_active=True).prefetch_related(
                "option_values__attribute"
            ),
        ),
    )


def serialize_cards(products, request=None):
    products = list(products)
    flash = live_flash_items([p.pk for p in products])
    return ProductCardSerializer(products, many=True, context={"flash": flash, "request": request}).data


class CategoryTreeView(APIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(category_tree(menu_only=False))


class NavigationView(APIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response({"categories": category_tree(menu_only=True)})


class CategoryDetailView(generics.RetrieveAPIView):
    serializer_class = CategoryDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Category.objects.filter(is_active=True)


class BrandListView(generics.ListAPIView):
    serializer_class = BrandSerializer
    pagination_class = None

    def get_queryset(self):
        return Brand.objects.filter(is_active=True)


class BrandDetailView(generics.RetrieveAPIView):
    serializer_class = BrandSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Brand.objects.filter(is_active=True)


class ProductListView(generics.ListAPIView):
    serializer_class = ProductCardSerializer
    filter_backends: list = []

    def get_throttles(self):
        if self.request.query_params.get("q"):
            self.throttle_scope = "search"
            return [*super().get_throttles(), ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        params = ListingParams.from_query(self.request.query_params)
        return card_queryset(listing_queryset(params))

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "flash": self._flash}

    def paginate_queryset(self, queryset):
        page = super().paginate_queryset(queryset)
        self._flash = live_flash_items([p.pk for p in page or []])
        return page

    @extend_schema(parameters=LISTING_PARAMS)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class ProductFacetsView(APIView):
    @extend_schema(parameters=LISTING_PARAMS, responses=OpenApiTypes.OBJECT)
    def get(self, request):
        params = ListingParams.from_query(request.query_params)
        cache_key = request.get_full_path()
        return Response(
            caching.cached(caching.CATALOG, f"facets:{cache_key}", lambda: build_facets(params), 300)
        )


def detail_queryset():
    return Product.objects.select_related("brand", "category").prefetch_related(
        Prefetch(
            "images", queryset=ProductImage.objects.select_related("option_value").order_by("position", "id")
        ),
        Prefetch(
            "variants",
            queryset=ProductVariant.objects.filter(is_active=True).prefetch_related(
                "option_values__attribute"
            ),
        ),
        "specs",
        "attribute_values__attribute",
    )


class ProductDetailView(APIView):
    @extend_schema(responses=ProductDetailSerializer)
    def get(self, request, slug):
        product = get_object_or_404(
            detail_queryset().filter(pk__in=visible_products().values("pk")), slug=slug
        )
        flash = live_flash_items([product.pk])
        return Response(ProductDetailSerializer(product, context={"flash": flash, "request": request}).data)


class RelatedProductsView(APIView):
    @extend_schema(responses=ProductCardSerializer(many=True))
    def get(self, request, slug):
        product = get_object_or_404(visible_products(), slug=slug)
        return Response(serialize_cards(card_queryset(related_products(product)), request))


class ProductBatchView(APIView):
    """Cards for a list of ids (recently viewed, guest wishlist), returned in the order requested."""

    @extend_schema(parameters=[OpenApiParameter("ids", str)], responses=ProductCardSerializer(many=True))
    def get(self, request):
        raw = request.query_params.get("ids", "")
        ids = [int(i) for i in raw.split(",") if i.strip().isdigit()][:48]
        products = {p.pk: p for p in card_queryset(visible_products().filter(pk__in=ids))}
        ordered = [products[i] for i in ids if i in products]
        return Response(serialize_cards(ordered, request))


SuggestResponse = inline_serializer(
    "SearchSuggestions",
    fields={
        "products": ProductCardSerializer(many=True),
        "categories": serializers.ListField(child=serializers.DictField()),
        "brands": serializers.ListField(child=serializers.DictField()),
    },
)


class SearchSuggestView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "search"

    @extend_schema(parameters=[OpenApiParameter("q", str)], responses=SuggestResponse)
    def get(self, request):
        q = (request.query_params.get("q") or "").strip()[:60]
        if len(q) < 2:
            return Response({"products": [], "categories": [], "brands": []})
        params = ListingParams(q=q, sort="relevance")
        products = card_queryset(listing_queryset(params))[:6]
        categories = (
            Category.objects.filter(is_active=True)
            .annotate(sim=TrigramSimilarity("name", q))
            .filter(Q(name__icontains=q) | Q(sim__gt=0.3))
            .order_by("-sim")[:4]
        )
        brands = (
            Brand.objects.filter(is_active=True)
            .annotate(sim=TrigramSimilarity("name", q))
            .filter(Q(name__icontains=q) | Q(sim__gt=0.3))
            .order_by("-sim")[:4]
        )
        return Response(
            {
                "products": serialize_cards(products, request),
                "categories": [{"name": c.name, "slug": c.slug} for c in categories],
                "brands": [{"name": b.name, "slug": b.slug} for b in brands],
            }
        )
