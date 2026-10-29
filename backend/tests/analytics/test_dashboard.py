from datetime import timedelta

import pytest
from django.utils import timezone

from apps.analytics.models import DailyMetric, PageVisit
from apps.analytics.services import parse_range
from apps.catalog.models import ProductView
from apps.core.models import AdminNotification
from apps.orders.models import Order, OrderItem
from tests.factories import make_product

pytestmark = pytest.mark.django_db


def order(number, *, days_ago, total, status="delivered", email="a@example.com", product=None, qty=1):
    placed = timezone.now() - timedelta(days=days_ago)
    o = Order.objects.create(
        number=number,
        email=email,
        phone="9876543210",
        status=status,
        payment_method="cod",
        shipping_address={"full_name": "Ada"},
        billing_address={},
        shipping_method="standard",
        subtotal_paise=total,
        grand_total_paise=total,
        placed_at=placed,
    )
    Order.objects.filter(pk=o.pk).update(created_at=placed)
    if product:
        OrderItem.objects.create(
            order=o,
            product_id_snapshot=product.pk,
            product_name=product.name,
            sku="X",
            mrp_paise=total,
            unit_price_paise=total,
            quantity=qty,
            tax_rate=5,
            tax_paise=0,
            line_total_paise=total,
        )
    return o


def test_dashboard_requires_staff(api, auth, customer, manager):
    assert api.get("/api/v1/admin/analytics/dashboard/").status_code == 401
    assert auth(customer).get("/api/v1/admin/analytics/dashboard/").status_code == 403
    assert auth(manager).get("/api/v1/admin/analytics/dashboard/").status_code == 200


def test_kpis_compare_with_previous_period(auth, manager):
    lamp = make_product("Desk Lamp", price=500000)
    order("A1", days_ago=2, total=300000, product=lamp, email="new@example.com")
    order("A2", days_ago=5, total=100000, product=lamp, email="old@example.com")
    order("A0", days_ago=40, total=200000, product=lamp, email="old@example.com")  # previous 30d window
    order("X1", days_ago=3, total=999999, status="cancelled")  # not revenue
    today = timezone.localdate()
    for back in range(0, 30):
        DailyMetric.objects.create(date=today - timedelta(days=back), visits=10)

    data = auth(manager).get("/api/v1/admin/analytics/dashboard/", {"range": "30d"}).data
    k = data["kpis"]
    assert k["revenue"]["value"] == 400000 and k["revenue"]["previous"] == 200000 and k["revenue"]["change"] == 100.0
    assert k["orders"]["value"] == 2 and k["aov"]["value"] == 200000
    assert k["customers"]["value"] == 2
    assert k["conversion"]["value"] == round(2 * 100 / 300, 2)
    assert len(data["revenue_series"]) == 30
    assert sum(b["revenue"] for b in data["revenue_series"]) == 400000
    assert data["top_products"][0] == {"product_id": lamp.pk, "name": "Desk Lamp", "revenue": 400000, "units": 2}
    split = {k: sum(b[k] for b in data["customer_split"]) for k in ("new", "returning")}
    assert split == {"new": 1, "returning": 1}
    assert {s["label"]: s["count"] for s in data["orders_by_status"]}["Cancelled"] == 1


def test_ranges_and_granularity():
    assert parse_range("today").granularity == "hour"
    assert parse_range("12m").granularity == "month"
    custom = parse_range("custom", "2026-03-10", "2026-03-01")  # reversed input is tolerated
    assert custom.start.date().isoformat() == "2026-03-01" and custom.granularity == "day"
    assert parse_range("custom", "2026-01-01", "2026-12-31").granularity == "month"


def test_low_stock_kpi_and_list(auth, manager):
    product = make_product("Scarce Scarf", stock=1)
    make_product("Plenty Throw", stock=40)
    data = auth(manager).get("/api/v1/admin/analytics/dashboard/").data
    assert data["kpis"]["low_stock"]["value"] == 1
    assert data["low_stock"][0]["product_id"] == product.pk


def test_beacon_records_visits_and_product_views(api):
    product = make_product()
    payload = {"session_id": "abcd1234-ef", "path": "/products/x", "product_id": product.pk}
    assert api.post("/api/v1/analytics/events/", payload, format="json").status_code == 204
    api.post("/api/v1/analytics/events/", {"session_id": "bad id!", "path": "/"}, format="json")
    api.post("/api/v1/analytics/events/", {"session_id": "abcd1234-ef", "path": "/admin"}, format="json")
    assert PageVisit.objects.count() == 1
    assert ProductView.objects.get(product=product).views == 1


def test_notifications_unread_and_mark_read(auth, manager, admin_user):
    for i in range(3):
        AdminNotification.objects.create(kind="new_order", title=f"Order {i}")
    client = auth(manager)
    assert client.get("/api/v1/admin/notifications/").data["unread"] == 3
    first = client.get("/api/v1/admin/notifications/").data["results"][0]["id"]
    client.post("/api/v1/admin/notifications/", {"ids": [first]}, format="json")
    assert client.get("/api/v1/admin/notifications/").data["unread"] == 2
    client.post("/api/v1/admin/notifications/", {"all": True}, format="json")
    assert client.get("/api/v1/admin/notifications/").data["unread"] == 0
    assert auth(admin_user).get("/api/v1/admin/notifications/").data["unread"] == 3  # read state is per person


def test_global_search_respects_capabilities(auth, manager, customer):
    order("SRT-2026-009999", days_ago=1, total=1000, email="grace@example.com")
    make_product("Grace Bracelet")
    data = auth(manager).get("/api/v1/admin/search/", {"q": "grace"}).data
    assert data["orders"][0]["number"] == "SRT-2026-009999"
    assert data["products"][0]["name"] == "Grace Bracelet"
    assert auth(customer).get("/api/v1/admin/search/", {"q": "grace"}).status_code == 403
