"""End-to-end business journeys driven only through the HTTP API, as the storefront and admin do.

Each test plays several actors (shopper, guest, manager, admin) with separate clients, and checks
the side effects that matter to the business: stock, money, emails, the audit trail.
"""

import hashlib
import hmac
import json
from datetime import timedelta

import pytest
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import ProductVariant
from apps.core.models import AuditLog
from apps.offers.models import Coupon
from apps.orders.models import Order
from apps.payments.models import Payment, Refund, WebhookEvent
from tests.factories import UserFactory, make_category, png_file
from tests.orders.conftest import ADDRESS, guest_payload, razorpay_signature, vid

pytestmark = pytest.mark.django_db(transaction=True)


def client(user=None) -> APIClient:
    c = APIClient(HTTP_X_SARTORIA_CLIENT="1")
    if user is not None:
        c.force_authenticate(user)
    return c


@pytest.fixture
def staff():
    return {"manager": client(UserFactory(role="manager")), "admin": client(UserFactory(role="admin"))}


def stock(product) -> int:
    return ProductVariant.objects.get(pk=vid(product)).stock


def ship_and_deliver(manager, number):
    for status in ("confirmed", "packed"):
        assert (
            manager.post(f"/api/v1/admin/orders/{number}/transition/", {"status": status}, format="json").status_code
            == 200
        )
    shipped = manager.post(
        f"/api/v1/admin/orders/{number}/transition/",
        {"status": "shipped", "courier_name": "Delhivery", "tracking_number": "DL123"},
        format="json",
    )
    assert shipped.status_code == 200 and shipped.data["tracking_number"] == "DL123"
    assert (
        manager.post(
            f"/api/v1/admin/orders/{number}/transition/", {"status": "out_for_delivery"}, format="json"
        ).status_code
        == 200
    )
    delivered = manager.post(f"/api/v1/admin/orders/{number}/transition/", {"status": "delivered"}, format="json")
    assert delivered.status_code == 200 and delivered.data["status"] == "delivered"


def test_signed_in_shopper_from_signup_to_refund(shop, staff):
    """Register → address → bag with coupon → COD checkout → fulfilment → return → manual refund."""
    manager = staff["manager"]
    shirt = shop["shirt"]
    start_stock = stock(shirt)

    # The manager launches a coupon from the admin.
    coupon = manager.post(
        "/api/v1/admin/coupons/", {"code": "welcome10", "discount_type": "percent", "value": 10}, format="json"
    )
    assert coupon.status_code == 201

    # A shopper signs up, saves an address and fills the bag.
    shopper = client()
    registered = shopper.post(
        "/api/v1/auth/register/",
        {"email": "meera@example.com", "password": "Strong-pass-123", "first_name": "Meera", "phone": "9876500000"},
        format="json",
    )
    assert registered.status_code == 201
    shopper.credentials(HTTP_AUTHORIZATION=f"Bearer {registered.data['access']}", HTTP_X_SARTORIA_CLIENT="1")
    address = shopper.post("/api/v1/account/addresses/", {**ADDRESS, "label": "Home"}, format="json")
    assert address.status_code == 201
    assert shopper.post(
        "/api/v1/cart/items/", {"variant_id": vid(shirt), "quantity": 2}, format="json"
    ).status_code in (200, 201)
    applied = shopper.post("/api/v1/cart/coupon/", {"code": "WELCOME10"}, format="json").data
    assert applied["coupon"]["applied"] and applied["coupon"]["discount_paise"] > 0

    # The quote the shopper reviews is exactly what they're charged.
    quote = shopper.get(
        "/api/v1/cart/", {"pincode": ADDRESS["pincode"], "shipping_method": "standard", "payment_method": "cod"}
    ).data
    mail.outbox.clear()
    placed = shopper.post(
        "/api/v1/checkout/",
        {
            "address_id": address.data["id"],
            "shipping_method": "standard",
            "payment_method": "cod",
            "coupon_code": "WELCOME10",
            "expected_total_paise": quote["total_paise"],
        },
        format="json",
    )
    assert placed.status_code == 201, placed.data
    order = placed.data["order"]
    number = order["number"]
    assert order["grand_total_paise"] == quote["total_paise"]
    assert order["coupon_discount_paise"] == quote["coupon"]["discount_paise"]
    assert stock(shirt) == start_stock - 2
    assert Coupon.objects.get(code="WELCOME10").times_used == 1
    assert any("order" in m.subject.lower() for m in mail.outbox)  # confirmation email
    assert shopper.get("/api/v1/cart/").data["item_count"] == 0  # bag emptied

    # Fulfilment in the admin; the shopper sees every step.
    ship_and_deliver(manager, number)
    mine = shopper.get(f"/api/v1/orders/{number}/").data
    assert mine["status"] == "delivered" and mine["tracking_number"] == "DL123"
    assert [e["to_status"] for e in mine["events"]][-1] == "delivered"
    invoice = shopper.get(f"/api/v1/orders/{number}/invoice/")
    assert invoice.status_code == 200 and invoice["Content-Type"] == "application/pdf"

    # One shirt goes back; refunded by UPI because the order was cash on delivery.
    item_id = Order.objects.get(number=number).items.get().pk
    requested = shopper.post(
        "/api/v1/returns/",
        {
            "order_number": number,
            "items": json.dumps([{"order_item_id": item_id, "quantity": 1}]),
            "reason": "wrong_size",
            "refund_upi_id": "meera@okbank",
        },
        format="multipart",
    )
    assert requested.status_code == 201, requested.data
    ret = requested.data["number"]
    tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
    for body in (
        {"status": "approved"},
        {"status": "pickup_scheduled", "pickup_date": tomorrow},
        {"status": "received"},
    ):
        assert manager.post(f"/api/v1/admin/returns/{ret}/transition/", body, format="json").status_code == 200
    assert stock(shirt) == start_stock - 1  # restocked on receipt
    refunded = manager.post(f"/api/v1/admin/returns/{ret}/transition/", {"status": "refunded"}, format="json")
    assert refunded.status_code == 200 and refunded.data["status"] == "refunded"

    order_row = Order.objects.get(number=number)
    assert order_row.payment_status == "partially_refunded"
    assert Refund.objects.get().status == Refund.Status.MANUAL
    assert shopper.get(f"/api/v1/returns/{ret}/").data["status"] == "refunded"
    # Every staff action is on the record.
    transitions = AuditLog.objects.filter(action="transition").count()
    assert transitions == 5 + 4  # five order steps, four return steps


@override_settings(RAZORPAY_WEBHOOK_SECRET="webhook_secret")
def test_guest_pays_online_and_a_staff_cancellation_refunds_once(shop, staff, razorpay_client):
    """Guest checkout → signature-verified payment → duplicate webhook → admin cancels → one refund."""
    guest = client()
    placed = guest.post(
        "/api/v1/checkout/", guest_payload([(vid(shop["lamp"]), 1)], payment_method="razorpay"), format="json"
    ).data
    number, token = placed["order"]["number"], placed["order"]["access_token"]
    assert placed["payment"]["razorpay_order_id"] == "order_test_1"
    assert guest.get(f"/api/v1/orders/{number}/", {"token": token}).data["status"] == "pending_payment"

    forged = guest.post(
        "/api/v1/payments/razorpay/verify/",
        {
            "order_number": number,
            "token": token,
            "razorpay_order_id": "order_test_1",
            "razorpay_payment_id": "pay_9",
            "razorpay_signature": "x",
        },
        format="json",
    )
    assert forged.status_code == 400
    verified = guest.post(
        "/api/v1/payments/razorpay/verify/",
        {
            "order_number": number,
            "token": token,
            "razorpay_order_id": "order_test_1",
            "razorpay_payment_id": "pay_9",
            "razorpay_signature": razorpay_signature("order_test_1", "pay_9"),
        },
        format="json",
    )
    assert verified.status_code == 200

    # Razorpay also reports the capture, twice; nothing changes the second time.
    body = json.dumps(
        {
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay_9", "order_id": "order_test_1", "method": "card"}}},
        }
    ).encode()
    signature = hmac.new(b"webhook_secret", body, hashlib.sha256).hexdigest()
    for _ in range(2):
        hook = guest.generic(
            "POST",
            "/api/v1/payments/razorpay/webhook/",
            body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=signature,
            HTTP_X_RAZORPAY_EVENT_ID="evt_capture_9",
        )
        assert hook.status_code == 200
    assert WebhookEvent.objects.count() == 1
    assert Payment.objects.get().status == "captured"
    assert Order.objects.get(number=number).payment_status == "paid"

    # The store can't fulfil it; the admin cancels and the money goes back automatically.
    cancelled = staff["manager"].post(
        f"/api/v1/admin/orders/{number}/transition/",
        {"status": "cancelled", "note": "Damaged in the warehouse"},
        format="json",
    )
    assert cancelled.status_code == 200
    razorpay_client.payment.refund.assert_called_once()
    assert Order.objects.get(number=number).payment_status == "refunded"
    assert stock(shop["lamp"]) == 1  # the unit is back on sale
    tracked = guest.post("/api/v1/orders/track/", {"number": number, "contact": "ada@example.com"}, format="json")
    assert tracked.status_code == 200 and tracked.data["status"] == "cancelled"


def test_price_and_stock_changes_are_caught_at_checkout(shop, staff):
    """A flash sale that starts mid-checkout and a sold-out last unit both stop the order with 409."""
    guest = client()
    lamp = shop["lamp"]
    quote = guest.post(
        "/api/v1/cart/quote/",
        {
            "lines": [{"variant_id": vid(lamp), "quantity": 1}],
            "pincode": ADDRESS["pincode"],
            "shipping_method": "standard",
            "payment_method": "cod",
        },
        format="json",
    ).data
    old_total = quote["total_paise"]

    now = timezone.now()
    sale = staff["manager"].post(
        "/api/v1/admin/sales/",
        {
            "kind": "flash",
            "title": "Lamp hour",
            "starts_at": (now - timedelta(minutes=1)).isoformat(),
            "ends_at": (now + timedelta(hours=1)).isoformat(),
            "items": [{"product": lamp.pk, "discount_type": "percent", "value": 20}],
        },
        format="json",
    )
    assert sale.status_code == 201

    stale = guest.post(
        "/api/v1/checkout/", guest_payload([(vid(lamp), 1)], expected_total_paise=old_total), format="json"
    )
    assert stale.status_code == 409 and stale.data["code"] == "price_changed"
    new_total = stale.data["total_paise"]
    assert new_total < old_total

    first = guest.post(
        "/api/v1/checkout/", guest_payload([(vid(lamp), 1)], expected_total_paise=new_total), format="json"
    )
    assert first.status_code == 201
    second = client().post(
        "/api/v1/checkout/", guest_payload([(vid(lamp), 1)], email="late@example.com"), format="json"
    )
    assert second.status_code == 409 and second.data["code"] == "stock_changed"
    assert stock(lamp) == 0


def test_admin_catalogue_changes_reach_the_storefront(staff):
    """Create a product in the admin → it's browsable and searchable → stock-out and deactivation follow."""
    admin = staff["admin"]
    leaf = make_category("Throws", make_category("Home"))
    created = admin.post(
        "/api/v1/admin/products/",
        {
            "name": "Merino Picnic Throw",
            "category": leaf.pk,
            "tax_rate": 5,
            "short_description": "Soft enough for the sofa, sturdy enough for the grass.",
            "variants": [{"sku": "MPT-1", "option_values": [], "price_paise": 459000, "stock": 3}],
        },
        format="json",
    )
    assert created.status_code == 201, created.data
    pid, slug = created.data["id"], created.data["slug"]
    upload = admin.post(f"/api/v1/admin/products/{pid}/images/", {"files": [png_file("throw.png")]}, format="multipart")
    assert upload.status_code == 201

    shopper = client()
    detail = shopper.get(f"/api/v1/products/{slug}/")
    assert detail.status_code == 200 and detail.data["images"] and detail.data["in_stock"]
    assert slug in [p["slug"] for p in shopper.get("/api/v1/products/", {"category": leaf.slug}).data["results"]]
    assert slug in [p["slug"] for p in shopper.get("/api/v1/products/", {"q": "picnic throw"}).data["results"]]

    variant = ProductVariant.objects.get(sku="MPT-1")
    assert (
        admin.post(
            "/api/v1/admin/inventory/bulk/",
            {"rows": [{"variant_id": variant.pk, "stock": 0}], "note": "count"},
            format="json",
        ).status_code
        == 200
    )
    assert shopper.get(f"/api/v1/products/{slug}/").data["in_stock"] is False

    assert (
        admin.post("/api/v1/admin/products/bulk/", {"ids": [pid], "action": "deactivate"}, format="json").status_code
        == 200
    )
    assert shopper.get(f"/api/v1/products/{slug}/").status_code == 404
