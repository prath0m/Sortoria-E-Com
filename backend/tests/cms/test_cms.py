import re
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from apps.cms.models import HomeSection, NewsletterSubscriber, Page, PromoBanner, TrustBadge
from tests.factories import make_product, png_file

pytestmark = pytest.mark.django_db


def test_homepage_follows_admin_order_and_skips_empty_sections(api):
    make_product("Featured Lamp", is_featured=True)
    HomeSection.objects.create(type="trust_badges", position=2)
    HomeSection.objects.create(type="featured_products", title="Hand-picked", position=1)
    HomeSection.objects.create(type="flash_sale", position=3)  # no live sale → skipped
    HomeSection.objects.create(type="newsletter", title="Join us", position=4, is_active=False)
    TrustBadge.objects.create(icon="truck", title="Complimentary shipping")

    sections = api.get("/api/v1/home/").data["sections"]
    assert [s["type"] for s in sections] == ["featured_products", "trust_badges"]
    assert sections[0]["data"][0]["name"] == "Featured Lamp"


def test_homepage_cache_is_refreshed_when_content_changes(api):
    HomeSection.objects.create(type="trust_badges")
    TrustBadge.objects.create(icon="truck", title="Free shipping")
    assert api.get("/api/v1/home/").data["sections"][0]["data"][0]["title"] == "Free shipping"
    TrustBadge.objects.update(title="Complimentary shipping")  # queryset update: no signal
    badge = TrustBadge.objects.get()
    badge.save()  # admin edits go through save(), which bumps the cache
    assert api.get("/api/v1/home/").data["sections"][0]["data"][0]["title"] == "Complimentary shipping"


def test_banners_respect_schedule_and_placement(api):
    now = timezone.now()
    for title, placement, starts, ends in [
        ("Live", "home", None, None),
        ("Future", "home", now + timedelta(days=1), None),
        ("Expired", "home", None, now - timedelta(days=1)),
        ("Offers only", "offers", None, None),
    ]:
        PromoBanner.objects.create(
            title=title, placement=placement, starts_at=starts, ends_at=ends, image=png_file("b.png")
        )
    assert [b["title"] for b in api.get("/api/v1/cms/banners/", {"placement": "home"}).data] == ["Live"]
    assert [b["title"] for b in api.get("/api/v1/cms/banners/", {"placement": "offers"}).data] == ["Offers only"]


def test_pages_are_sanitised(api):
    Page.objects.create(
        title="About",
        body='<p onclick="steal()">Hello</p><script>alert(1)</script><a href="javascript:x()">bad</a><a href="/shop">ok</a>',
    )
    body = api.get("/api/v1/pages/about/").data["body"]
    assert "script" not in body and "onclick" not in body and "javascript" not in body
    assert '<a href="/shop"' in body
    assert api.get("/api/v1/pages/missing/").status_code == 404


def test_product_descriptions_are_sanitised():
    product = make_product(description='<p>Soft</p><img src=x onerror="alert(1)">')
    assert "onerror" not in product.description


def test_newsletter_double_opt_in(api):
    response = api.post(
        "/api/v1/newsletter/subscribe/", {"email": "Ada@Example.com", "source": "footer"}, format="json"
    )
    assert response.status_code == 202
    sub = NewsletterSubscriber.objects.get()
    assert sub.email == "ada@example.com" and sub.status == "pending"
    token = re.search(r"/newsletter/confirm/([\w-]+)", mail.outbox[0].alternatives[0][0]).group(1)
    assert api.post("/api/v1/newsletter/confirm/", {"token": token}, format="json").data["status"] == "confirmed"
    # Re-subscribing a confirmed address doesn't send another email.
    api.post("/api/v1/newsletter/subscribe/", {"email": "ada@example.com"}, format="json")
    assert len(mail.outbox) == 1
    assert api.post("/api/v1/newsletter/unsubscribe/", {"token": token}, format="json").data["status"] == "unsubscribed"
    assert api.post("/api/v1/newsletter/confirm/", {"token": "nope"}, format="json").status_code == 400


def test_newsletter_rejects_invalid_email(api):
    assert api.post("/api/v1/newsletter/subscribe/", {"email": "not-an-email"}, format="json").status_code == 400
