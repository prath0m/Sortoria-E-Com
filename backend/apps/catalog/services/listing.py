"""Product listing: filtering, search, sorting and facet counts, driven by URL query params.

Prices in the URL are whole rupees (readable, shareable links); everything internal is paise.
"""

import re
from collections import defaultdict
from dataclasses import dataclass, field

from django.contrib.postgres.search import SearchQuery, SearchRank, TrigramSimilarity
from django.db.models import F, Max, Min, Q
from django.utils import timezone

from apps.catalog.models import Attribute, AttributeValue, Brand, Category, Product, ProductVariant

SORTS = {
    "popular": ("-sales_count", "-trending_score", "-rating_avg"),
    "trending": ("-trending_score", "-sales_count"),
    "price_asc": ("min_price_paise", "-sales_count"),
    "price_desc": ("-min_price_paise", "-sales_count"),
    "newest": ("-published_at",),
    "rating": ("-rating_avg", "-rating_count"),
    "discount": ("-max_discount_pct", "-sales_count"),
}
RATING_BUCKETS = (4, 3, 2)
DISCOUNT_BUCKETS = (10, 20, 30, 50)


def _int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _list(params, key):
    values = params.getlist(key) if hasattr(params, "getlist") else [params.get(key)]
    out = []
    for raw in values:
        if raw:
            out.extend(part for part in str(raw).split(",") if part)
    return out


@dataclass
class ListingParams:
    category: Category | None = None
    brands: list[str] = field(default_factory=list)
    attrs: dict[str, list[str]] = field(default_factory=dict)
    price_min: int | None = None
    price_max: int | None = None
    rating_min: int | None = None
    in_stock: bool = False
    on_sale: bool = False
    discount_min: int | None = None
    q: str = ""
    sort: str = "popular"
    featured: bool = False
    new: bool = False

    @classmethod
    def from_query(cls, params, *, category=None):
        attrs = {}
        for key in params:
            if key.startswith("attr."):
                values = _list(params, key)
                if values:
                    attrs[key[5:]] = values
        if category is None and params.get("category"):
            category = Category.objects.filter(slug=params["category"], is_active=True).first()
        q = (params.get("q") or "").strip()[:100]
        sort = params.get("sort") or ("relevance" if q else "popular")
        if sort not in SORTS and not (sort == "relevance" and q):
            sort = "popular"
        price_min = _int(params.get("price_min"))
        price_max = _int(params.get("price_max"))
        return cls(
            category=category,
            brands=_list(params, "brand"),
            attrs=attrs,
            price_min=price_min * 100 if price_min is not None else None,
            price_max=price_max * 100 if price_max is not None else None,
            rating_min=_int(params.get("rating_min")),
            in_stock=params.get("in_stock") in ("1", "true"),
            on_sale=params.get("on_sale") in ("1", "true"),
            discount_min=_int(params.get("discount_min")),
            q=q,
            sort=sort,
            featured=params.get("featured") in ("1", "true"),
            new=params.get("new") in ("1", "true"),
        )


def visible_products():
    return Product.objects.filter(is_active=True, published_at__lte=timezone.now(), category__is_active=True).exclude(
        min_price_paise=0
    )


def category_filter(category: Category) -> Q:
    extra = Product.extra_categories.through.objects.filter(category__path__startswith=category.path)
    return Q(category__path__startswith=category.path) | Q(pk__in=extra.values("product_id"))


def _products_with_values(value_ids):
    via_variants = ProductVariant.objects.filter(is_active=True, option_values__in=value_ids).values("product_id")
    via_product = Product.attribute_values.through.objects.filter(attributevalue_id__in=value_ids).values("product_id")
    return Q(pk__in=via_variants) | Q(pk__in=via_product)


def apply_filters(qs, p: ListingParams, *, skip: str | None = None):
    if p.category:
        qs = qs.filter(category_filter(p.category))
    if p.brands and skip != "brand":
        qs = qs.filter(brand__slug__in=p.brands)
    for attr_slug, value_slugs in p.attrs.items():
        if skip == f"attr.{attr_slug}":
            continue
        value_ids = AttributeValue.objects.filter(attribute__slug=attr_slug, slug__in=value_slugs).values("id")
        qs = qs.filter(_products_with_values(value_ids))
    if skip != "price":
        if p.price_min is not None:
            qs = qs.filter(min_price_paise__gte=p.price_min)
        if p.price_max is not None:
            qs = qs.filter(min_price_paise__lte=p.price_max)
    if p.rating_min and skip != "rating":
        qs = qs.filter(rating_avg__gte=p.rating_min)
    if p.in_stock and skip != "availability":
        qs = qs.filter(in_stock=True)
    if p.on_sale and skip != "discount":
        qs = qs.filter(max_discount_pct__gt=0)
    if p.discount_min and skip != "discount":
        qs = qs.filter(max_discount_pct__gte=p.discount_min)
    if p.featured:
        qs = qs.filter(is_featured=True)
    if p.new:
        qs = qs.filter(published_at__gte=timezone.now() - timezone.timedelta(days=30))
    if p.q:
        qs = apply_search(qs, p.q)
    return qs


def _prefix_query(q: str) -> SearchQuery | None:
    """`head phon` -> to_tsquery('head:* & phon:*') so partial words match while typing."""
    tokens = [re.sub(r"[^\w]", "", t) for t in q.split()]
    tokens = [t for t in tokens if t]
    if not tokens:
        return None
    return SearchQuery(" & ".join(f"{t}:*" for t in tokens), search_type="raw", config="english")


def apply_search(qs, q: str):
    """Full-text match, prefix match (for as-you-type) and trigram similarity (for typos)."""
    query = SearchQuery(q, search_type="websearch", config="english")
    condition = Q(search_vector=query) | Q(similarity__gt=0.2) | Q(name__icontains=q)
    prefix = _prefix_query(q)
    if prefix is not None:
        condition |= Q(search_vector=prefix)
    return qs.annotate(
        rank=SearchRank(F("search_vector"), prefix if prefix is not None else query),
        similarity=TrigramSimilarity("name", q),
    ).filter(condition)


def sorted_listing(qs, p: ListingParams):
    if p.sort == "relevance" and p.q:
        return qs.order_by(F("rank").desc(nulls_last=True), F("similarity").desc(), "-sales_count", "pk")
    return qs.order_by(*SORTS.get(p.sort, SORTS["popular"]), "pk")


def listing_queryset(p: ListingParams):
    return sorted_listing(apply_filters(visible_products(), p), p)


def facet_attributes(p: ListingParams):
    if p.category:
        chain = list(p.category.get_ancestors()) + [p.category]
        attrs = Attribute.objects.filter(categories__in=chain, is_filterable=True).distinct()
        if attrs.exists():
            return list(attrs.order_by("position", "id"))
    return list(Attribute.objects.filter(is_filterable=True).order_by("position", "id"))


def _value_product_pairs(product_ids, attribute_ids):
    via_variants = (
        ProductVariant.option_values.through.objects.filter(
            productvariant__product_id__in=product_ids,
            productvariant__is_active=True,
            attributevalue__attribute_id__in=attribute_ids,
        )
        .values_list("attributevalue_id", "productvariant__product_id")
        .distinct()
    )
    via_product = (
        Product.attribute_values.through.objects.filter(
            product_id__in=product_ids, attributevalue__attribute_id__in=attribute_ids
        )
        .values_list("attributevalue_id", "product_id")
        .distinct()
    )
    return set(via_variants) | set(via_product)


def build_facets(p: ListingParams) -> dict:
    base = visible_products()

    def ids(skip=None):
        return apply_filters(base, p, skip=skip).values("pk")

    brand_counts = defaultdict(int)
    for brand_id in apply_filters(base, p, skip="brand").values_list("brand_id", flat=True):
        if brand_id:
            brand_counts[brand_id] += 1
    brands = [
        {"slug": b.slug, "name": b.name, "count": brand_counts[b.pk], "selected": b.slug in p.brands}
        for b in Brand.objects.filter(pk__in=brand_counts).order_by("name")
    ]

    attributes = []
    for attr in facet_attributes(p):
        pairs = _value_product_pairs(ids(skip=f"attr.{attr.slug}"), [attr.pk])
        counts = defaultdict(int)
        for value_id, _product_id in pairs:
            counts[value_id] += 1
        if not counts:
            continue
        selected = set(p.attrs.get(attr.slug, []))
        values = [
            {
                "slug": v.slug,
                "value": v.value,
                "hex": v.hex,
                "count": counts[v.pk],
                "selected": v.slug in selected,
            }
            for v in attr.values.filter(pk__in=counts).order_by("position", "numeric_value", "value")
        ]
        attributes.append(
            {"slug": attr.slug, "name": attr.name, "kind": attr.kind, "unit": attr.unit, "values": values}
        )

    price_range = apply_filters(base, p, skip="price").aggregate(lo=Min("min_price_paise"), hi=Max("min_price_paise"))
    rating_qs = apply_filters(base, p, skip="rating")
    discount_qs = apply_filters(base, p, skip="discount")
    stock_qs = apply_filters(base, p, skip="availability")

    return {
        "brands": brands,
        "attributes": attributes,
        "price": {
            "min": (price_range["lo"] or 0) // 100,
            "max": -(-(price_range["hi"] or 0) // 100),
            "selected_min": p.price_min // 100 if p.price_min is not None else None,
            "selected_max": p.price_max // 100 if p.price_max is not None else None,
        },
        "ratings": [
            {"min": r, "count": rating_qs.filter(rating_avg__gte=r).count(), "selected": p.rating_min == r}
            for r in RATING_BUCKETS
        ],
        "discounts": [
            {
                "min": d,
                "count": discount_qs.filter(max_discount_pct__gte=d).count(),
                "selected": p.discount_min == d,
            }
            for d in DISCOUNT_BUCKETS
        ],
        "availability": {"in_stock": stock_qs.filter(in_stock=True).count(), "selected": p.in_stock},
        "total": apply_filters(base, p).count(),
    }
