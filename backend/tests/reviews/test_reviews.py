import pytest

from apps.catalog.models import Product
from apps.orders.models import Order, OrderItem
from apps.reviews.models import Review
from apps.reviews.services import moderate
from tests.factories import UserFactory, make_product, png_file

pytestmark = pytest.mark.django_db


def deliver(user, product):
    order = Order.objects.create(
        number=f"SRT-R-{Order.objects.count() + 1}",
        user=user,
        email=user.email,
        phone="9876543210",
        status="delivered",
        payment_method="cod",
        shipping_address={},
        billing_address={},
        shipping_method="standard",
        subtotal_paise=1,
        grand_total_paise=1,
    )
    OrderItem.objects.create(
        order=order,
        product_id_snapshot=product.pk,
        product_name=product.name,
        sku="X",
        mrp_paise=1,
        unit_price_paise=1,
        quantity=1,
        tax_rate=5,
        tax_paise=0,
        line_total_paise=1,
    )


def payload(**overrides):
    return {
        "rating": 5,
        "title": "Beautifully made",
        "body": "Soft, well cut and the stitching is immaculate.",
        **overrides,
    }


def test_requires_sign_in(api):
    product = make_product()
    assert api.post(f"/api/v1/products/{product.slug}/reviews/", payload(), format="json").status_code == 401


def test_review_is_held_for_moderation_then_published(api, auth, customer):
    product = make_product()
    response = auth(customer).post(f"/api/v1/products/{product.slug}/reviews/", payload(), format="json")
    assert response.status_code == 201 and response.data["is_verified_buyer"] is False
    listing = api.get(f"/api/v1/products/{product.slug}/reviews/").data
    assert listing["count"] == 0  # pending reviews aren't public

    moderate(Review.objects.get(), Review.Status.APPROVED, reply="Thank you for the kind words.")
    listing = api.get(f"/api/v1/products/{product.slug}/reviews/").data
    assert listing["count"] == 1
    assert listing["summary"]["distribution"][5] == 1
    assert listing["results"][0]["admin_reply"].startswith("Thank you")
    assert float(Product.objects.get(pk=product.pk).rating_avg) == 5.0


def test_verified_buyer_badge_and_duplicate_guard(auth, customer):
    product = make_product()
    deliver(customer, product)
    client = auth(customer)
    response = client.post(f"/api/v1/products/{product.slug}/reviews/", payload(), format="json")
    assert response.data["is_verified_buyer"] is True
    again = client.post(f"/api/v1/products/{product.slug}/reviews/", payload(), format="json")
    assert again.status_code == 400 and again.data["code"] == "already_reviewed"


def test_validation_and_photos(auth, customer):
    product = make_product()
    client = auth(customer)
    short = client.post(f"/api/v1/products/{product.slug}/reviews/", payload(body="Nice."), format="json")
    assert short.status_code == 400 and "body" in short.data
    with_photo = client.post(
        f"/api/v1/products/{product.slug}/reviews/",
        {**payload(), "photos": [png_file("worn.png", size=(600, 800))]},
        format="multipart",
    )
    assert with_photo.status_code == 201 and len(with_photo.data["photos"]) == 1


def test_sorting_and_rating_filter(api):
    product = make_product()
    for rating in (2, 5, 4):
        Review.objects.create(
            product=product, user=UserFactory(), rating=rating, title="t", body="b" * 30, status="approved"
        )
    data = api.get(f"/api/v1/products/{product.slug}/reviews/", {"sort": "lowest"}).data
    assert [r["rating"] for r in data["results"]] == [2, 4, 5]
    assert api.get(f"/api/v1/products/{product.slug}/reviews/", {"rating": 4}).data["count"] == 1
