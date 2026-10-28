import pytest

from apps.catalog.models import Category, Product, ProductVariant, StockMovement
from apps.core.models import AuditLog
from apps.orders.models import Order, OrderItem
from tests.factories import BrandFactory, attr_value, attribute, make_category, make_product, png_file

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def setup():
    root = make_category("Fashion")
    shirts = make_category("Shirts", root)
    colour, size = attribute("Colour", kind="swatch"), attribute("Size")
    return {
        "root": root,
        "shirts": shirts,
        "brand": BrandFactory(name="Weave & Co"),
        "white": attr_value(colour, "White", hex="#fff"),
        "black": attr_value(colour, "Black", hex="#000"),
        "s": attr_value(size, "S"),
        "m": attr_value(size, "M"),
    }


def payload(setup, **overrides):
    return {
        "name": "Oxford Shirt",
        "brand": setup["brand"].pk,
        "category": setup["shirts"].pk,
        "tax_rate": 5,
        "short_description": "Soft Oxford cloth.",
        "description": "<p>Lovely</p><script>x</script>",
        "variants": [
            {"sku": "ox-w-s", "option_values": [setup["white"].pk, setup["s"].pk], "price_paise": 229000, "stock": 5},
            {"sku": "OX-W-M", "option_values": [setup["white"].pk, setup["m"].pk], "price_paise": 229000, "stock": 3},
        ],
        "specs": [{"group": "Fabric", "key": "Weight", "value": "140 GSM"}],
        **overrides,
    }


def test_customers_and_anonymous_are_refused(api, auth, customer):
    assert api.get("/api/v1/admin/products/").status_code == 401
    assert auth(customer).get("/api/v1/admin/products/").status_code == 403


def test_create_product_with_variants_specs_and_stock(auth, manager, setup):
    response = auth(manager).post("/api/v1/admin/products/", payload(setup), format="json")
    assert response.status_code == 201, response.data
    product = Product.objects.get(pk=response.data["id"])
    assert product.slug == "oxford-shirt" and "script" not in product.description
    assert sorted(product.variants.values_list("sku", flat=True)) == ["OX-W-M", "OX-W-S"]
    assert product.total_stock == 8 and product.min_price_paise == 229000
    assert StockMovement.objects.filter(variant__product=product, reason="initial").count() == 2
    assert AuditLog.objects.filter(action="create", object_type="catalog.Product").exists()


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda p, s: p["variants"].append({**p["variants"][0]}), "own SKU"),
        (lambda p, s: p["variants"][1].update(option_values=[s["white"].pk, s["s"].pk]), "same options"),
        (lambda p, s: p["variants"][1].update(option_values=[s["white"].pk]), "same attributes"),
        (lambda p, s: p["variants"][0].update(compare_at_paise=100), "MRP"),
        (lambda p, s: p.update(category=s["root"].pk), "most specific"),
    ],
)
def test_variant_and_category_validation(auth, manager, setup, change, message):
    body = payload(setup)
    change(body, setup)
    response = auth(manager).post("/api/v1/admin/products/", body, format="json")
    assert response.status_code == 400
    assert message in str(response.data)


def test_update_keeps_sold_variants_and_records_stock_changes(auth, manager, setup):
    client = auth(manager)
    created = client.post("/api/v1/admin/products/", payload(setup), format="json").data
    sold = ProductVariant.objects.get(sku="OX-W-S")
    order = Order.objects.create(
        number="T-1",
        email="a@b.c",
        phone="9876543210",
        status="delivered",
        payment_method="cod",
        shipping_address={},
        billing_address={},
        shipping_method="standard",
        subtotal_paise=1,
        grand_total_paise=1,
    )
    OrderItem.objects.create(
        order=order,
        variant=sold,
        product_name="x",
        sku=sold.sku,
        mrp_paise=1,
        unit_price_paise=1,
        quantity=1,
        tax_rate=5,
        tax_paise=0,
        line_total_paise=1,
    )
    detail = client.get(f"/api/v1/admin/products/{created['id']}/").data
    keep = next(v for v in detail["variants"] if v["sku"] == "OX-W-M")
    body = {
        **payload(setup),
        "variants": [
            {**keep, "stock": 10},
            {"sku": "OX-B-M", "option_values": [setup["black"].pk, setup["m"].pk], "price_paise": 239000, "stock": 2},
        ],
    }
    response = client.put(f"/api/v1/admin/products/{created['id']}/", body, format="json")
    assert response.status_code == 200, response.data
    sold.refresh_from_db()
    assert sold.is_active is False  # kept for order history, hidden from the store
    assert ProductVariant.objects.get(sku="OX-W-M").stock == 10
    assert StockMovement.objects.filter(variant__sku="OX-W-M", reason="manual_adjust", delta=7).exists()
    assert ProductVariant.objects.filter(sku="OX-B-M").exists()
    assert client.delete(f"/api/v1/admin/products/{created['id']}/").status_code in (400, 403)


def test_images_upload_reorder_and_edit(auth, manager, setup):
    client = auth(manager)
    product_id = client.post("/api/v1/admin/products/", payload(setup), format="json").data["id"]
    uploaded = client.post(
        f"/api/v1/admin/products/{product_id}/images/",
        {"files": [png_file("a.png", size=(400, 500)), png_file("b.png", size=(400, 500))]},
        format="multipart",
    ).data
    ids = [img["id"] for img in uploaded]
    reordered = client.post(
        f"/api/v1/admin/products/{product_id}/images/reorder/", {"ids": ids[::-1]}, format="json"
    ).data
    assert [img["id"] for img in reordered] == ids[::-1]
    edited = client.patch(
        f"/api/v1/admin/product-images/{ids[0]}/",
        {"alt_text": "Front view", "option_value": setup["white"].pk},
        format="json",
    )
    assert edited.data["alt_text"] == "Front view"
    bad = client.post(
        f"/api/v1/admin/products/{product_id}/images/",
        {"files": [png_file("x.txt").__class__(b"not an image", name="x.png")]},
        format="multipart",
    )
    assert bad.status_code == 400


def test_bulk_actions_and_delete_needs_admin(auth, manager, admin_user, setup):
    a, b = make_product("A", category=setup["shirts"]), make_product("B", category=setup["shirts"])
    result = (
        auth(manager)
        .post("/api/v1/admin/products/bulk/", {"ids": [a.pk, b.pk], "action": "deactivate"}, format="json")
        .data
    )
    assert result == {"updated": 2} and not Product.objects.filter(is_active=True, pk__in=[a.pk, b.pk]).exists()
    assert (
        auth(manager)
        .post("/api/v1/admin/products/bulk/", {"ids": [a.pk], "action": "delete"}, format="json")
        .status_code
        == 403
    )
    assert (
        auth(admin_user)
        .post("/api/v1/admin/products/bulk/", {"ids": [a.pk], "action": "delete"}, format="json")
        .data["deleted"]
        == 1
    )


def test_category_tree_create_move_and_guarded_delete(auth, manager, setup):
    client = auth(manager)
    created = client.post(
        "/api/v1/admin/categories/", {"name": "Knitwear", "parent": setup["root"].pk}, format="json"
    ).data
    assert created["parent_id"] == setup["root"].pk and created["depth"] == 2
    home = make_category("Home")
    moved = client.patch(f"/api/v1/admin/categories/{created['id']}/", {"parent": home.pk}, format="json").data
    assert moved["parent_id"] == home.pk
    bad = client.patch(f"/api/v1/admin/categories/{home.pk}/", {"parent": created["id"]}, format="json")
    assert bad.status_code == 400  # can't move into own child
    make_product("Cardigan", category=Category.objects.get(pk=created["id"]))
    assert client.delete(f"/api/v1/admin/categories/{home.pk}/").status_code in (400, 403)


def test_attribute_values_in_use_are_protected(auth, manager, setup):
    make_product("Tee", category=setup["shirts"], variants=[{"options": [setup["white"]], "price": 100000, "stock": 1}])
    attr = setup["white"].attribute
    body = {"name": attr.name, "kind": "swatch", "values": [{"id": setup["black"].pk, "value": "Black", "hex": "#000"}]}
    response = auth(manager).put(f"/api/v1/admin/attributes/{attr.pk}/", body, format="json")
    assert response.status_code == 400 and "White" in response.data["detail"]


def test_inventory_filters_bulk_update_and_movements(auth, manager, setup):
    low = make_product("Low", category=setup["shirts"], stock=2)
    make_product("Full", category=setup["shirts"], stock=50)
    client = auth(manager)
    rows = client.get("/api/v1/admin/inventory/", {"stock": "low"}).data["results"]
    assert [r["product"] for r in rows] == ["Low"]
    variant = low.variants.first()
    result = client.post(
        "/api/v1/admin/inventory/bulk/",
        {"rows": [{"variant_id": variant.pk, "delta": 8}], "note": "PO-1001"},
        format="json",
    )
    assert result.data == {"updated": 1}
    variant.refresh_from_db()
    assert variant.stock == 10
    movements = client.get(f"/api/v1/admin/inventory/{variant.pk}/movements/").data
    assert movements[0]["delta"] == 8 and movements[0]["reference"] == "PO-1001"
    negative = client.post(
        "/api/v1/admin/inventory/bulk/", {"rows": [{"variant_id": variant.pk, "stock": -1}]}, format="json"
    )
    assert negative.status_code == 400
