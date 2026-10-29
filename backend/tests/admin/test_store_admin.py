"""Admin APIs for offers, content, shipping, settings, staff, audit and CSV import/export."""

from datetime import timedelta

import pytest
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.accounts.models import User
from apps.catalog.models import Product, ProductVariant, StockMovement
from apps.cms.models import HeroSlide, NewsletterSubscriber, Page
from apps.core.models import AuditLog, ImportJob, StoreSettings
from apps.offers.models import Coupon, FlashSale
from apps.shipping.models import ServiceablePincode, ShippingZone
from tests.factories import UserFactory, attr_value, attribute, make_category, make_product, png_file

pytestmark = pytest.mark.django_db(transaction=True)


def upload(name="slide.png"):
    return SimpleUploadedFile(name, png_file().read(), content_type="image/png")


def csv_file(text, name="data.csv"):
    return SimpleUploadedFile(name, text.encode("utf-8"), content_type="text/csv")


# --------------------------------------------------------------------------- offers
def test_coupon_rules_are_enforced(auth, manager, customer):
    client = auth(manager)
    created = client.post(
        "/api/v1/admin/coupons/",
        {"code": " welcome10 ", "discount_type": "percent", "value": 10, "min_order_paise": 100000},
        format="json",
    )
    assert created.status_code == 201 and created.data["code"] == "WELCOME10" and created.data["state"] == "live"
    too_much = client.post(
        "/api/v1/admin/coupons/", {"code": "BIG", "discount_type": "percent", "value": 95}, format="json"
    )
    assert too_much.status_code == 400 and "value" in too_much.data
    now = timezone.now()
    backwards = client.post(
        "/api/v1/admin/coupons/",
        {
            "code": "OOPS",
            "discount_type": "fixed",
            "value": 50000,
            "starts_at": now,
            "ends_at": now - timedelta(days=1),
        },
        format="json",
    )
    assert backwards.status_code == 400 and "ends_at" in backwards.data
    duplicate = client.post(
        "/api/v1/admin/coupons/", {"code": "welcome10", "discount_type": "fixed", "value": 100}, format="json"
    )
    assert duplicate.status_code == 400
    assert auth(customer).get("/api/v1/admin/coupons/").status_code == 403
    assert AuditLog.objects.filter(object_type="offers.Coupon", action="create").count() == 1


def test_flash_sale_items_sync_and_reorder(auth, manager):
    a, b = make_product("Sale A"), make_product("Sale B")
    client = auth(manager)
    now = timezone.now()
    body = {
        "kind": "flash",
        "title": "Midnight Sale",
        "starts_at": now - timedelta(hours=1),
        "ends_at": now + timedelta(hours=5),
        "items": [
            {"product": a.pk, "discount_type": "percent", "value": 20},
            {"product": b.pk, "discount_type": "fixed_price", "value": 150000, "quantity_cap": 5},
        ],
    }
    sale = client.post("/api/v1/admin/sales/", body, format="json").data
    assert sale["slug"] == "midnight-sale" and sale["item_count"] == 2 and sale["state"] == "live"
    first_item = sale["items"][0]
    updated = client.patch(
        f"/api/v1/admin/sales/{sale['id']}/",
        {"items": [{"id": first_item["id"], "product": a.pk, "discount_type": "percent", "value": 30}]},
        format="json",
    ).data
    assert [i["value"] for i in updated["items"]] == [30]
    bad = client.patch(
        f"/api/v1/admin/sales/{sale['id']}/",
        {"items": [{"product": a.pk, "discount_type": "percent", "value": 99}]},
        format="json",
    )
    assert bad.status_code == 400
    other = FlashSale.objects.create(title="Later", starts_at=now + timedelta(days=1), ends_at=now + timedelta(days=2))
    client.post("/api/v1/admin/sales/reorder/", {"ids": [other.pk, sale["id"]]}, format="json")
    assert FlashSale.objects.get(pk=other.pk).position == 0


def test_bundle_needs_two_products(auth, manager):
    a, b = make_product("Kettle"), make_product("Mug")
    client = auth(manager)
    one = client.post(
        "/api/v1/admin/bundles/",
        {"title": "Tea Set", "discount_type": "percent", "value": 10, "items": [{"product": a.pk, "quantity": 1}]},
        format="json",
    )
    assert one.status_code == 400
    two = client.post(
        "/api/v1/admin/bundles/",
        {
            "title": "Tea Set",
            "discount_type": "percent",
            "value": 10,
            "items": [{"product": a.pk, "quantity": 1}, {"product": b.pk, "quantity": 2}],
        },
        format="json",
    )
    assert two.status_code == 201
    assert two.data["full_price_paise"] == a.min_price_paise + 2 * b.min_price_paise


# --------------------------------------------------------------------------- content
def test_hero_slides_upload_reorder_and_toggle(auth, manager):
    client = auth(manager)
    assert (
        client.post("/api/v1/admin/cms/hero-slides/", {"headline": "No image"}, format="multipart").status_code == 400
    )
    bad = client.post(
        "/api/v1/admin/cms/hero-slides/",
        {"headline": "Fake", "image": csv_file("not,an,image", "x.png")},
        format="multipart",
    )
    assert bad.status_code == 400 and "image" in bad.data
    first = client.post("/api/v1/admin/cms/hero-slides/", {"headline": "Autumn", "image": upload()}, format="multipart")
    second = client.post(
        "/api/v1/admin/cms/hero-slides/", {"headline": "Winter", "image": upload()}, format="multipart"
    )
    assert first.status_code == 201 and first.data["image"].endswith(".jpg")  # re-encoded
    client.post("/api/v1/admin/cms/hero-slides/reorder/", {"ids": [second.data["id"], first.data["id"]]}, format="json")
    assert list(HeroSlide.objects.values_list("headline", flat=True)) == ["Winter", "Autumn"]
    client.patch(f"/api/v1/admin/cms/hero-slides/{first.data['id']}/", {"is_active": False}, format="json")
    from apps.cms.services import hero_slides

    assert [s["headline"] for s in hero_slides()] == ["Winter"]


def test_pages_are_sanitised_and_newsletter_export_has_confirmed_only(auth, manager):
    client = auth(manager)
    page = client.post(
        "/api/v1/admin/cms/pages/",
        {"title": "Shipping Policy", "body": "<p>Fast</p><script>x()</script>"},
        format="json",
    ).data
    assert page["slug"] == "shipping-policy" and "<script>" not in Page.objects.get(pk=page["id"]).body
    NewsletterSubscriber.objects.create(email="yes@example.com", status="confirmed", confirmed_at=timezone.now())
    NewsletterSubscriber.objects.create(email="maybe@example.com")
    export = client.get("/api/v1/admin/newsletter/export/")
    body = b"".join(export).decode() if export.streaming else export.content.decode()
    assert "yes@example.com" in body and "maybe@example.com" not in body
    assert client.get("/api/v1/admin/newsletter/", {"status": "pending"}).data["count"] == 1


# --------------------------------------------------------------------------- shipping
def test_shipping_is_admin_only_and_validated(auth, manager, admin_user):
    assert auth(manager).get("/api/v1/admin/shipping/zones/").status_code == 403
    client = auth(admin_user)
    slow = client.post(
        "/api/v1/admin/shipping/zones/",
        {"name": "Islands", "standard_days_min": 9, "standard_days_max": 5},
        format="json",
    )
    assert slow.status_code == 400
    zone = client.post("/api/v1/admin/shipping/zones/", {"name": "Islands"}, format="json").data
    pin = client.post(
        "/api/v1/admin/shipping/pincodes/",
        {"pincode": "744101", "zone": zone["id"], "city": "Port Blair", "state": "Andaman and Nicobar Islands"},
        format="json",
    ).data
    assert pin["state_code"] == "35" and pin["zone_name"] == "Islands"
    blocked = client.delete(f"/api/v1/admin/shipping/zones/{zone['id']}/")
    assert blocked.status_code == 400 and ShippingZone.objects.filter(pk=zone["id"]).exists()


# --------------------------------------------------------------------------- settings
def test_settings_validation_and_logo(auth, manager, admin_user):
    assert auth(manager).get("/api/v1/admin/settings/").status_code == 403
    client = auth(admin_user)
    updated = client.patch("/api/v1/admin/settings/", {"state": "Karnataka", "gstin": ""}, format="json")
    assert updated.status_code == 200 and updated.data["state_code"] == "29"
    mismatch = client.patch("/api/v1/admin/settings/", {"gstin": "27AAACS1234A1Z5"}, format="json")
    assert mismatch.status_code == 400 and "gstin" in mismatch.data
    logo = client.patch("/api/v1/admin/settings/", {"logo": upload("logo.png")}, format="multipart")
    assert logo.status_code == 200 and logo.data["logo"]
    assert StoreSettings.load().logo  # cache cleared on save
    cleared = client.patch("/api/v1/admin/settings/", {"logo": ""}, format="multipart")
    assert cleared.data["logo"] is None
    assert AuditLog.objects.filter(object_type="core.StoreSettings").count() == 3


# --------------------------------------------------------------------------- staff
def test_staff_invite_and_guards(auth, admin_user, manager):
    client = auth(admin_user)
    invited = client.post("/api/v1/admin/staff/", {"email": "New@Sartoria.test", "role": "manager"}, format="json")
    assert invited.status_code == 201 and invited.data["invited"] is True
    assert mail.outbox and "reset-password" in mail.outbox[-1].body
    assert (
        client.post("/api/v1/admin/staff/", {"email": "new@sartoria.test", "role": "admin"}, format="json").status_code
        == 400
    )

    # An existing customer can be promoted; they sign in with their own password.
    shopper = UserFactory(email="shopper@example.com")
    shopper.set_password("x-Secret-123")
    shopper.save()
    promoted = client.post("/api/v1/admin/staff/", {"email": "shopper@example.com", "role": "manager"}, format="json")
    assert promoted.data["invited"] is False and "admin/login" in mail.outbox[-1].body

    assert client.patch(f"/api/v1/admin/staff/{admin_user.pk}/", {"role": "manager"}, format="json").status_code == 400
    assert client.post(f"/api/v1/admin/staff/{admin_user.pk}/revoke/").status_code == 400
    client.post(f"/api/v1/admin/staff/{manager.pk}/revoke/")
    manager.refresh_from_db()
    assert manager.role == User.Role.CUSTOMER
    assert auth(manager).get("/api/v1/admin/staff/").status_code == 403

    second_admin = UserFactory(role="admin")
    demoted = auth(second_admin).patch(f"/api/v1/admin/staff/{admin_user.pk}/", {"role": "manager"}, format="json")
    assert demoted.status_code == 200
    # Now second_admin is the only admin and can't be removed by anyone.
    other = UserFactory(role="admin")
    other.role = "admin"
    other.save()
    other.delete()
    assert auth(second_admin).post(f"/api/v1/admin/staff/{second_admin.pk}/revoke/").status_code == 400


def test_audit_log_lists_and_filters(auth, admin_user, manager):
    auth(manager).post("/api/v1/admin/coupons/", {"code": "AUD", "discount_type": "fixed", "value": 100}, format="json")
    client = auth(admin_user)
    rows = client.get("/api/v1/admin/audit-log/", {"object_type": "offers.Coupon"}).data
    assert rows["count"] == 1 and rows["results"][0]["actor"]["email"] == manager.email
    auth(manager).post(
        "/api/v1/admin/coupons/", {"code": "AUD2", "discount_type": "fixed", "value": 100}, format="json"
    )
    facets = auth(admin_user).get("/api/v1/admin/audit-log/facets/").data
    assert facets["object_types"].count("offers.Coupon") == 1
    assert auth(manager).get("/api/v1/admin/audit-log/").status_code == 403


# --------------------------------------------------------------------------- import / export
def test_product_import_creates_updates_and_reports(auth, admin_user, manager):
    make_category("Shirts", make_category("Fashion"))
    attribute("Size")
    colour = attribute("Colour", kind="swatch")
    attr_value(colour, "Navy", hex="#1F2A44")
    existing = make_product("Old Tee")
    existing_sku = existing.variants.first().sku
    text = (
        "product_slug,product_name,category_slug,brand,tax_rate,sku,options,price,mrp,stock\n"
        "linen-shirt,Linen Shirt,shirts,Wayfarer,5,LS-NAVY-M,Colour=Navy; Size=M,2490,2990,12\n"
        "linen-shirt,,,,,LS-NAVY-L,Colour=Navy; Size=L,2490,,4\n"
        f"{existing.slug},,,,,{existing_sku},,1999,,7\n"
        "broken,Broken,shirts,,,BR-1,Fit=Slim,abc,,1\n"
        "fashion-item,Wrong Level,fashion,,,FI-1,,999,,1\n"
    )
    assert auth(manager).post("/api/v1/admin/imports/", {"kind": "products", "file": csv_file(text)}).status_code == 403
    job = auth(admin_user).post(
        "/api/v1/admin/imports/", {"kind": "products", "file": csv_file(text)}, format="multipart"
    )
    assert job.status_code == 202
    detail = auth(admin_user).get(f"/api/v1/admin/imports/{job.data['id']}/").data
    assert detail["status"] == "completed" and detail["success_rows"] == 3 and detail["error_rows"] == 2
    shirt = Product.objects.get(slug="linen-shirt")
    assert shirt.brand.name == "Wayfarer" and shirt.variants.count() == 2 and shirt.total_stock == 16
    assert sorted(shirt.variants.get(sku="LS-NAVY-L").option_values.values_list("value", flat=True)) == ["L", "Navy"]
    old = ProductVariant.objects.get(sku=existing_sku)
    assert old.price_paise == 199900 and old.stock == 7
    assert StockMovement.objects.filter(variant=old, reason="import").exists()
    assert detail["has_report"] and detail["file_name"] == "data.csv"
    report = b"".join(auth(admin_user).get(f"/api/v1/admin/imports/{job.data['id']}/report/").streaming_content)
    report = report.decode("utf-8-sig")
    assert "Fit" in report and "most specific category" in report


def test_inventory_and_pincode_imports(auth, admin_user):
    product = make_product("Stocked")
    sku = product.variants.first().sku
    client = auth(admin_user)
    client.post(
        "/api/v1/admin/imports/", {"kind": "inventory", "file": csv_file(f"sku,stock\n{sku},42\nNOPE,1\n{sku},-3\n")}
    )
    assert ProductVariant.objects.get(sku=sku).stock == 42
    job = ImportJob.objects.get(kind="inventory")
    assert job.success_rows == 1 and job.error_rows == 2
    ShippingZone.objects.create(name="Metro")
    client.post(
        "/api/v1/admin/imports/",
        {
            "kind": "pincodes",
            "file": csv_file("pincode,zone,city,state\n400001,metro,Mumbai,Maharashtra\n012345,Metro,X,Y\n"),
        },
    )
    assert ServiceablePincode.objects.get(pincode="400001").state_code == "27"
    missing = client.post("/api/v1/admin/imports/", {"kind": "pincodes", "file": csv_file("pin,zone\n1,2\n")})
    assert ImportJob.objects.get(pk=missing.data["id"]).status == "failed"


def test_exports_and_templates(auth, admin_user, manager):
    make_product("Exported Lamp")
    response = auth(manager).get("/api/v1/admin/export/products/")
    body = b"".join(response.streaming_content).decode("utf-8")
    assert body.startswith("﻿product_slug,product_name") and "Exported Lamp" in body
    assert auth(manager).get("/api/v1/admin/export/pincodes/").status_code == 403  # shipping is admin-only
    template = auth(manager).get("/api/v1/admin/imports/template/inventory/")
    assert template["Content-Type"] == "text/csv" and b"sku,stock" in template.content
    # A product export re-imports without errors.
    auth(admin_user).post(
        "/api/v1/admin/imports/", {"kind": "products", "file": csv_file(body.lstrip("﻿"))}, format="multipart"
    )
    job = ImportJob.objects.get(kind="products")
    assert job.error_rows == 0 and job.success_rows == 1
    assert Coupon.objects.count() == 0  # sanity: nothing else touched
