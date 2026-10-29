"""Every admin endpoint, every role: access must match the capability table exactly."""

import pytest

from apps.core.permissions import CAPABILITIES
from tests.factories import UserFactory

pytestmark = pytest.mark.django_db

# (method, path, capability that grants it). Bodies are empty: a permitted write may 400, but never 401/403.
ENDPOINTS = [
    ("get", "/api/v1/admin/analytics/dashboard/", "dashboard.view"),
    ("get", "/api/v1/admin/notifications/", "dashboard.view"),
    ("get", "/api/v1/admin/search/?q=a", "dashboard.view"),
    ("get", "/api/v1/admin/products/", "catalog.edit"),
    ("post", "/api/v1/admin/products/", "catalog.edit"),
    ("get", "/api/v1/admin/catalog/options/", "catalog.edit"),
    ("get", "/api/v1/admin/categories/", "catalog.edit"),
    ("get", "/api/v1/admin/brands/", "catalog.edit"),
    ("get", "/api/v1/admin/attributes/", "catalog.edit"),
    ("get", "/api/v1/admin/inventory/", "inventory.manage"),
    ("post", "/api/v1/admin/inventory/bulk/", "inventory.manage"),
    ("get", "/api/v1/admin/orders/", "orders.view"),
    ("post", "/api/v1/admin/orders/bulk/", "orders.view"),
    ("get", "/api/v1/admin/returns/", "returns.manage"),
    ("get", "/api/v1/admin/customers/", "customers.view"),
    ("get", "/api/v1/admin/reviews/", "reviews.manage"),
    ("get", "/api/v1/admin/coupons/", "offers.manage"),
    ("get", "/api/v1/admin/sales/", "offers.manage"),
    ("get", "/api/v1/admin/bundles/", "offers.manage"),
    ("get", "/api/v1/admin/cms/hero-slides/", "cms.manage"),
    ("get", "/api/v1/admin/cms/sections/", "cms.manage"),
    ("get", "/api/v1/admin/cms/banners/", "cms.manage"),
    ("get", "/api/v1/admin/cms/pages/", "cms.manage"),
    ("get", "/api/v1/admin/newsletter/", "cms.manage"),
    ("get", "/api/v1/admin/shipping/methods/", "shipping.manage"),
    ("get", "/api/v1/admin/shipping/zones/", "shipping.manage"),
    ("get", "/api/v1/admin/shipping/pincodes/", "shipping.manage"),
    ("get", "/api/v1/admin/settings/", "settings.manage"),
    ("patch", "/api/v1/admin/settings/", "settings.manage"),
    ("get", "/api/v1/admin/staff/", "staff.manage"),
    ("post", "/api/v1/admin/staff/", "staff.manage"),
    ("get", "/api/v1/admin/audit-log/", "audit.view"),
    ("get", "/api/v1/admin/imports/", "export.run"),
    ("get", "/api/v1/admin/export/orders/", "orders.view"),
    ("get", "/api/v1/admin/export/pincodes/", "shipping.manage"),
]

# Capabilities that are checked inside a view on top of the endpoint's own permission.
INNER = {"/api/v1/admin/export/orders/": "export.run", "/api/v1/admin/export/pincodes/": "export.run"}

ROLES = ["anonymous", "customer", "manager", "admin"]


def allowed(role: str, capability: str, path: str) -> bool:
    if role in ("anonymous", "customer"):
        return False
    needed = [capability] + ([INNER[path]] if path in INNER else [])
    return all(role in CAPABILITIES[c] for c in needed)


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize(("method", "path", "capability"), ENDPOINTS, ids=[f"{m} {p}" for m, p, _ in ENDPOINTS])
def test_admin_access_matches_capabilities(api, role, method, path, capability):
    if role != "anonymous":
        api.force_authenticate(UserFactory(role=role))
    response = getattr(api, method)(path, {}, format="json")
    if allowed(role, capability, path):
        assert response.status_code not in (401, 403), f"{role} should reach {method.upper()} {path}"
    else:
        expected = 401 if role == "anonymous" else 403
        assert response.status_code == expected, f"{role} got {response.status_code} on {method.upper()} {path}"


def test_every_capability_is_exercised():
    covered = {c for _, _, c in ENDPOINTS} | set(INNER.values())
    # Refunds and destructive catalogue actions are covered by their own tests.
    assert set(CAPABILITIES) - covered <= {
        "orders.manage",
        "orders.refund",
        "customers.manage",
        "catalog.delete",
        "import.run",
    }


def test_capabilities_reported_to_the_ui_match(api):
    for role in ("manager", "admin"):
        api.force_authenticate(UserFactory(role=role))
        caps = set(api.get("/api/v1/auth/me/").json()["capabilities"])
        assert caps == {c for c, roles in CAPABILITIES.items() if role in roles}
    api.force_authenticate(UserFactory(role="customer"))
    assert api.get("/api/v1/auth/me/").json()["capabilities"] == []
