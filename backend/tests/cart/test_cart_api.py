import pytest

from tests.factories import make_coupon, make_product, shipping_setup

pytestmark = pytest.mark.django_db


@pytest.fixture
def products():
    shipping_setup()
    return make_product("Linen Shirt", price=349900, stock=5), make_product("Wool Scarf", price=249900, stock=2)


def vid(p):
    return p.variants.first().pk


def test_cart_requires_auth(api):
    assert api.get("/api/v1/cart/").status_code == 401


def test_add_merge_quantities_and_cap_at_stock(auth, customer, products):
    shirt, scarf = products
    client = auth(customer)
    client.post("/api/v1/cart/items/", {"variant_id": vid(scarf), "quantity": 1}, format="json")
    data = client.post("/api/v1/cart/items/", {"variant_id": vid(scarf), "quantity": 5}, format="json").data
    assert data["lines"][0]["quantity"] == 2  # capped at stock
    assert data["item_count"] == 2


def test_update_remove_and_save_for_later(auth, customer, products):
    shirt, _ = products
    client = auth(customer)
    data = client.post("/api/v1/cart/items/", {"variant_id": vid(shirt), "quantity": 1}, format="json").data
    item_id = data["lines"][0]["id"]
    data = client.patch(f"/api/v1/cart/items/{item_id}/", {"quantity": 3}, format="json").data
    assert data["subtotal_paise"] == 3 * 349900
    data = client.post(f"/api/v1/cart/items/{item_id}/save-for-later/").data
    assert data["lines"] == [] and data["saved_for_later"][0]["id"] == item_id
    data = client.post(f"/api/v1/cart/items/{item_id}/move-to-cart/").data
    assert data["lines"][0]["id"] == item_id
    data = client.delete(f"/api/v1/cart/items/{item_id}/").data
    assert data["lines"] == []


def test_cannot_touch_another_users_cart(auth, customer, products, admin_user):
    shirt, _ = products
    item_id = (
        auth(customer).post("/api/v1/cart/items/", {"variant_id": vid(shirt)}, format="json").data["lines"][0]["id"]
    )
    assert auth(admin_user).delete(f"/api/v1/cart/items/{item_id}/").status_code == 404


def test_coupon_apply_reject_and_remove(auth, customer, products):
    shirt, _ = products
    make_coupon("WELCOME10", value=10)
    client = auth(customer)
    client.post("/api/v1/cart/items/", {"variant_id": vid(shirt)}, format="json")
    bad = client.post("/api/v1/cart/coupon/", {"code": "NOPE"}, format="json")
    assert bad.status_code == 400 and "recognise" in bad.data["detail"]
    ok = client.post("/api/v1/cart/coupon/", {"code": "welcome10"}, format="json")
    assert ok.status_code == 200 and ok.data["coupon"]["discount_paise"] == 34990
    assert client.delete("/api/v1/cart/coupon/").data["coupon"] is None


def test_guest_merge_on_login(auth, customer, products):
    shirt, scarf = products
    client = auth(customer)
    client.post("/api/v1/cart/items/", {"variant_id": vid(shirt), "quantity": 1}, format="json")
    data = client.post(
        "/api/v1/cart/merge/",
        {
            "lines": [
                {"variant_id": vid(shirt), "quantity": 2},
                {"variant_id": vid(scarf), "quantity": 9},
                {"variant_id": 999999, "quantity": 1},
            ]
        },
        format="json",
    ).data
    quantities = {line["variant_id"]: line["quantity"] for line in data["lines"]}
    assert quantities == {vid(shirt): 3, vid(scarf): 2}


def test_guest_quote_never_trusts_client_prices(api, products):
    shirt, _ = products
    data = api.post(
        "/api/v1/cart/quote/",
        {"lines": [{"variant_id": vid(shirt), "quantity": 1, "price_paise": 1}], "pincode": "400050"},
        format="json",
    ).data
    assert data["subtotal_paise"] == 349900
    assert data["shipping_fee_paise"] == 0


def test_wishlist_add_remove_merge(auth, customer, products):
    shirt, scarf = products
    client = auth(customer)
    assert client.post("/api/v1/wishlist/", {"product_id": shirt.pk}, format="json").data["product_ids"] == [shirt.pk]
    client.post("/api/v1/wishlist/", {"product_id": shirt.pk}, format="json")  # idempotent
    data = client.post("/api/v1/wishlist/merge/", {"product_ids": [shirt.pk, scarf.pk]}, format="json").data
    assert set(data["product_ids"]) == {shirt.pk, scarf.pk}
    data = client.delete(f"/api/v1/wishlist/{shirt.pk}/").data
    assert data["product_ids"] == [scarf.pk]
    assert data["products"][0]["slug"] == scarf.slug


def test_delivery_estimate(api, products):
    shirt, _ = products
    data = api.get("/api/v1/shipping/estimate/", {"pincode": "560025", "product": shirt.slug}).data
    assert data["serviceable"] and data["city"] == "Bengaluru"
    standard = next(o for o in data["options"] if o["code"] == "standard")
    assert standard["free"] and standard["eta_from"]
    assert api.get("/api/v1/shipping/estimate/", {"pincode": "110001"}).data["serviceable"] is False
    assert api.get("/api/v1/shipping/estimate/", {"pincode": "12"}).status_code == 400
