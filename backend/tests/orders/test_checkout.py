import threading
from datetime import timedelta

import pytest
from django.core import mail
from django.db import connection
from django.utils import timezone

from apps.catalog.models import ProductVariant
from apps.offers.models import Coupon
from apps.orders.models import Order
from apps.orders.tasks import expire_unpaid_orders
from tests.factories import make_coupon

from .conftest import ADDRESS, guest_payload, razorpay_signature, vid

pytestmark = pytest.mark.django_db(transaction=True)


def test_guest_cod_checkout_reserves_stock_and_emails(api, shop):
    response = api.post("/api/v1/checkout/", guest_payload([(vid(shop["shirt"]), 2)]), format="json")
    assert response.status_code == 201, response.data
    order = Order.objects.get(number=response.data["order"]["number"])
    assert order.status == "placed" and order.payment_method == "cod"
    assert order.number.startswith("SRT-")
    assert order.grand_total_paise == 2 * 349900 + 4900  # free shipping; COD fee
    assert order.igst_paise == order.tax_total_paise  # Karnataka ≠ Maharashtra
    assert ProductVariant.objects.get(pk=vid(shop["shirt"])).stock == 3
    assert order.invoice_number.startswith("SRT/INV/")
    assert order.invoice_pdf.read(4) == b"%PDF"
    assert any("is confirmed" in m.subject for m in mail.outbox)
    assert mail.outbox[-1].attachments[0][0] == f"Invoice-{order.number}.pdf"


def test_client_supplied_amounts_are_ignored(api, shop):
    payload = guest_payload([(vid(shop["shirt"]), 1)], grand_total_paise=100, price_paise=100)
    response = api.post("/api/v1/checkout/", payload, format="json")
    assert response.data["order"]["grand_total_paise"] == 349900 + 4900  # server price + COD fee; free shipping


def test_stale_expected_total_is_refused(api, shop):
    response = api.post(
        "/api/v1/checkout/", guest_payload([(vid(shop["shirt"]), 1)], expected_total_paise=1), format="json"
    )
    assert response.status_code == 409 and response.data["code"] == "price_changed"
    assert ProductVariant.objects.get(pk=vid(shop["shirt"])).stock == 5


def test_insufficient_stock_is_refused_with_details(api, shop):
    response = api.post("/api/v1/checkout/", guest_payload([(vid(shop["lamp"]), 2)]), format="json")
    assert response.status_code == 409
    assert response.data["code"] == "stock_changed"
    assert response.data["lines"][0]["available"] == 1


def test_unserviceable_pincode(api, shop):
    payload = guest_payload([(vid(shop["shirt"]), 1)], shipping_address={**ADDRESS, "pincode": "110001"})
    response = api.post("/api/v1/checkout/", payload, format="json")
    assert response.status_code == 400 and response.data["code"] == "unserviceable"


def test_coupon_is_redeemed_once(api, shop):
    make_coupon("WELCOME10", value=10, usage_limit_total=1)
    payload = guest_payload([(vid(shop["shirt"]), 1)], coupon_code="welcome10")
    first = api.post("/api/v1/checkout/", payload, format="json")
    assert first.status_code == 201 and first.data["order"]["coupon_discount_paise"] == 34990
    assert Coupon.objects.get(code="WELCOME10").times_used == 1
    second = api.post("/api/v1/checkout/", {**payload, "email": "grace@example.com"}, format="json")
    assert second.status_code == 400 and second.data["code"] == "coupon_invalid"


def test_signed_in_checkout_uses_server_cart_and_saves_address(auth, customer, shop):
    client = auth(customer)
    client.post("/api/v1/cart/items/", {"variant_id": vid(shop["shirt"]), "quantity": 1}, format="json")
    response = client.post(
        "/api/v1/checkout/",
        {
            "shipping_address": ADDRESS,
            "shipping_method": "standard",
            "payment_method": "cod",
            "save_address": True,
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    assert customer.addresses.count() == 1
    assert client.get("/api/v1/cart/").data["lines"] == []
    assert client.get(f"/api/v1/orders/{response.data['order']['number']}/").status_code == 200


def test_order_access_requires_owner_or_token(api, auth, customer, shop):
    data = api.post("/api/v1/checkout/", guest_payload([(vid(shop["shirt"]), 1)]), format="json").data["order"]
    number, token = data["number"], data["access_token"]
    assert api.get(f"/api/v1/orders/{number}/").status_code == 404
    assert api.get(f"/api/v1/orders/{number}/", {"token": "wrong"}).status_code == 404
    assert auth(customer).get(f"/api/v1/orders/{number}/").status_code == 404
    assert api.get(f"/api/v1/orders/{number}/", {"token": token}).status_code == 200
    invoice = api.get(f"/api/v1/orders/{number}/invoice/", {"token": token})
    assert invoice.status_code == 200 and invoice["Content-Type"] == "application/pdf"


def test_razorpay_flow_with_valid_and_invalid_signatures(api, shop, razorpay_client):
    response = api.post(
        "/api/v1/checkout/",
        guest_payload([(vid(shop["shirt"]), 1)], payment_method="razorpay"),
        format="json",
    )
    assert response.status_code == 201
    order_data, payment = response.data["order"], response.data["payment"]
    assert order_data["status"] == "pending_payment"
    assert payment["razorpay_order_id"] == "order_test_1"
    assert payment["amount"] == 349900  # free shipping, no COD fee
    assert ProductVariant.objects.get(pk=vid(shop["shirt"])).stock == 4  # reserved while paying

    base = {
        "order_number": order_data["number"],
        "token": order_data["access_token"],
        "razorpay_order_id": "order_test_1",
    }
    forged = api.post(
        "/api/v1/payments/razorpay/verify/",
        {**base, "razorpay_payment_id": "pay_1", "razorpay_signature": "forged"},
        format="json",
    )
    assert forged.status_code == 400
    assert Order.objects.get(number=order_data["number"]).status == "pending_payment"

    ok = api.post(
        "/api/v1/payments/razorpay/verify/",
        {
            **base,
            "razorpay_payment_id": "pay_1",
            "razorpay_signature": razorpay_signature("order_test_1", "pay_1"),
        },
        format="json",
    )
    assert ok.status_code == 200 and ok.data["status"] == "placed" and ok.data["payment_status"] == "paid"


def test_unpaid_orders_expire_and_release_stock_and_coupon(api, shop, razorpay_client):
    make_coupon("TENOFF", value=10)
    data = api.post(
        "/api/v1/checkout/",
        guest_payload([(vid(shop["shirt"]), 2)], payment_method="razorpay", coupon_code="TENOFF"),
        format="json",
    ).data["order"]
    Order.objects.filter(number=data["number"]).update(reservation_expires_at=timezone.now() - timedelta(minutes=1))
    assert expire_unpaid_orders() == 1
    order = Order.objects.get(number=data["number"])
    assert order.status == "payment_failed"
    assert ProductVariant.objects.get(pk=vid(shop["shirt"])).stock == 5
    assert Coupon.objects.get(code="TENOFF").times_used == 0


def test_retry_after_failure_rereserves_and_creates_new_gateway_order(api, shop, razorpay_client):
    data = api.post(
        "/api/v1/checkout/",
        guest_payload([(vid(shop["shirt"]), 1)], payment_method="razorpay"),
        format="json",
    ).data["order"]
    Order.objects.filter(number=data["number"]).update(reservation_expires_at=timezone.now() - timedelta(minutes=1))
    expire_unpaid_orders()
    retry = api.post(
        f"/api/v1/checkout/{data['number']}/retry-payment/", {"token": data["access_token"]}, format="json"
    )
    assert retry.status_code == 200
    assert retry.data["payment"]["razorpay_order_id"] == "order_test_2"
    assert retry.data["order"]["status"] == "pending_payment"
    assert ProductVariant.objects.get(pk=vid(shop["shirt"])).stock == 4


@pytest.mark.django_db(transaction=True)
def test_concurrent_checkouts_cannot_oversell(shop):
    """Two shoppers race for the last lamp: exactly one order succeeds."""
    from rest_framework.test import APIClient

    results = []
    barrier = threading.Barrier(2)

    def attempt(email):
        client = APIClient()
        barrier.wait()
        response = client.post("/api/v1/checkout/", guest_payload([(vid(shop["lamp"]), 1)], email=email), format="json")
        results.append(response.status_code)
        connection.close()

    threads = [threading.Thread(target=attempt, args=(f"racer{i}@example.com",)) for i in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == [201, 409]
    assert ProductVariant.objects.get(pk=vid(shop["lamp"])).stock == 0
    assert Order.objects.count() == 1
