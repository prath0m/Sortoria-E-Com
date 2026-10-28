import json

import pytest
from django.core import mail
from django.test import override_settings

from apps.catalog.models import ProductVariant
from apps.core.exceptions import ConflictError, DomainError
from apps.orders.models import Order
from apps.orders.services.state_machine import CUSTOMER, STAFF, SYSTEM, transition
from apps.payments.models import Payment, Refund, WebhookEvent
from apps.payments.providers import WebhookPayload
from apps.payments.services import handle_webhook

from .conftest import guest_payload, vid

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def cod_order(api, shop):
    data = api.post("/api/v1/checkout/", guest_payload([(vid(shop["shirt"]), 2)]), format="json").data["order"]
    return Order.objects.get(number=data["number"])


def test_happy_path_and_emails(cod_order):
    mail.outbox.clear()
    for status in ("confirmed", "packed"):
        transition(cod_order, status, actor_type=STAFF)
    with pytest.raises(DomainError):
        transition(cod_order, "shipped", actor_type=STAFF)  # tracking required
    Order.objects.filter(pk=cod_order.pk).update(courier_name="Delhivery", tracking_number="DLV123")
    for status in ("shipped", "out_for_delivery", "delivered"):
        transition(cod_order, status, actor_type=STAFF)
    order = Order.objects.get(pk=cod_order.pk)
    assert order.status == "delivered" and order.payment_status == "paid"  # COD collected
    assert [e.to_status for e in order.events.all()] == [
        "placed",
        "confirmed",
        "packed",
        "shipped",
        "out_for_delivery",
        "delivered",
    ]
    assert len(mail.outbox) == 5
    assert "DLV123" in mail.outbox[2].alternatives[0][0]


@pytest.mark.parametrize(
    ("start", "to", "actor"),
    [
        ("placed", "shipped", STAFF),  # skips steps
        ("placed", "delivered", STAFF),
        ("delivered", "cancelled", STAFF),
        ("placed", "confirmed", CUSTOMER),  # customers can't confirm
        ("packed", "cancelled", CUSTOMER),  # too late for the customer
    ],
)
def test_invalid_transitions_are_refused(cod_order, start, to, actor):
    Order.objects.filter(pk=cod_order.pk).update(status=start)
    with pytest.raises((ConflictError, DomainError)):
        transition(cod_order, to, actor_type=actor)


def test_cancel_releases_stock_once(cod_order, shop):
    stock_after_order = ProductVariant.objects.get(pk=vid(shop["shirt"])).stock
    transition(cod_order, "cancelled", actor_type=CUSTOMER, note="Ordered twice")
    assert ProductVariant.objects.get(pk=vid(shop["shirt"])).stock == stock_after_order + 2
    with pytest.raises(ConflictError):
        transition(cod_order, "cancelled", actor_type=STAFF)


def test_cancelling_a_paid_order_refunds_it(api, shop, razorpay_client):
    from .conftest import razorpay_signature

    data = api.post(
        "/api/v1/checkout/",
        guest_payload([(vid(shop["shirt"]), 1)], payment_method="razorpay"),
        format="json",
    ).data["order"]
    api.post(
        "/api/v1/payments/razorpay/verify/",
        {
            "order_number": data["number"],
            "token": data["access_token"],
            "razorpay_order_id": "order_test_1",
            "razorpay_payment_id": "pay_9",
            "razorpay_signature": razorpay_signature("order_test_1", "pay_9"),
        },
        format="json",
    )
    order = transition(Order.objects.get(number=data["number"]), "cancelled", actor_type=STAFF, note="Out of stock")
    order.refresh_from_db()
    assert order.payment_status == "refunded"
    razorpay_client.payment.refund.assert_called_once()
    assert Refund.objects.get().status == Refund.Status.PROCESSED


@override_settings(RAZORPAY_WEBHOOK_SECRET="webhook_secret")
def test_webhook_signature_and_idempotency(api, shop, razorpay_client):
    import hashlib
    import hmac

    data = api.post(
        "/api/v1/checkout/",
        guest_payload([(vid(shop["shirt"]), 1)], payment_method="razorpay"),
        format="json",
    ).data["order"]
    body = json.dumps(
        {
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay_7", "order_id": "order_test_1", "method": "upi"}}},
        }
    ).encode()
    signature = hmac.new(b"webhook_secret", body, hashlib.sha256).hexdigest()

    bad = api.generic(
        "POST",
        "/api/v1/payments/razorpay/webhook/",
        body,
        content_type="application/json",
        HTTP_X_RAZORPAY_SIGNATURE="nope",
    )
    assert bad.status_code == 400

    for _ in range(2):
        ok = api.generic(
            "POST",
            "/api/v1/payments/razorpay/webhook/",
            body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=signature,
            HTTP_X_RAZORPAY_EVENT_ID="evt_1",
        )
        assert ok.status_code == 200
    order = Order.objects.get(number=data["number"])
    assert order.status == "placed"
    assert Payment.objects.get().method == "upi"
    assert WebhookEvent.objects.count() == 1
    assert order.events.filter(to_status="placed").count() == 1


def test_late_capture_after_stock_sold_is_refunded(api, shop, razorpay_client):
    lamp = shop["lamp"]
    data = api.post(
        "/api/v1/checkout/", guest_payload([(vid(lamp), 1)], payment_method="razorpay"), format="json"
    ).data["order"]
    order = transition(Order.objects.get(number=data["number"]), "payment_failed", actor_type=SYSTEM)
    # Someone else buys the last lamp meanwhile.
    api.post("/api/v1/checkout/", guest_payload([(vid(lamp), 1)], email="grace@example.com"), format="json")
    handle_webhook(
        "razorpay",
        WebhookPayload(
            event_id="evt_late",
            event_type="payment.captured",
            payload={"payload": {"payment": {"entity": {"id": "pay_late", "order_id": "order_test_1"}}}},
        ),
    )
    order.refresh_from_db()
    assert order.status == "cancelled" and order.payment_status == "refunded"
    assert ProductVariant.objects.get(pk=vid(lamp)).stock == 0
