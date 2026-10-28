"""Coupon eligibility rules. Returns a reason the shopper can read when a code doesn't apply."""

from dataclasses import dataclass

from django.db.models import Q
from django.utils import timezone

from apps.core.money import rupees
from apps.offers.models import Coupon, CouponRedemption


@dataclass
class CouponCheck:
    coupon: Coupon | None
    ok: bool
    message: str


def find_coupon(code: str | None) -> Coupon | None:
    if not code:
        return None
    return (
        Coupon.objects.prefetch_related("applicable_categories", "applicable_products")
        .filter(code=code.strip().upper())
        .first()
    )


def _has_successful_order(user, email: str | None) -> bool:
    from apps.orders.models import Order

    q = Q()
    if user is not None and user.is_authenticated:
        q |= Q(user=user)
    if email:
        q |= Q(email__iexact=email)
    if not q:
        return False
    return Order.objects.filter(q, status__in=Order.SUCCESSFUL_STATUSES).exists()


def _user_redemptions(coupon: Coupon, user, email: str | None) -> int:
    q = Q()
    if user is not None and user.is_authenticated:
        q |= Q(user=user)
    if email:
        q |= Q(email__iexact=email)
    if not q:
        return 0
    return CouponRedemption.objects.filter(q, coupon=coupon).count()


def line_is_eligible(coupon: Coupon, product) -> bool:
    products = list(coupon.applicable_products.all())
    categories = list(coupon.applicable_categories.all())
    if not products and not categories:
        return True
    if any(p.pk == product.pk for p in products):
        return True
    return any(product.category.path.startswith(c.path) for c in categories)


def check_coupon(coupon: Coupon | None, *, code: str, user, email: str | None, order_subtotal: int) -> CouponCheck:
    if coupon is None:
        return CouponCheck(None, False, f"We don't recognise the code {code.upper()}.")
    now = timezone.now()
    if not coupon.is_active or coupon.starts_at > now:
        return CouponCheck(coupon, False, f"{coupon.code} isn't active yet.")
    if coupon.ends_at and coupon.ends_at <= now:
        return CouponCheck(coupon, False, f"{coupon.code} has expired.")
    if coupon.usage_limit_total is not None and coupon.times_used >= coupon.usage_limit_total:
        return CouponCheck(coupon, False, f"{coupon.code} has been fully redeemed.")
    if order_subtotal < coupon.min_order_paise:
        return CouponCheck(
            coupon, False, f"{coupon.code} applies to orders of {rupees(coupon.min_order_paise)} or more."
        )
    if coupon.first_order_only and _has_successful_order(user, email):
        return CouponCheck(coupon, False, f"{coupon.code} is for a first order only.")
    if coupon.usage_limit_per_user is not None and (user is not None and user.is_authenticated or email):
        if _user_redemptions(coupon, user, email) >= coupon.usage_limit_per_user:
            return CouponCheck(coupon, False, f"You've already used {coupon.code}.")
    return CouponCheck(coupon, True, "")


def coupon_discount(coupon: Coupon, eligible_subtotal: int) -> int:
    if eligible_subtotal <= 0:
        return 0
    if coupon.discount_type == Coupon.DiscountType.PERCENT:
        discount = eligible_subtotal * coupon.value // 100
        if coupon.max_discount_paise:
            discount = min(discount, coupon.max_discount_paise)
    else:
        discount = coupon.value
    return min(discount, eligible_subtotal)
