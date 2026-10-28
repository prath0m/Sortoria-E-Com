import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from tests.factories import BrandFactory, attr_value, attribute, make_category, make_product

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def catalog():
    electronics = make_category("Electronics")
    phones = make_category("Smartphones", electronics)
    audio = make_category("Audio", electronics)
    fashion = make_category("Fashion")
    shirts = make_category("Shirts", fashion)

    colour = attribute("Colour", kind="swatch")
    storage = attribute("Storage", unit="GB")
    size = attribute("Size")
    black, white = attr_value(colour, "Black", hex="#111111"), attr_value(colour, "White", hex="#FAFAFA")
    gb128, gb256 = attr_value(storage, "128 GB"), attr_value(storage, "256 GB")
    small, medium = attr_value(size, "S"), attr_value(size, "M")
    phones.filterable_attributes.set([colour, storage])
    fashion.filterable_attributes.set([colour, size])

    lumen = BrandFactory(name="Lumen")
    weave = BrandFactory(name="Weave & Co")

    phone = make_product(
        "Lumen One Smartphone",
        category=phones,
        brand=lumen,
        tax_rate=18,
        variants=[
            {"options": [black, gb128], "price": 5499900, "mrp": 5999900, "stock": 5},
            {"options": [white, gb256], "price": 6499900, "mrp": 6999900, "stock": 0},
        ],
    )
    buds = make_product(
        "Lumen Air Earbuds", category=audio, brand=lumen, price=799900, mrp=999900, stock=0, sales_count=50
    )
    shirt = make_product(
        "Linen Camp Shirt",
        category=shirts,
        brand=weave,
        tax_rate=5,
        variants=[
            {"options": [white, small], "price": 349900, "stock": 3},
            {"options": [white, medium], "price": 349900, "stock": 4},
        ],
    )
    return {"phones": phones, "electronics": electronics, "phone": phone, "buds": buds, "shirt": shirt}


def slugs(response):
    return [p["slug"] for p in response.data["results"]]


def test_category_includes_descendants(api, catalog):
    response = api.get("/api/v1/products/", {"category": "electronics"})
    assert set(slugs(response)) == {catalog["phone"].slug, catalog["buds"].slug}


def test_attribute_filter_matches_any_variant(api, catalog):
    response = api.get("/api/v1/products/", {"attr.storage": "256-gb"})
    assert slugs(response) == [catalog["phone"].slug]
    response = api.get("/api/v1/products/", {"attr.colour": "white", "attr.size": "m"})
    assert slugs(response) == [catalog["shirt"].slug]


def test_price_filter_uses_rupees_and_sort(api, catalog):
    response = api.get("/api/v1/products/", {"price_max": 10000, "sort": "price_asc"})
    assert slugs(response) == [catalog["shirt"].slug, catalog["buds"].slug]


def test_stock_and_discount_filters(api, catalog):
    in_stock = slugs(api.get("/api/v1/products/", {"in_stock": "1"}))
    assert catalog["buds"].slug not in in_stock
    on_sale = slugs(api.get("/api/v1/products/", {"on_sale": "1"}))
    assert set(on_sale) == {catalog["phone"].slug, catalog["buds"].slug}


def test_search_matches_words_and_typos(api, catalog):
    assert slugs(api.get("/api/v1/products/", {"q": "earbuds"})) == [catalog["buds"].slug]
    assert catalog["shirt"].slug in slugs(api.get("/api/v1/products/", {"q": "linnen shirt"}))


def test_card_payload(api, catalog):
    card = api.get("/api/v1/products/", {"q": "Lumen One"}).data["results"][0]
    assert card["price_paise"] == 5499900
    assert card["mrp_paise"] == 5999900
    assert card["discount_pct"] == 8
    assert card["in_stock"] is True
    assert {s["slug"] for s in card["swatches"]} == {"black", "white"}


def test_facets_count_and_exclude_own_filter(api, catalog):
    data = api.get("/api/v1/products/facets/", {"category": "smartphones", "attr.colour": "black"}).data
    colour = next(a for a in data["attributes"] if a["slug"] == "colour")
    # Colour counts ignore the colour filter itself, so shoppers can switch selections.
    assert {v["slug"]: v["count"] for v in colour["values"]} == {"black": 1, "white": 1}
    assert next(v for v in colour["values"] if v["slug"] == "black")["selected"]
    assert [a["slug"] for a in data["attributes"]] == ["colour", "storage"]
    assert data["total"] == 1


def test_product_detail_has_axes_variants_and_breadcrumbs(api, catalog):
    data = api.get(f"/api/v1/products/{catalog['phone'].slug}/").data
    assert [b["slug"] for b in data["breadcrumbs"]] == ["electronics", "smartphones"]
    assert [a["slug"] for a in data["axes"]] == ["colour", "storage"]
    assert len(data["variants"]) == 2
    assert data["variants"][0]["options"] == {"colour": "black", "storage": "128-gb"}


def test_inactive_products_are_hidden(api, catalog):
    catalog["shirt"].is_active = False
    catalog["shirt"].save()
    assert api.get(f"/api/v1/products/{catalog['shirt'].slug}/").status_code == 404


def test_navigation_tree(api, catalog):
    tree = api.get("/api/v1/store/navigation/").data["categories"]
    electronics = next(c for c in tree if c["slug"] == "electronics")
    assert {c["slug"] for c in electronics["children"]} == {"smartphones", "audio"}


def test_suggestions(api, catalog):
    data = api.get("/api/v1/search/suggest/", {"q": "lumen"}).data
    assert {b["slug"] for b in data["brands"]} == {"lumen"}
    assert len(data["products"]) == 2


def test_listing_query_count_is_constant(api, catalog):
    for i in range(6):
        make_product(f"Extra Shirt {i}", category=catalog["phones"])
    with CaptureQueriesContext(connection) as ctx:
        response = api.get("/api/v1/products/")
    assert response.status_code == 200
    assert len(ctx.captured_queries) <= 12, [q["sql"] for q in ctx.captured_queries]
