import pytest

from apps.orders.models import Order
from apps.orders.services.state_machine import STAFF, transition
from apps.reviews.models import Review
from tests.factories import UserFactory, make_product
from tests.orders.conftest import ADDRESS, guest_payload, shop, vid  # noqa: F401

pytestmark = pytest.mark.django_db(transaction=True)


def place(api, product, **kw):
    number = api.post("/api/v1/checkout/", guest_payload([(vid(product), 1)], **kw), format="json").data["order"][
        "number"
    ]
    return Order.objects.get(number=number)


def test_order_list_filters_and_search(api, auth, manager, shop):  # noqa: F811
    first = place(api, shop["shirt"])
    second = place(api, shop["shirt"], email="grace@example.com")
    transition(second, "confirmed", actor_type=STAFF)
    client = auth(manager)
    assert client.get("/api/v1/admin/orders/", {"status": "confirmed"}).data["count"] == 1
    assert client.get("/api/v1/admin/orders/", {"search": "grace"}).data["results"][0]["number"] == second.number
    row = client.get("/api/v1/admin/orders/", {"search": first.number}).data["results"][0]
    assert row["item_count"] == 1 and row["customer"] == "Ada Lovelace"


def test_transition_with_tracking_and_audit(api, auth, manager, shop):  # noqa: F811
    order = place(api, shop["shirt"])
    client = auth(manager)
    detail = client.get(f"/api/v1/admin/orders/{order.number}/").data
    assert [t["status"] for t in detail["allowed_transitions"]] == ["confirmed", "cancelled"]
    for status in ("confirmed", "packed"):
        client.post(f"/api/v1/admin/orders/{order.number}/transition/", {"status": status}, format="json")
    blocked = client.post(f"/api/v1/admin/orders/{order.number}/transition/", {"status": "shipped"}, format="json")
    assert blocked.status_code == 400 and blocked.data["code"] == "tracking_required"
    shipped = client.post(
        f"/api/v1/admin/orders/{order.number}/transition/",
        {"status": "shipped", "courier_name": "Delhivery", "tracking_number": "DL42"},
        format="json",
    )
    assert shipped.data["status"] == "shipped" and shipped.data["tracking_number"] == "DL42"
    invalid = client.post(f"/api/v1/admin/orders/{order.number}/transition/", {"status": "placed"}, format="json")
    assert invalid.status_code == 409
    noted = client.patch(f"/api/v1/admin/orders/{order.number}/", {"internal_note": "Gift wrap"}, format="json")
    assert noted.data["internal_note"] == "Gift wrap"
    from apps.core.models import AuditLog

    assert AuditLog.objects.filter(object_id=str(order.pk), action="transition").count() == 3


def test_bulk_transition_and_merged_invoices(api, auth, manager, shop):  # noqa: F811
    orders = [place(api, shop["shirt"]) for _ in range(2)]
    numbers = [o.number for o in orders]
    client = auth(manager)
    result = client.post(
        "/api/v1/admin/orders/bulk/", {"numbers": numbers, "action": "transition", "status": "confirmed"}, format="json"
    ).data
    assert sorted(result["updated"]) == sorted(numbers) and result["failed"] == []
    again = client.post(
        "/api/v1/admin/orders/bulk/", {"numbers": numbers, "action": "transition", "status": "placed"}, format="json"
    ).data
    assert len(again["failed"]) == 2
    pdf = client.post("/api/v1/admin/orders/bulk/", {"numbers": numbers, "action": "invoices"}, format="json")
    assert pdf["Content-Type"] == "application/pdf" and pdf.content.startswith(b"%PDF")


def test_customers_listing_and_deactivation_rights(api, auth, manager, admin_user, shop):  # noqa: F811
    buyer = UserFactory(email="ada@example.com")
    order = place(api, shop["shirt"])
    Order.objects.filter(pk=order.pk).update(user=buyer)
    row = auth(manager).get("/api/v1/admin/customers/", {"search": "ada@"}).data["results"][0]
    assert row["order_count"] == 1 and row["lifetime_value"] == order.grand_total_paise
    assert (
        auth(manager).patch(f"/api/v1/admin/customers/{buyer.pk}/", {"is_active": False}, format="json").status_code
        == 403
    )
    assert (
        auth(admin_user)
        .patch(f"/api/v1/admin/customers/{buyer.pk}/", {"is_active": False}, format="json")
        .data["is_active"]
        is False
    )
    detail = auth(manager).get(f"/api/v1/admin/customers/{buyer.pk}/").data
    assert detail["orders"][0]["number"] == order.number


def test_review_moderation(auth, manager):
    product = make_product()
    reviews = [
        Review.objects.create(product=product, user=UserFactory(), rating=r, title="t", body="b" * 30) for r in (5, 3)
    ]
    client = auth(manager)
    assert client.get("/api/v1/admin/reviews/", {"status": "pending"}).data["count"] == 2
    client.post("/api/v1/admin/reviews/bulk/", {"ids": [r.pk for r in reviews], "action": "approve"}, format="json")
    product.refresh_from_db()
    assert product.rating_count == 2 and float(product.rating_avg) == 4.0
    replied = client.patch(
        f"/api/v1/admin/reviews/{reviews[1].pk}/", {"status": "rejected", "admin_reply": "Thanks"}, format="json"
    )
    assert replied.data["status"] == "rejected"
    product.refresh_from_db()
    assert product.rating_count == 1


def test_return_admin_flow(api, auth, manager, shop):  # noqa: F811
    from datetime import timedelta

    from django.utils import timezone

    order = place(api, shop["shirt"])
    Order.objects.filter(pk=order.pk).update(courier_name="X", tracking_number="1")
    for status in ("confirmed", "packed", "shipped", "delivered"):
        transition(order, status, actor_type=STAFF)
    item = order.items.first()
    api.post(
        "/api/v1/returns/",
        {
            "order_number": order.number,
            "token": order.guest_access_token,
            "items": f'[{{"order_item_id": {item.pk}, "quantity": 1}}]',
            "reason": "wrong_size",
            "refund_upi_id": "ada@ok",
        },
        format="multipart",
    )
    client = auth(manager)
    ret = client.get("/api/v1/admin/returns/", {"status": "requested"}).data["results"][0]
    detail = client.get(f"/api/v1/admin/returns/{ret['number']}/").data
    assert [t["status"] for t in detail["allowed_transitions"]] == ["approved", "rejected"]
    client.post(f"/api/v1/admin/returns/{ret['number']}/transition/", {"status": "approved"}, format="json")
    no_date = client.post(
        f"/api/v1/admin/returns/{ret['number']}/transition/", {"status": "pickup_scheduled"}, format="json"
    )
    assert no_date.status_code == 400
    tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
    done = client.post(
        f"/api/v1/admin/returns/{ret['number']}/transition/",
        {"status": "pickup_scheduled", "pickup_date": tomorrow},
        format="json",
    )
    assert done.data["status"] == "pickup_scheduled" and done.data["pickup_date"] == tomorrow
