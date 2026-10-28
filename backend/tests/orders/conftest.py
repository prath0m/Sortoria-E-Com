import hashlib
import hmac
from unittest import mock

import pytest
from django.conf import settings

from apps.core.models import StoreSettings
from tests.factories import make_product, shipping_setup

ADDRESS = {
    "full_name": "Ada Lovelace",
    "phone": "9876543210",
    "line1": "22 Residency Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560025",
}


@pytest.fixture
def shop(db):
    shipping_setup()
    store = StoreSettings.load()
    store.state_code = "27"
    store.gstin = "27AAKCS1234M1Z5"
    store.save()
    return {
        "shirt": make_product("Linen Shirt", price=349900, stock=5, tax_rate=5),
        "lamp": make_product("Desk Lamp", price=899000, stock=1, tax_rate=18),
    }


def vid(product):
    return product.variants.first().pk


def guest_payload(lines, **overrides):
    return {
        "email": "ada@example.com",
        "phone": "9876543210",
        "shipping_address": ADDRESS,
        "lines": [{"variant_id": v, "quantity": q} for v, q in lines],
        "shipping_method": "standard",
        "payment_method": "cod",
        **overrides,
    }


def razorpay_signature(order_id: str, payment_id: str) -> str:
    return hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()


@pytest.fixture
def razorpay_client():
    """Stand-in for the Razorpay SDK: deterministic order ids, recorded refunds."""
    client = mock.MagicMock()
    counter = {"n": 0}

    def create(data):
        counter["n"] += 1
        return {"id": f"order_test_{counter['n']}", "amount": data["amount"], "currency": "INR"}

    client.order.create.side_effect = create
    client.payment.refund.return_value = {"id": "rfnd_test_1", "status": "processed"}
    with mock.patch("apps.payments.providers.razorpay.razorpay.Client", return_value=client):
        yield client
