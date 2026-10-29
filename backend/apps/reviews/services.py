from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Product
from apps.catalog.services.aggregates import refresh_ratings
from apps.core.exceptions import DomainError
from apps.core.images import reencode_upload, validate_image_file
from apps.core.models import AdminNotification
from apps.orders.models import OrderItem, OrderStatus

from .models import Review, ReviewPhoto

MAX_PHOTOS = 3


def is_verified_buyer(user, product: Product) -> bool:
    """Bought it and received it: a delivered order of theirs contains this product."""
    return OrderItem.objects.filter(
        order__user=user, order__status=OrderStatus.DELIVERED, product_id_snapshot=product.pk
    ).exists()


@transaction.atomic
def submit_review(user, product: Product, *, rating: int, title: str, body: str, photos=()) -> Review:
    if Review.objects.filter(product=product, user=user).exists():
        raise DomainError("You've already reviewed this piece. Thank you.", code="already_reviewed")
    photos = list(photos)
    if len(photos) > MAX_PHOTOS:
        raise DomainError(f"Please add up to {MAX_PHOTOS} photos.", code="too_many_photos")
    for photo in photos:
        validate_image_file(photo)
    review = Review.objects.create(
        product=product,
        user=user,
        rating=rating,
        title=title.strip(),
        body=body.strip(),
        is_verified_buyer=is_verified_buyer(user, product),
    )
    for photo in photos:
        ReviewPhoto.objects.create(review=review, image=reencode_upload(photo))
    AdminNotification.objects.create(
        kind=AdminNotification.Kind.REVIEW_PENDING,
        title=f"New {rating}★ review of {product.name} awaiting approval",
        link="/admin/reviews?status=pending",
        payload={"review_id": review.pk},
    )
    return review


def moderate(review: Review, status: str, *, reply: str | None = None) -> Review:
    review.status = status
    review.moderated_at = timezone.now()
    fields = ["status", "moderated_at", "updated_at"]
    if reply is not None:
        review.admin_reply = reply
        fields.append("admin_reply")
    review.save(update_fields=fields)
    refresh_ratings(review.product_id)
    return review
