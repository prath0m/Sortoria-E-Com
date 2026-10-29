"""Server-side SEO: per-URL meta injected into the SPA shell, sitemap.xml and robots.txt.

Crawlers and link-preview scrapers often don't run JavaScript, so the production server fills
the <head> of index.html with the same title, description, Open Graph tags and JSON-LD that
react-helmet-async renders in the browser. Tags carry data-rh so Helmet replaces them on mount.
"""

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from django.conf import settings
from django.http import Http404, HttpResponse
from django.utils.cache import patch_vary_headers
from django.utils.html import escape
from django.utils.text import compress_string
from django.views.decorators.http import require_GET
from rest_framework.utils.encoders import JSONEncoder

from . import caching
from .models import StoreSettings

# Pages that are personal, transactional or thin: keep them out of search results.
PRIVATE_PREFIXES = (
    "/admin",
    "/account",
    "/cart",
    "/checkout",
    "/wishlist",
    "/order/",
    "/returns/",
    "/track-order",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/newsletter/",
    "/search",
)


@dataclass
class Meta:
    title: str
    description: str = ""
    path: str = "/"
    image: str = ""
    type: str = "website"
    noindex: bool = False
    status: int = 200
    json_ld: list = field(default_factory=list)
    # Largest-image preloads: (srcset {width: url}, sizes, media query). Must mirror the <img> markup.
    preload: list = field(default_factory=list)


def _base() -> str:
    return settings.FRONTEND_URL.rstrip("/")


def _abs(url: str) -> str:
    if not url:
        return ""
    if url.startswith("http"):
        return url
    return (
        f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}{url}" if url.startswith(settings.MEDIA_URL) else f"{_base()}{url}"
    )


def _clip(text: str, limit: int = 160) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def _title(store, title: str | None) -> str:
    if not title:
        return f"{store.name} — {store.tagline}".strip(" —")
    return f"{title} — {store.meta_title_suffix or store.name}"


def _breadcrumbs(items: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": name, "item": f"{_base()}{path}"}
            for i, (name, path) in enumerate(items)
        ],
    }


def _product_meta(store, slug: str) -> Meta | None:
    from apps.catalog.models import Product

    product = (
        Product.objects.filter(slug=slug, is_active=True)
        .select_related("brand", "category")
        .prefetch_related("images", "variants")
        .first()
    )
    if product is None:
        return None
    gallery = list(product.images.all()[:6])
    images = [_abs(i.image.url) for i in gallery]
    first = gallery[0].renditions if gallery and gallery[0].renditions else None
    prices = [v.price_paise for v in product.variants.all() if v.is_active] or [product.min_price_paise]
    offer = {
        "@type": "AggregateOffer",
        "priceCurrency": "INR",
        "lowPrice": f"{min(prices) / 100:.2f}",
        "highPrice": f"{max(prices) / 100:.2f}",
        "offerCount": len(prices),
        "availability": "https://schema.org/InStock" if product.in_stock else "https://schema.org/OutOfStock",
        "url": f"{_base()}/products/{product.slug}",
    }
    data = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "description": _clip(product.short_description or product.description, 300),
        "image": images,
        "sku": next((v.sku for v in product.variants.all()), ""),
        "category": product.category.name,
        "offers": offer,
    }
    if product.brand:
        data["brand"] = {"@type": "Brand", "name": product.brand.name}
    if product.rating_count:
        data["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": f"{product.rating_avg:.1f}",
            "reviewCount": product.rating_count,
        }
    crumbs = [("Home", "/")] + [
        (c.name, f"/shop/{c.slug}") for c in [*product.category.get_ancestors(), product.category]
    ]
    crumbs.append((product.name, f"/products/{product.slug}"))
    return Meta(
        title=_title(store, product.seo_title or product.name),
        description=_clip(product.seo_description or product.short_description or product.description),
        path=f"/products/{product.slug}",
        image=images[0] if images else "",
        type="product",
        json_ld=[data, _breadcrumbs(crumbs)],
        # Gallery: swipeable full-width on phones and tablets, a large column from 1024px.
        preload=[
            (first, "100vw", "(max-width: 1023px)"),
            (first, "(min-width: 1280px) 46vw, 55vw", "(min-width: 1024px)"),
        ]
        if first
        else [],
    )


def _category_meta(store, slug: str) -> Meta | None:
    from apps.catalog.models import Category

    category = Category.objects.filter(slug=slug, is_active=True).first()
    if category is None:
        return None
    crumbs = [("Home", "/")] + [(c.name, f"/shop/{c.slug}") for c in [*category.get_ancestors(), category]]
    image = category.banner_image or category.image
    return Meta(
        title=_title(store, category.seo_title or category.name),
        description=_clip(category.seo_description or category.description or f"Shop {category.name} at {store.name}."),
        path=f"/shop/{category.slug}",
        image=_abs(image.url) if image else "",
        json_ld=[_breadcrumbs(crumbs)],
    )


def _brand_meta(store, slug: str) -> Meta | None:
    from apps.catalog.models import Brand

    brand = Brand.objects.filter(slug=slug, is_active=True).first()
    if brand is None:
        return None
    return Meta(
        title=_title(store, brand.name),
        description=_clip(brand.description or f"{brand.name} at {store.name}."),
        path=f"/brands/{brand.slug}",
        image=_abs(brand.logo.url) if brand.logo else "",
    )


def _page_meta(store, slug: str) -> Meta | None:
    from apps.cms.models import Page

    page = Page.objects.filter(slug=slug, is_active=True).first()
    if page is None:
        return None
    return Meta(
        title=_title(store, page.seo_title or page.title),
        description=_clip(page.seo_description or page.summary or page.body),
        path=f"/pages/{page.slug}",
        type="article",
    )


def _home_meta(store) -> Meta:
    logo = _abs(store.logo.url) if store.logo else f"{_base()}/icon-512.png"
    same_as = [
        u for u in (store.instagram_url, store.facebook_url, store.pinterest_url, store.youtube_url, store.x_url) if u
    ]
    organization = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": store.name,
        "url": _base(),
        "logo": logo,
    }
    if same_as:
        organization["sameAs"] = same_as
    if store.contact_email or store.support_phone:
        organization["contactPoint"] = {
            "@type": "ContactPoint",
            "contactType": "customer service",
            **({"email": store.contact_email} if store.contact_email else {}),
            **({"telephone": store.support_phone} if store.support_phone else {}),
            "areaServed": "IN",
        }
    website = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": store.name,
        "url": _base(),
        "potentialAction": {
            "@type": "SearchAction",
            "target": f"{_base()}/search?q={{query}}",
            "query-input": "required name=query",
        },
    }
    from apps.cms.models import HeroSlide, HomeSection

    preload = []
    first_section = HomeSection.objects.filter(is_active=True).order_by("position", "id").first()
    slide = HeroSlide.objects.live().first() if first_section and first_section.type == HomeSection.Type.HERO else None
    if slide is not None and (desktop := slide.srcset("image")):
        # Mirrors HeroSlider's <picture>: the phone crop below 768px, the wide image above.
        mobile = slide.srcset("mobile_image") or desktop
        preload = [(mobile, "100vw", "(max-width: 767px)"), (desktop, "100vw", "(min-width: 768px)")]
    return Meta(
        title=_title(store, None),
        description=store.meta_description,
        path="/",
        json_ld=[organization, website],
        preload=preload,
    )


STATIC_TITLES = {
    "/shop": "Shop everything",
    "/offers": "Offers",
}

ROUTES = [
    (re.compile(r"^/products/([\w-]+)/?$"), _product_meta),
    (re.compile(r"^/shop/([\w-]+)/?$"), _category_meta),
    (re.compile(r"^/brands/([\w-]+)/?$"), _brand_meta),
    (re.compile(r"^/pages/([\w-]+)/?$"), _page_meta),
]


def resolve(path: str) -> Meta:
    """Meta for a storefront path. Unknown detail pages get a 404 status so they aren't indexed."""
    store = StoreSettings.load()
    if path in ("", "/"):
        return _home_meta(store)
    if path.startswith(PRIVATE_PREFIXES):
        return Meta(title=_title(store, None), description=store.meta_description, path=path, noindex=True)
    for pattern, builder in ROUTES:
        match = pattern.match(path)
        if match:
            slug = match.group(1)
            meta = caching.cached(caching.CATALOG, f"seo:{path}", lambda b=builder, s=slug: b(store, s), 600)
            if meta is None:
                return Meta(title=_title(store, "Not found"), path=path, noindex=True, status=404)
            return meta
    if path.rstrip("/") in STATIC_TITLES:
        return Meta(title=_title(store, STATIC_TITLES[path.rstrip("/")]), description=store.meta_description, path=path)
    if path.startswith("/offers/"):
        return Meta(title=_title(store, "Offers"), description=store.meta_description, path=path)
    return Meta(title=_title(store, "Not found"), path=path, noindex=True, status=404)


def _json_ld(block) -> str:
    # Escape every "<" (and the line separators JS rejects) so inlined JSON can't end or confuse the script element.
    text = json.dumps(block, ensure_ascii=False, separators=(",", ":"), cls=JSONEncoder)
    return text.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def render_head(meta: Meta, store) -> str:
    url = f"{_base()}{meta.path}"
    image = meta.image or (_abs(store.og_default_image.url) if store.og_default_image else f"{_base()}/icon-512.png")
    tags = [f"<title>{escape(meta.title)}</title>"]
    attrs = [
        ("name", "description", meta.description),
        ("property", "og:site_name", store.name),
        ("property", "og:type", meta.type),
        ("property", "og:title", meta.title),
        ("property", "og:description", meta.description),
        ("property", "og:url", url),
        ("property", "og:image", image),
        ("name", "twitter:card", "summary_large_image"),
    ]
    if meta.noindex:
        attrs.append(("name", "robots", "noindex,follow"))
    for kind, key, value in attrs:
        if value:
            tags.append(f'<meta data-rh="true" {kind}="{key}" content="{escape(value)}" />')
    if not meta.noindex:
        tags.append(f'<link data-rh="true" rel="canonical" href="{escape(url)}" />')
    tags.extend(f'<script data-rh="true" type="application/ld+json">{_json_ld(b)}</script>' for b in meta.json_ld)
    for srcset, sizes, media in meta.preload:
        candidates = ", ".join(f"{_abs(url)} {w}w" for w, url in sorted(srcset.items(), key=lambda kv: int(kv[0])))
        tags.append(
            f'<link rel="preload" as="image" fetchpriority="high" imagesrcset="{escape(candidates)}" '
            f'imagesizes="{escape(sizes)}" media="{escape(media)}" />'
        )
    return "\n    ".join(tags)


@lru_cache(maxsize=1)
def _shell(mtime: float) -> str:
    return (Path(settings.FRONTEND_DIST) / "index.html").read_text(encoding="utf-8")


def shell() -> str:
    index = Path(settings.FRONTEND_DIST) / "index.html"
    if not index.exists():
        raise Http404("Frontend build not found. Run `make build`.")
    return _shell(index.stat().st_mtime)


# Route source modules, as named in Vite's manifest, and the API reads each page needs first.
ROUTE_MODULES = [
    (re.compile(r"^/$"), "src/features/storefront/home/HomePage.tsx"),
    (re.compile(r"^/products/[\w-]+/?$"), "src/features/storefront/product/ProductPage.tsx"),
    (re.compile(r"^/shop(/[\w-]+)?/?$"), "src/features/storefront/catalog/CategoryPage.tsx"),
    (re.compile(r"^/pages/[\w-]+/?$"), "src/features/storefront/pages/CmsPage.tsx"),
]
# Every page reads the navigation and footer links; detail pages add their own record.
GLOBAL_DATA = ["/store/navigation/", "/pages/"]
INLINE_DATA = [
    (re.compile(r"^/$"), lambda m: ["/home/"]),
    (re.compile(r"^/products/([\w-]+)/?$"), lambda m: [f"/products/{m.group(1)}/"]),
    (
        re.compile(r"^/shop/([\w-]+)/?$"),
        # Exactly the first requests an unfiltered category page makes (same key order as buildQuery()).
        lambda m: [
            f"/categories/{m.group(1)}/",
            f"/products/?category={m.group(1)}&page=1",
            f"/products/facets/?category={m.group(1)}",
        ],
    ),
    (re.compile(r"^/pages/([\w-]+)/?$"), lambda m: [f"/pages/{m.group(1)}/"]),
]


@lru_cache(maxsize=1)
def _manifest(mtime: float) -> dict:
    return json.loads((Path(settings.FRONTEND_DIST) / ".vite" / "manifest.json").read_text(encoding="utf-8"))


def route_preloads(path: str) -> list[str]:
    """<link> tags that start fetching this route's lazy chunk (and its CSS) alongside the entry."""
    file = Path(settings.FRONTEND_DIST) / ".vite" / "manifest.json"
    if not file.exists():
        return []
    manifest = _manifest(file.stat().st_mtime)
    source = next((src for pattern, src in ROUTE_MODULES if pattern.match(path)), None)
    if source is None or source not in manifest:
        return []
    seen: set[str] = set()
    js: list[str] = []
    css: list[str] = []

    def walk(key: str):
        if key in seen or key not in manifest:
            return
        seen.add(key)
        chunk = manifest[key]
        if chunk.get("isEntry"):
            return  # already in the page
        js.append(chunk["file"])
        css.extend(chunk.get("css", []))
        for child in chunk.get("imports", []):
            walk(child)

    walk(source)
    tags = [f'<link rel="modulepreload" crossorigin href="/{escape(f)}" />' for f in js]
    tags += [f'<link rel="stylesheet" crossorigin href="/{escape(f)}" />' for f in dict.fromkeys(css)]
    return tags


def inline_data(request, path: str) -> dict:
    """Run the first API reads this page makes, as an anonymous request, so the client needn't wait for them."""
    from urllib.parse import urlsplit

    from django.test import RequestFactory
    from django.urls import Resolver404, resolve

    targets = list(GLOBAL_DATA)
    if not request.GET:  # filtered or paginated URLs build different queries; let the client fetch those
        for pattern, api_paths in INLINE_DATA:
            if match := pattern.match(path):
                targets += api_paths(match)
    out = {}
    for target in targets:
        parts = urlsplit(target)
        try:
            view = resolve(f"/api/v1{parts.path}")
        except Resolver404:
            continue
        sub = RequestFactory().get(
            f"/api/v1{target}", HTTP_HOST=request.get_host(), secure=request.is_secure(), HTTP_X_SARTORIA_CLIENT="1"
        )
        response = view.func(sub, *view.args, **view.kwargs)
        if response.status_code == 200 and hasattr(response, "data"):
            out[target] = response.data
    return out


def first_paint(meta: Meta) -> str:
    """Static stand-in for the page's largest image, painted before the app boots; React replaces it.

    Mirrors the preloaded image (same srcset/sizes), so it costs no extra download.
    """
    if not meta.preload:
        return ""
    sources = []
    for srcset, sizes, media in meta.preload[:-1]:
        candidates = ", ".join(f"{_abs(u)} {w}w" for w, u in sorted(srcset.items(), key=lambda kv: int(kv[0])))
        sources.append(f'<source media="{escape(media)}" srcset="{escape(candidates)}" sizes="{escape(sizes)}" />')
    srcset, sizes, _media = meta.preload[-1]
    ordered = sorted(srcset.items(), key=lambda kv: int(kv[0]))
    candidates = ", ".join(f"{_abs(u)} {w}w" for w, u in ordered)
    hero = meta.type == "website"
    frame = (
        "display:block;width:100%;height:100svh;min-height:38rem;object-fit:cover"
        if hero
        else "display:block;width:100%;max-width:46rem;aspect-ratio:4/5;object-fit:cover;margin:0 auto"
    )
    return (
        '<div aria-hidden="true" style="background:rgb(var(--surface));min-height:100vh">'
        # The homepage hero runs under the floating header; other pages leave room for it.
        f'<div style="height:{0 if hero else 76}px"></div>'
        f"<picture>{''.join(sources)}"
        f'<img src="{escape(_abs(ordered[-1][1]))}" srcset="{escape(candidates)}" sizes="{escape(sizes)}" '
        f'alt="" fetchpriority="high" style="{frame}" /></picture></div>'
    )


HEAD_BLOCK = re.compile(r"<!--sartoria:head-->.*?<!--/sartoria:head-->", re.S)


def spa(request):
    """Serve index.html with this URL's meta and the store settings inlined."""
    from .serializers import StoreSettingsSerializer

    store = StoreSettings.load()
    meta = resolve(request.path)
    head = render_head(meta, store)
    if meta.status == 200:
        head += "\n    " + "\n    ".join(route_preloads(request.path))
    html = HEAD_BLOCK.sub(lambda _m: head, shell(), count=1)
    if meta.status == 200 and (paint := first_paint(meta)):
        html = html.replace('<div id="root"></div>', f'<div id="root">{paint}</div>', 1)
    settings_json = _json_ld(StoreSettingsSerializer(store, context={"request": request}).data)
    bootstrap = f"<script>window.__SARTORIA_SETTINGS__={settings_json}"
    if meta.status == 200 and (data := inline_data(request, request.path)):
        bootstrap += f";window.__SARTORIA_DATA__={_json_ld(data)}"
    html = html.replace("<!--sartoria:bootstrap-->", bootstrap + "</script>", 1)
    response = HttpResponse(html, status=meta.status)
    response["Cache-Control"] = "no-cache"
    # The shell is identical for every visitor (no session data), so it is safe to compress here.
    if "gzip" in request.headers.get("Accept-Encoding", ""):
        response.content = compress_string(response.content)
        response["Content-Encoding"] = "gzip"
        patch_vary_headers(response, ("Accept-Encoding",))
    return response


@require_GET
def robots_txt(request):
    lines = ["User-agent: *", "Allow: /"]
    lines += [f"Disallow: {p}" for p in PRIVATE_PREFIXES]
    lines += ["Disallow: /api/", "Disallow: /django-admin/", "", f"Sitemap: {_base()}/sitemap.xml", ""]
    return HttpResponse("\n".join(lines), content_type="text/plain; charset=utf-8")


def _sitemap_xml() -> str:
    from apps.catalog.models import Brand, Category, Product
    from apps.cms.models import Page

    entries: list[tuple[str, str | None, str]] = [("/", None, "1.0"), ("/shop", None, "0.8"), ("/offers", None, "0.6")]
    entries += [
        (f"/shop/{c.slug}", c.updated_at.date().isoformat(), "0.8")
        for c in Category.objects.filter(is_active=True).order_by("path")
    ]
    entries += [
        (f"/products/{slug}", updated.date().isoformat(), "0.7")
        for slug, updated in Product.objects.filter(is_active=True).order_by("slug").values_list("slug", "updated_at")
    ]
    entries += [
        (f"/brands/{b.slug}", b.updated_at.date().isoformat(), "0.5") for b in Brand.objects.filter(is_active=True)
    ]
    entries += [
        (f"/pages/{p.slug}", p.updated_at.date().isoformat(), "0.3") for p in Page.objects.filter(is_active=True)
    ]
    rows = []
    for path, lastmod, priority in entries:
        row = f"<url><loc>{xml_escape(_base() + path)}</loc>"
        if lastmod:
            row += f"<lastmod>{lastmod}</lastmod>"
        rows.append(f"{row}<priority>{priority}</priority></url>")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n"
    )


@require_GET
def sitemap_xml(request):
    body = caching.cached(caching.CATALOG, "sitemap", _sitemap_xml, 60 * 60)
    return HttpResponse(body, content_type="application/xml; charset=utf-8")
