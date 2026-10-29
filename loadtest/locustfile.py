"""Sartoria load test: realistic traffic against the API (and the server-rendered page shell).

    make loadtest                                   # headless, 50 users for 2 minutes, report in loadtest/reports/
    locust -f loadtest/locustfile.py --host http://localhost:8001   # interactive UI on :8089

Mix (by user weight):
  Browsers   ~85%  home, departments, filtered listings, search, product pages, related items
  Shoppers   ~12%  price a bag (guest quote) at a pincode, read delivery estimates
  Staff       ~3%  dashboard, order and product lists, inventory
  Checkout   opt-in (LOADTEST_CHECKOUT=1): places real COD orders, so only against disposable data

Run it against gunicorn with production settings (see README → Load testing); the Django dev
server is single-threaded and would measure itself, not the app.
"""

import os
import random

import requests
from locust import HttpUser, between, events, task

HEADERS = {"X-Sartoria-Client": "1", "Accept": "application/json"}
CATALOG: dict[str, list] = {"products": [], "variants": [], "categories": [], "terms": ["lamp", "shirt", "watch", "bag", "tea", "shoe"]}
PINCODES = ["400001", "110003", "560025", "600001", "700001"]


@events.test_start.add_listener
def load_catalog(environment, **_kwargs):
    """Fetch real slugs and variant ids once, so every request hits real data."""
    host = environment.host.rstrip("/")
    categories = requests.get(f"{host}/api/v1/store/navigation/", headers=HEADERS, timeout=30).json()["categories"]
    CATALOG["categories"] = [c["slug"] for c in categories] + [ch["slug"] for c in categories for ch in c["children"]]
    page = 1
    while page and page <= 5:  # up to 240 products is plenty of variety
        listing = requests.get(f"{host}/api/v1/products/", params={"page": page, "page_size": 48}, headers=HEADERS, timeout=30)
        listing.raise_for_status()
        body = listing.json()
        CATALOG["products"] += [p["slug"] for p in body["results"]]
        page = page + 1 if body["next"] else None
    for slug in random.sample(CATALOG["products"], min(30, len(CATALOG["products"]))):
        detail = requests.get(f"{host}/api/v1/products/{slug}/", headers=HEADERS, timeout=30).json()
        CATALOG["variants"] += [v["id"] for v in detail["variants"] if v["stock"] > 0]
    if not (CATALOG["products"] and CATALOG["categories"] and CATALOG["variants"]):
        # Fail loudly: an empty catalogue would make every task raise and silently send nothing.
        environment.runner.quit()
        raise RuntimeError("Load test needs seeded data (make seed) on the target host.")
    print(f"catalogue: {len(CATALOG['products'])} products, {len(CATALOG['categories'])} categories, {len(CATALOG['variants'])} variants")


class Browser(HttpUser):
    """Someone looking around: most of the traffic."""

    weight = 85
    wait_time = between(1, 4)

    def on_start(self):
        self.client.headers.update(HEADERS)

    @task(4)
    def home(self):
        self.client.get("/api/v1/home/", name="home")
        self.client.get("/api/v1/store/settings/", name="settings")

    @task(3)
    def page_shell(self):
        # The HTML a first visit or a crawler gets: meta, inlined data, preloads.
        self.client.get(f"/products/{random.choice(CATALOG['products'])}", name="html: product page", headers={"Accept": "text/html"})

    @task(6)
    def department(self):
        slug = random.choice(CATALOG["categories"])
        self.client.get(f"/api/v1/categories/{slug}/", name="category")
        self.client.get("/api/v1/products/", params={"category": slug, "page": 1}, name="listing")
        self.client.get("/api/v1/products/facets/", params={"category": slug}, name="facets")

    @task(3)
    def filtered(self):
        self.client.get(
            "/api/v1/products/",
            params={"category": random.choice(CATALOG["categories"]), "sort": random.choice(["price_asc", "newest", "rating"]), "in_stock": "true"},
            name="listing (filtered)",
        )

    @task(3)
    def search(self):
        term = random.choice(CATALOG["terms"])
        self.client.get("/api/v1/search/suggest/", params={"q": term[:3]}, name="search suggest")
        self.client.get("/api/v1/products/", params={"q": term}, name="search results")

    @task(6)
    def product(self):
        slug = random.choice(CATALOG["products"])
        self.client.get(f"/api/v1/products/{slug}/", name="product")
        self.client.get(f"/api/v1/products/{slug}/related/", name="related")
        self.client.get(f"/api/v1/products/{slug}/reviews/", name="reviews")


class Shopper(HttpUser):
    """Building a bag as a guest: the pricing engine on every change."""

    weight = 12
    wait_time = between(2, 5)

    def on_start(self):
        self.client.headers.update(HEADERS)

    def _lines(self):
        return [{"variant_id": v, "quantity": random.randint(1, 2)} for v in random.sample(CATALOG["variants"], k=random.randint(1, 3))]

    @task(5)
    def quote(self):
        self.client.post(
            "/api/v1/cart/quote/",
            json={"lines": self._lines(), "pincode": random.choice(PINCODES), "shipping_method": "standard", "payment_method": "cod"},
            name="bag quote",
        )

    @task(1)
    def delivery_estimate(self):
        self.client.get(
            "/api/v1/shipping/estimate/",
            params={"pincode": random.choice(PINCODES), "product": random.choice(CATALOG["products"])},
            name="delivery estimate",
        )


class Staff(HttpUser):
    """A team member working in the admin."""

    weight = 3
    wait_time = between(3, 8)

    def on_start(self):
        self.client.headers.update(HEADERS)
        email = os.environ.get("LOADTEST_STAFF_EMAIL", "manager@sartoria.test")
        password = os.environ.get("LOADTEST_STAFF_PASSWORD", "Sartoria@Manager1")
        response = self.client.post("/api/v1/auth/login/", json={"email": email, "password": password}, name="staff login")
        if response.ok:
            self.client.headers["Authorization"] = f"Bearer {response.json()['access']}"

    @task(3)
    def dashboard(self):
        self.client.get("/api/v1/admin/analytics/dashboard/", params={"range": "30d"}, name="admin: dashboard")

    @task(4)
    def orders(self):
        self.client.get("/api/v1/admin/orders/", params={"status": "placed"}, name="admin: orders")

    @task(2)
    def products(self):
        self.client.get("/api/v1/admin/products/", params={"ordering": "-updated_at"}, name="admin: products")

    @task(1)
    def inventory(self):
        self.client.get("/api/v1/admin/inventory/", params={"stock": "low"}, name="admin: low stock")


if os.environ.get("LOADTEST_CHECKOUT") == "1":

    class Buyer(HttpUser):
        """Places real cash-on-delivery orders. Opt-in: it consumes stock and creates orders."""

        weight = 2
        wait_time = between(10, 20)

        def on_start(self):
            self.client.headers.update(HEADERS)

        @task
        def checkout(self):
            payload = {
                "email": f"load+{random.randint(1, 10**9)}@example.com",
                "phone": "9876543210",
                "shipping_address": {
                    "full_name": "Load Test",
                    "phone": "9876543210",
                    "line1": "1 Test Street",
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "pincode": "400001",
                },
                "lines": [{"variant_id": random.choice(CATALOG["variants"]), "quantity": 1}],
                "shipping_method": "standard",
                "payment_method": "cod",
            }
            with self.client.post("/api/v1/checkout/", json=payload, name="checkout", catch_response=True) as response:
                # Sold-out races are a correct outcome under load, not a failure.
                if response.status_code == 409:
                    response.success()
