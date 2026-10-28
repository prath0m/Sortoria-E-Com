from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from apps.catalog.models import ProductVariant
from apps.core.exceptions import ConflictError
from apps.orders.models import Order
from apps.orders.services.returns import transition_return
from apps.orders.services.state_machine import STAFF, transition
from apps.payments.models import Refund
from tests.factories import make_category, make_product, png_file

from .conftest import guest_payload, razorpay_signature, vid

pytestmark = pytest.mark.django_db(transaction=True)


def place(api, product, qty=2, **overrides):
    data = api.post("/api/v1/checkout/", guest_payload([(vid(product), qty)], **overrides), format="json").data
    return Order.objects.get(number=data["order"]["number"])


def deliver(order):
    Order.objects.filter(pk=order.pk).update(courier_name="Delhivery", tracking_number="DL1")
    for status in ("confirmed", "packed", "shipped", "delivered"):
        transition(order, status, actor_type=STAFF)
    order.refresh_from_db()
    return order


def test_order_history_and_customer_cancel(auth, customer, shop):
    client = auth(customer)
    client.post("/api/v1/cart/items/", {"variant_id": vid(shop["shirt"]), "quantity": 1}, format="json")
    from .conftest import ADDRESS

    number = client.post(
        "/api/v1/checkout/",
        {"shipping_address": ADDRESS, "shipping_method": "standard", "payment_method": "cod"},
        format="json",
    ).data["order"]["number"]
    listing = client.get("/api/v1/orders/").data
    assert listing["count"] == 1 and listing["results"][0]["number"] == number
    cancelled = client.post(f"/api/v1/orders/{number}/cancel/", {"reason": "Ordered the wrong size"}, format="json")
    assert cancelled.status_code == 200 and cancelled.data["status"] == "cancelled"
    assert ProductVariant.objects.get(pk=vid(shop["shirt"])).stock == 5
    again = client.post(f"/api/v1/orders/{number}/cancel/", {}, format="json")
    assert again.status_code == 409


def test_public_tracking_by_email_or_phone(api, shop):
    order = place(api, shop["shirt"], qty=1)
    assert (
        api.post(
            "/api/v1/orders/track/", {"number": order.number, "contact": "ADA@example.com"}, format="json"
        ).status_code
        == 200
    )
    by_phone = api.post(
        "/api/v1/orders/track/", {"number": order.number.lower(), "contact": "+91 98765 43210"}, format="json"
    )
    assert by_phone.status_code == 200 and by_phone.data["access_token"]
    wrong = api.post("/api/v1/orders/track/", {"number": order.number, "contact": "someone@else.com"}, format="json")
    assert wrong.status_code == 404


def test_returns_only_after_delivery_and_within_window(api, shop):
    order = place(api, shop["shirt"])
    items = api.get(f"/api/v1/orders/{order.number}/returnable-items/", {"token": order.guest_access_token}).data[
        "items"
    ]
    assert items[0]["eligible"] is False

    deliver(order)
    items = api.get(f"/api/v1/orders/{order.number}/returnable-items/", {"token": order.guest_access_token}).data[
        "items"
    ]
    assert items[0]["eligible"] and items[0]["returnable_quantity"] == 2

    Order.objects.filter(pk=order.pk).update(delivered_at=timezone.now() - timedelta(days=40))
    items = api.get(f"/api/v1/orders/{order.number}/returnable-items/", {"token": order.guest_access_token}).data[
        "items"
    ]
    assert items[0]["eligible"] is False and "window" in items[0]["note"]


def _request(api, order, *, item_qty=1, reason="wrong_size", **extra):
    item = order.items.first()
    return api.post(
        "/api/v1/returns/",
        {
            "order_number": order.number,
            "token": order.guest_access_token,
            "items": f'[{{"order_item_id": {item.pk}, "quantity": {item_qty}}}]',
            "reason": reason,
            **extra,
        },
        format="multipart",
    )


def test_cod_return_needs_upi_and_damage_needs_photos(api, shop):
    order = deliver(place(api, shop["shirt"]))
    no_upi = _request(api, order)
    assert no_upi.status_code == 400 and no_upi.data["code"] == "upi_required"
    no_photo = _request(api, order, reason="damaged", refund_upi_id="ada@okbank")
    assert no_photo.status_code == 400 and no_photo.data["code"] == "photos_required"
    too_many = _request(api, order, item_qty=3, refund_upi_id="ada@okbank")
    assert too_many.status_code == 400 and too_many.data["code"] == "quantity"


def test_cod_return_lifecycle_restocks_and_records_manual_refund(api, shop):
    order = deliver(place(api, shop["shirt"]))
    stock_before = ProductVariant.objects.get(pk=vid(shop["shirt"])).stock
    mail.outbox.clear()
    created = _request(api, order, refund_upi_id="ada@okbank", comments="Runs a size small.")
    assert created.status_code == 201, created.data
    assert created.data["refund_amount_paise"] == 349900  # one of two shirts
    ret = order.returns.get()

    with pytest.raises(ConflictError):
        transition_return(ret, "refunded")  # can't skip inspection
    transition_return(ret, "approved")
    transition_return(ret, "pickup_scheduled", pickup_date=timezone.localdate() + timedelta(days=2))
    transition_return(ret, "received")
    assert ProductVariant.objects.get(pk=vid(shop["shirt"])).stock == stock_before + 1
    transition_return(ret, "refunded")
    order.refresh_from_db()
    assert order.payment_status == "partially_refunded"
    assert Refund.objects.get().status == Refund.Status.MANUAL
    assert len(mail.outbox) == 5  # requested, approved, pickup, received, refunded
    assert api.get(f"/api/v1/returns/{ret.number}/", {"token": order.guest_access_token}).data["status"] == "refunded"


def test_prepaid_return_refunds_through_gateway(api, shop, razorpay_client):
    order = place(api, shop["shirt"], qty=1, payment_method="razorpay")
    api.post(
        "/api/v1/payments/razorpay/verify/",
        {
            "order_number": order.number,
            "token": order.guest_access_token,
            "razorpay_order_id": "order_test_1",
            "razorpay_payment_id": "pay_1",
            "razorpay_signature": razorpay_signature("order_test_1", "pay_1"),
        },
        format="json",
    )
    order = deliver(order)
    assert _request(api, order).status_code == 201
    ret = order.returns.get()
    for status in ("approved", "pickup_scheduled", "received", "refunded"):
        transition_return(ret, status, pickup_date=timezone.localdate())
    razorpay_client.payment.refund.assert_called_once_with(
        "pay_1", {"amount": 349900, "notes": {"reason": f"Return {ret.number}"}}
    )
    order.refresh_from_db()
    assert order.payment_status == "refunded"


def test_non_returnable_items_accept_only_fault_claims(api, shop):
    beauty = make_category("Beauty", return_policy="non_returnable")
    serum = make_product("Glow Serum", category=beauty, price=189000, stock=5)
    order = deliver(place(api, serum, qty=1))
    changed_mind = _request(api, order, reason="changed_mind", refund_upi_id="ada@okbank")
    assert changed_mind.status_code == 400 and changed_mind.data["code"] == "not_returnable"
    damaged = _request(
        api, order, reason="damaged", refund_upi_id="ada@okbank", photos=[png_file("broken.png", size=(400, 400))]
    )
    assert damaged.status_code == 201


def test_replacement_only_items_are_replaced_not_refunded(api, shop):
    tech = make_category("Electronics", return_policy="replacement_only", return_window_days=7)
    buds = make_product("Earbuds", category=tech, price=699000, stock=5)
    order = deliver(place(api, buds, qty=1))
    created = _request(api, order, reason="defective", photos=[png_file("crackle.png", size=(400, 400))])
    assert created.status_code == 201 and created.data["resolution"] == "replacement"
    assert created.data["refund_amount_paise"] == 0
