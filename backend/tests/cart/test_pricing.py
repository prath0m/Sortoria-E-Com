from datetime import timedelta

import pytest
from django.utils import timezone

from apps.cart.services.pricing import price_cart
from apps.core.models import StoreSettings
from apps.offers.models import CouponRedemption
from apps.orders.models import Order
from tests.factories import (
    UserFactory,
    make_bundle,
    make_category,
    make_coupon,
    make_flash_sale,
    make_product,
    shipping_setup,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def world():
    ship = shipping_setup()
    store = StoreSettings.load()
    store.state_code = "27"
    store.cod_fee_paise = 4900
    store.cod_max_order_paise = 2000000
    store.save()
    tees = make_category("Tees")
    audio = make_category("Audio")
    tee = make_product("Organic Tee", category=tees, price=129000, tax_rate=5)  # ₹1,290
    lamp = make_product("Desk Lamp", category=audio, price=899000, tax_rate=18)  # ₹8,990
    sofa = make_product("Velvet Sofa", category=audio, price=6499000, tax_rate=18, product_type="bulky")
    return {"ship": ship, "tee": tee, "lamp": lamp, "sofa": sofa, "tees": tees}


def v(product):
    return product.variants.first().pk


def test_basic_totals_and_shipping_threshold(world):
    quote = price_cart([(v(world["tee"]), 1)], pincode="400050")
    assert quote.subtotal == 129000
    assert quote.shipping_method == "standard"
    assert quote.shipping_fee == 9900  # below ₹1,999
    assert quote.total == 129000 + 9900
    assert quote.free_shipping_remaining == 199900 - 129000

    quote = price_cart([(v(world["tee"]), 2)], pincode="400050")  # ₹2,580 crosses the threshold
    assert quote.shipping_fee == 0
    assert quote.free_shipping_remaining == 0


def test_threshold_boundary_is_inclusive(world):
    tee = make_product("Exact Tee", category=world["tees"], price=199900, tax_rate=5)
    assert price_cart([(v(tee), 1)], pincode="400050").shipping_fee == 0


def test_inclusive_gst_split_intra_and_inter_state(world):
    mumbai = price_cart([(v(world["lamp"]), 1)], pincode="400050")
    expected_tax = round(899000 * 18 / 118)
    assert mumbai.tax_total == expected_tax
    assert mumbai.cgst + mumbai.sgst == expected_tax and mumbai.igst == 0

    bengaluru = price_cart([(v(world["lamp"]), 1)], pincode="560025")
    assert bengaluru.igst == expected_tax and bengaluru.cgst == 0


def test_shipping_and_cod_fees_carry_18_percent_gst(world):
    quote = price_cart([(v(world["tee"]), 1)], pincode="400050", payment_method="cod")
    assert quote.cod_fee == 4900
    line_tax = round(129000 * 5 / 105)
    service_tax = round((9900 + 4900) * 18 / 118)
    assert quote.tax_total == line_tax + service_tax
    assert quote.total == 129000 + 9900 + 4900


def test_cod_unavailable_in_remote_zone_and_above_limit(world):
    remote = price_cart([(v(world["tee"]), 1)], pincode="744101", payment_method="cod")
    assert not remote.cod_available and remote.cod_fee == 0
    big = price_cart([(v(world["sofa"]), 1)], pincode="400050", payment_method="cod")
    assert not big.cod_available


def test_express_unavailable_for_bulky_and_remote(world):
    quote = price_cart([(v(world["sofa"]), 1)], pincode="400050", shipping_method="express")
    express = next(o for o in quote.shipping_options if o.code == "express")
    assert not express.available
    assert quote.shipping_method == "standard"
    assert quote.shipping_fee == 49900  # free threshold met, bulky surcharge still applies

    remote = price_cart([(v(world["tee"]), 1)], pincode="744101", shipping_method="express")
    assert remote.shipping_method == "standard"
    assert remote.shipping_fee == 9900 + 5000  # zone extra fee


def test_unserviceable_pincode(world):
    quote = price_cart([(v(world["tee"]), 1)], pincode="110001")
    assert quote.serviceable is False
    assert any("don't deliver" in m for m in quote.messages)


def test_flash_sale_price_and_cap(world):
    make_flash_sale([(world["lamp"], 20)], quantity_cap=1)
    one = price_cart([(v(world["lamp"]), 1)])
    assert one.lines[0].unit_price == 899000 - 899000 * 20 // 100
    two = price_cart([(v(world["lamp"]), 2)])  # cap can't cover two units: regular price
    assert two.lines[0].unit_price == 899000


def test_expired_and_future_sales_do_not_apply(world):
    make_flash_sale([(world["lamp"], 20)], starts=-48, ends=-1)
    make_flash_sale([(world["lamp"], 30)], starts=2, ends=10)
    assert price_cart([(v(world["lamp"]), 1)]).lines[0].unit_price == 899000


def test_bundle_discount_applies_per_complete_set(world):
    make_bundle([world["tee"], world["lamp"]], value=10)
    quote = price_cart([(v(world["tee"]), 2), (v(world["lamp"]), 1)])
    one_set = (129000 + 899000) // 10
    assert quote.bundle_discount == one_set
    assert sum(line.bundle_discount for line in quote.lines) == one_set
    assert price_cart([(v(world["tee"]), 1)]).bundle_discount == 0


def test_percent_coupon_with_cap_and_allocation(world):
    make_coupon("TENOFF", value=10, max_discount_paise=50000)
    quote = price_cart([(v(world["tee"]), 1), (v(world["lamp"]), 1)], coupon_code="tenoff")
    assert quote.coupon_applied
    assert quote.coupon_discount == 50000  # 10% of ₹10,280 capped at ₹500
    assert sum(line.coupon_discount for line in quote.lines) == 50000
    assert quote.total == 129000 + 899000 - 50000


def test_fixed_coupon_min_order_and_category_scope(world):
    make_coupon("TEES200", discount_type="fixed", value=20000, min_order_paise=200000)
    coupon = make_coupon("TEESONLY", discount_type="fixed", value=20000)
    coupon.applicable_categories.add(world["tees"])

    low = price_cart([(v(world["tee"]), 1)], coupon_code="TEES200")
    assert not low.coupon_applied and "₹2,000" in low.coupon_message

    scoped = price_cart([(v(world["tee"]), 1), (v(world["lamp"]), 1)], coupon_code="TEESONLY")
    tee_line = next(line for line in scoped.lines if line.variant.product == world["tee"])
    lamp_line = next(line for line in scoped.lines if line.variant.product == world["lamp"])
    assert tee_line.coupon_discount == 20000 and lamp_line.coupon_discount == 0


def test_coupon_expiry_usage_limits_and_unknown_codes(world):
    make_coupon("OLD", ends_at=timezone.now() - timedelta(hours=1))
    make_coupon("GONE", usage_limit_total=5, times_used=5)
    assert "expired" in price_cart([(v(world["tee"]), 1)], coupon_code="OLD").coupon_message
    assert "fully redeemed" in price_cart([(v(world["tee"]), 1)], coupon_code="GONE").coupon_message
    assert "recognise" in price_cart([(v(world["tee"]), 1)], coupon_code="NOPE").coupon_message


def _order(user, status="delivered"):
    return Order.objects.create(
        number=f"SRT-T-{Order.objects.count() + 1}",
        user=user,
        email=user.email,
        phone="9876543210",
        status=status,
        payment_method="cod",
        shipping_address={},
        billing_address={},
        shipping_method="standard",
        subtotal_paise=1,
        grand_total_paise=1,
    )


def test_first_order_and_per_user_limits(world):
    user = UserFactory()
    make_coupon("FIRST", first_order_only=True)
    once = make_coupon("ONCE", usage_limit_per_user=1)
    assert price_cart([(v(world["tee"]), 1)], user=user, email=user.email, coupon_code="FIRST").coupon_applied

    order = _order(user)
    assert not price_cart([(v(world["tee"]), 1)], user=user, email=user.email, coupon_code="FIRST").coupon_applied

    CouponRedemption.objects.create(coupon=once, order=order, user=user, email=user.email, discount_paise=1)
    assert (
        "already used"
        in price_cart([(v(world["tee"]), 1)], user=user, email=user.email, coupon_code="ONCE").coupon_message
    )


def test_stock_issues_are_flagged(world):
    variant = world["tee"].variants.first()
    variant.stock = 1
    variant.save()
    quote = price_cart([(variant.pk, 3)])
    assert quote.has_issues and "Only 1 left" in quote.lines[0].issue


def test_allocation_always_sums_exactly(world):
    make_coupon("ODD", discount_type="fixed", value=1001)
    quote = price_cart([(v(world["tee"]), 3), (v(world["lamp"]), 1)], coupon_code="ODD")
    assert sum(line.coupon_discount for line in quote.lines) == 1001
    assert quote.total == quote.subtotal - 1001 + quote.shipping_fee
