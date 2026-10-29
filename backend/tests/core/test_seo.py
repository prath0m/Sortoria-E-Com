"""Server-side meta injection, robots.txt and sitemap.xml."""

import json
import re

import pytest

from apps.catalog.models import Product
from apps.cms.models import Page
from apps.core import caching
from tests.factories import make_category, make_product

pytestmark = pytest.mark.django_db

SHELL = """<!doctype html><html><head>
<!--sartoria:head--><title>Placeholder</title><!--/sartoria:head-->
</head><body><div id="root"></div><!--sartoria:bootstrap--><script src="/assets/app.js"></script></body></html>"""


@pytest.fixture
def dist(tmp_path, settings):
    (tmp_path / "index.html").write_text(SHELL)
    settings.FRONTEND_DIST = tmp_path
    settings.FRONTEND_URL = "https://shop.example.in"
    caching.bump(caching.CATALOG)
    return tmp_path


def json_ld(html):
    return [
        json.loads(b) for b in re.findall(r'<script data-rh="true" type="application/ld\+json">(.*?)</script>', html)
    ]


def test_product_page_gets_meta_and_structured_data(client, dist):
    category = make_category("Audio", make_category("Electronics"))
    product = make_product(
        "Studio Headphones", category=category, price=1299900, short_description="Closed-back, warm."
    )
    html = client.get(f"/products/{product.slug}").content.decode()
    assert "<title>Studio Headphones — Sartoria</title>" in html and "Placeholder" not in html
    assert '<meta data-rh="true" name="description" content="Closed-back, warm." />' in html
    assert f'<link data-rh="true" rel="canonical" href="https://shop.example.in/products/{product.slug}" />' in html
    data, crumbs = json_ld(html)
    assert data["@type"] == "Product" and data["offers"]["lowPrice"] == "12999.00"
    assert data["offers"]["availability"].endswith("InStock")
    assert [i["name"] for i in crumbs["itemListElement"]] == ["Home", "Electronics", "Audio", "Studio Headphones"]
    assert "window.__SARTORIA_SETTINGS__=" in html and '"name":"Sartoria"' in html


def test_values_are_escaped(client, dist):
    product = make_product('Evil "Quote" </script><script>alert(1)</script>')
    html = client.get(f"/products/{product.slug}").content.decode()
    assert "<script>alert(1)" not in html
    assert "&quot;Quote&quot;" in html  # attribute values
    assert "\\u003c/script>" in html  # escaped inside JSON-LD, which still parses:
    assert json_ld(html)[0]["name"].startswith('Evil "Quote" </script>')


def test_missing_and_private_pages_are_not_indexed(client, dist):
    missing = client.get("/products/no-such-thing")
    assert missing.status_code == 404 and b'name="robots" content="noindex' in missing.content
    inactive = make_product("Hidden Lamp", is_active=False)
    assert client.get(f"/products/{inactive.slug}").status_code == 404
    cart = client.get("/checkout")
    assert cart.status_code == 200 and b"noindex" in cart.content and b'rel="canonical"' not in cart.content
    home = client.get("/").content.decode()
    assert {b["@type"] for b in json_ld(home)} == {"Organization", "WebSite"}
    # The API and Django admin are never swallowed by the SPA route.
    assert client.get("/api/v1/health/").json() == {"status": "ok"}


def test_robots_and_sitemap(client, dist):
    live = make_product("Linen Throw")
    hidden = make_product("Retired Throw", is_active=False)
    Page.objects.create(title="Shipping", body="<p>Fast</p>")
    robots = client.get("/robots.txt").content.decode()
    assert "Disallow: /checkout" in robots and "Sitemap: https://shop.example.in/sitemap.xml" in robots
    sitemap = client.get("/sitemap.xml").content.decode()
    assert f"https://shop.example.in/products/{live.slug}" in sitemap
    assert hidden.slug not in sitemap
    assert "https://shop.example.in/pages/shipping" in sitemap
    # Catalogue edits refresh the cached sitemap.
    Product.objects.filter(pk=live.pk).update(is_active=False)
    caching.bump(caching.CATALOG)
    assert live.slug not in client.get("/sitemap.xml").content.decode()


def inlined(html):
    match = re.search(r"window\.__SARTORIA_DATA__=(\{.*?\})</script>", html, re.S)
    return json.loads(match.group(1)) if match else {}


def test_first_load_data_is_inlined_for_anonymous_visitors(client, dist):
    category = make_category("Lamps", make_category("Home"))
    product = make_product("Brass Lamp", category=category)
    data = inlined(client.get(f"/products/{product.slug}").content.decode())
    assert set(data) == {"/store/navigation/", "/pages/", f"/products/{product.slug}/"}
    assert data[f"/products/{product.slug}/"]["name"] == "Brass Lamp"

    listing = inlined(client.get(f"/shop/{category.slug}").content.decode())
    # Keys match exactly what the client builds for an unfiltered first page.
    assert f"/products/?category={category.slug}&page=1" in listing
    assert f"/products/facets/?category={category.slug}" in listing
    # Filtered URLs build other queries, so only the shared reads are inlined.
    filtered = inlined(client.get(f"/shop/{category.slug}?sort=price").content.decode())
    assert set(filtered) == {"/store/navigation/", "/pages/"}
    # Missing pages inline nothing page-specific.
    assert inlined(client.get("/products/nope").content.decode()) == {}


def test_route_chunks_are_preloaded_from_the_vite_manifest(client, dist):
    (dist / ".vite").mkdir()
    (dist / ".vite" / "manifest.json").write_text(
        json.dumps(
            {
                "index.html": {"file": "assets/index.js", "isEntry": True},
                "src/features/storefront/product/ProductPage.tsx": {
                    "file": "assets/ProductPage.js",
                    "imports": ["index.html", "_Badge.js"],
                    "css": ["assets/ProductPage.css"],
                },
                "_Badge.js": {"file": "assets/Badge.js"},
            }
        )
    )
    html = client.get(f"/products/{make_product('Tea Tin').slug}").content.decode()
    assert '<link rel="modulepreload" crossorigin href="/assets/ProductPage.js" />' in html
    assert 'href="/assets/Badge.js"' in html and 'href="/assets/index.js"' not in html
    assert '<link rel="stylesheet" crossorigin href="/assets/ProductPage.css" />' in html


def test_shell_is_gzipped_when_accepted(client, dist):
    response = client.get("/", HTTP_ACCEPT_ENCODING="gzip, br")
    assert response["Content-Encoding"] == "gzip" and "Accept-Encoding" in response["Vary"]


@pytest.mark.django_db(transaction=True)
def test_largest_image_is_preloaded_and_painted_before_the_app(client, dist):
    product = make_product("Linen Robe", with_image=True)  # renditions build in the eager Celery task
    html = client.get(f"/products/{product.slug}").content.decode()
    preloads = re.findall(r'<link rel="preload" as="image"[^>]+>', html)
    assert len(preloads) == 2 and 'media="(max-width: 1023px)"' in preloads[0]
    assert ".webp 400w" in preloads[0]
    # The static stand-in sits inside #root (React replaces it) and reuses the same candidates.
    root = html.split('<div id="root">', 1)[1]
    assert root.startswith('<div aria-hidden="true"') and 'sizes="(min-width: 1280px) 46vw, 55vw"' in root
    # Without images there's nothing to stand in for.
    plain = client.get(f"/products/{make_product('Plain Mug').slug}").content.decode()
    assert '<div id="root"></div>' in plain and 'as="image"' not in plain
