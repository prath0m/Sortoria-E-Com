"""Load realistic demo data: `python manage.py seed_demo [--flush] [--no-images]`.

Photos are fetched once from Unsplash's CDN into backend/seed_assets/images/ and reused on later runs.
Without network access (or with --no-images) on-brand placeholder artwork is generated instead.
"""

import itertools
import os
import random
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image, ImageDraw, ImageFont

from apps.accounts.models import Address, User
from apps.accounts.serializers import STATE_CODES
from apps.analytics.models import DailyMetric
from apps.cart.services.pricing import price_cart
from apps.catalog.models import (
    Attribute,
    AttributeValue,
    Brand,
    Category,
    Product,
    ProductImage,
    ProductSpec,
    ProductVariant,
    ProductView,
    StockMovement,
)
from apps.catalog.services.aggregates import refresh_products, refresh_ratings, refresh_search_vectors
from apps.catalog.tasks import build_image_renditions
from apps.cms.models import Counter, HeroSlide, HomeSection, Page, PromoBanner, Testimonial, TrustBadge
from apps.core import caching
from apps.core.models import AdminNotification, StoreSettings
from apps.offers.models import Bundle, BundleItem, Coupon, CouponRedemption, FlashSale, FlashSaleItem
from apps.orders.models import (
    Order,
    OrderItem,
    OrderStatusEvent,
    ReturnItem,
    ReturnRequest,
    ReturnStatusEvent,
)
from apps.orders.services.numbering import next_invoice_number, next_order_number, next_return_number
from apps.payments.models import Payment, Refund
from apps.reviews.models import Review
from apps.shipping.models import ServiceablePincode, ShippingMethod, ShippingZone
from config.celery import app as celery_app

from .seed_data import activity, cms, commerce
from .seed_data import catalog as data

ASSET_DIR = settings.BASE_DIR / "seed_assets" / "images"
UNSPLASH = "https://images.unsplash.com/photo-{id}?{params}"
CROPS = {
    "main": "w=1200&h=1500&fit=crop&crop=entropy&q=80&fm=jpg",
    "detail": "w=1200&h=1500&fit=crop&crop=focalpoint&fp-x=0.5&fp-y=0.45&fp-z=1.8&q=80&fm=jpg",
    "banner": "w=2400&h=1000&fit=crop&crop=entropy&q=78&fm=jpg",
    "tile": "w=900&h=1100&fit=crop&crop=entropy&q=80&fm=jpg",
}


class PhotoSource:
    def __init__(self, offline: bool, stdout):
        self.offline = offline
        self.stdout = stdout
        ASSET_DIR.mkdir(parents=True, exist_ok=True)

    def _download(self, photo_id: str, crop: str) -> None:
        path = ASSET_DIR / f"{photo_id}-{crop}.jpg"
        if path.exists() or self.offline:
            return
        try:
            url = UNSPLASH.format(id=photo_id, params=CROPS[crop])
            with urllib.request.urlopen(url, timeout=30) as response:
                path.write_bytes(response.read())
        except OSError as exc:
            self.stdout.write(f"  photo {photo_id} unavailable ({exc}); using artwork")

    def prefetch(self, jobs) -> None:
        """Download every (photo_id, crop) pair concurrently; cached files are skipped."""
        with ThreadPoolExecutor(max_workers=12) as pool:
            list(pool.map(lambda job: self._download(*job), set(jobs)))

    def get(self, photo_id: str, crop: str, label: str) -> ContentFile:
        path = ASSET_DIR / f"{photo_id}-{crop}.jpg"
        self._download(photo_id, crop)
        if path.exists():
            return ContentFile(path.read_bytes(), name=f"{slugify(label)[:50]}-{crop}.jpg")
        return ContentFile(self._artwork(label, crop), name=f"{slugify(label)[:50]}-{crop}.jpg")

    @staticmethod
    def _artwork(label: str, crop: str) -> bytes:
        size = (2400, 1000) if crop == "banner" else (1200, 1500)
        img = Image.new("RGB", size, (243, 237, 226))
        draw = ImageDraw.Draw(img)
        w, h = size
        draw.ellipse([w * 0.2, h * 0.18, w * 0.8, h * 0.18 + w * 0.6], outline=(232, 210, 88), width=4)
        font = ImageFont.load_default(size=int(h * 0.045))
        text = label.upper()
        box = draw.textbbox((0, 0), text, font=font)
        draw.text(((w - (box[2] - box[0])) / 2, h * 0.78), text, fill=(89, 9, 7), font=font)
        out = BytesIO()
        img.save(out, "JPEG", quality=85)
        return out.getvalue()


class Command(BaseCommand):
    help = "Seed Sartoria with demo catalogue, content, customers and orders."

    def add_arguments(self, parser):
        parser.add_argument("--flush", action="store_true", help="Delete existing demo data first.")
        parser.add_argument("--no-images", action="store_true", help="Generate artwork instead of downloading.")

    def handle(self, *args, **options):
        # Run image renditions and emails inline; no worker needed for seeding. Celery's config is
        # namespaced (CELERY_*), so the override must use the namespaced key.
        celery_app.conf.CELERY_TASK_ALWAYS_EAGER = True
        self.rng = random.Random(42)
        self.photos = PhotoSource(offline=options["no_images"], stdout=self.stdout)
        if options["flush"]:
            self._timed("flush", self._flush)
        self._timed("settings & staff", self._seed_basics)
        self._timed("catalogue", self.seed_catalog)
        self._timed("image renditions", self.build_missing_renditions)
        self._timed("shipping & offers", self._seed_commerce)
        self._timed("customers & orders", self._seed_activity_atomic)
        self._timed("homepage & pages", self._seed_cms_atomic)
        self._timed("traffic history", self.seed_traffic)
        caching.bump(caching.CATALOG, caching.NAVIGATION, caching.HOME, caching.OFFERS, caching.SHIPPING)
        self.stdout.write(self.style.SUCCESS("Sartoria demo data is ready."))

    def _timed(self, label, fn):
        started = time.monotonic()
        fn()
        self.stdout.write(f"  ✓ {label} ({time.monotonic() - started:.1f}s)")

    @transaction.atomic
    def _seed_basics(self):
        self.seed_store_settings()
        self.seed_staff()

    @transaction.atomic
    def _seed_commerce(self):
        self.seed_shipping()
        self.seed_offers()

    @transaction.atomic
    def _seed_cms_atomic(self):
        self.seed_cms()

    @transaction.atomic
    def _seed_activity_atomic(self):
        self.seed_activity()

    def build_missing_renditions(self):
        missing = list(ProductImage.objects.filter(renditions={}).values_list("pk", flat=True))
        if missing:
            self.stdout.write(f"Building WebP renditions for {len(missing)} images…")
        for image_id in missing:
            build_image_renditions(image_id)

    # ------------------------------------------------------------------ helpers
    def _flush(self):
        self.stdout.write("Flushing catalogue…")
        # Remove the uploaded files too; deleting rows alone would orphan them in MEDIA_ROOT.
        for image in ProductImage.objects.all():
            image.image.delete(save=False)
        for category in Category.objects.all():
            for field in (
                category.image,
                category.banner_image,
                category.banner_mobile_image,
                category.menu_image,
            ):
                if field:
                    field.delete(save=False)
        for model in (HeroSlide, HomeSection, PromoBanner, TrustBadge, Counter, Testimonial, Page):
            model.objects.all().delete()
        DailyMetric.objects.all().delete()
        AdminNotification.objects.all().delete()
        Order.objects.all().delete()
        Review.objects.all().delete()
        User.objects.filter(role=User.Role.CUSTOMER).delete()
        CouponRedemption.objects.all().delete()
        Coupon.objects.all().delete()
        FlashSale.objects.all().delete()
        Bundle.objects.all().delete()
        StockMovement.objects.all().delete()
        Product.objects.all().delete()
        Category.objects.all().delete()
        Brand.objects.all().delete()
        Attribute.objects.all().delete()

    # ------------------------------------------------------------------ store
    def seed_store_settings(self):
        store = StoreSettings.load()
        store.name = "Sartoria"
        store.tagline = "Crafted with intention. Chosen for a lifetime."
        store.contact_email = "care@sartoria.in"
        store.support_phone = "+91 22 4000 1234"
        store.whatsapp = "+91 98200 01234"
        store.support_hours = "Mon–Sat, 10am–7pm IST"
        store.address_line1 = "Ground Floor, Kamala Mills"
        store.address_line2 = "Senapati Bapat Marg, Lower Parel"
        store.city = "Mumbai"
        store.state = "Maharashtra"
        store.state_code = "27"
        store.pincode = "400013"
        store.gstin = "27AAKCS1234M1Z5"
        store.legal_name = "Sartoria Retail Private Limited"
        store.instagram_url = "https://instagram.com/sartoria"
        store.facebook_url = "https://facebook.com/sartoria"
        store.pinterest_url = "https://pinterest.com/sartoria"
        store.youtube_url = "https://youtube.com/@sartoria"
        store.announcement_text = "Complimentary shipping on orders above ₹1,999 · Easy 15-day returns"
        store.announcement_enabled = True
        store.footer_blurb = (
            "Sartoria is a curated department store. We stock fewer things, chosen for how well "
            "they're made, and we stand behind every one of them."
        )
        store.meta_title_suffix = "Sartoria"
        store.meta_description = (
            "A curated department store: considered electronics, fashion, home, beauty and more, "
            "chosen for how well they're made. Free shipping above ₹1,999."
        )
        store.save()

    def seed_staff(self):
        accounts = [
            (
                "admin@sartoria.test",
                "Asha",
                "Menon",
                User.Role.ADMIN,
                "SEED_ADMIN_PASSWORD",
                "Sartoria@Admin1",
            ),
            (
                "manager@sartoria.test",
                "Rohan",
                "Iyer",
                User.Role.MANAGER,
                "SEED_MANAGER_PASSWORD",
                "Sartoria@Manager1",
            ),
        ]
        for email, first, last, role, env_key, default in accounts:
            user, created = User.objects.get_or_create(
                email=email, defaults={"first_name": first, "last_name": last, "role": role}
            )
            user.role = role
            user.is_staff = role == User.Role.ADMIN
            user.is_superuser = role == User.Role.ADMIN
            if created:
                user.set_password(os.environ.get(env_key, default))
            user.save()
            if created:
                self.stdout.write(f"  {role}: {email} / {os.environ.get(env_key, default)}")

    # ------------------------------------------------------------------ shipping & offers
    def seed_shipping(self):
        if ShippingMethod.objects.exists():
            return
        self.stdout.write("Seeding shipping methods, zones and pincodes…")
        for position, (code, name, desc, base, free, bulky, allows) in enumerate(commerce.METHODS):
            ShippingMethod.objects.create(
                code=code,
                name=name,
                description=desc,
                base_rate_paise=base * 100,
                free_threshold_paise=free * 100 if free else None,
                bulky_surcharge_paise=bulky * 100,
                allows_bulky=allows,
                position=position,
            )
        zones = {}
        for name, (std, exp, express, cod, extra) in commerce.ZONES.items():
            zones[name] = ShippingZone.objects.create(
                name=name,
                standard_days_min=std[0],
                standard_days_max=std[1],
                express_days_min=exp[0] or 1,
                express_days_max=exp[1] or 2,
                express_available=express,
                cod_available=cod,
                extra_fee_paise=extra * 100,
            )
        rows = []
        for city, state, zone, first, last in commerce.PINCODE_RANGES:
            for code in range(first, last + 1):
                rows.append(
                    ServiceablePincode(
                        pincode=str(code),
                        zone=zones[zone],
                        city=city,
                        state=state,
                        state_code=STATE_CODES[state],
                    )
                )
        ServiceablePincode.objects.bulk_create(rows, ignore_conflicts=True)

    def seed_offers(self):
        if FlashSale.objects.exists() or Coupon.objects.exists():
            return
        self.stdout.write("Seeding flash sale, daily deals, bundles and coupons…")
        now = timezone.now()
        products = {p.name: p for p in Product.objects.all()}

        def add_items(sale, items):
            for position, (name, kind, value, cap) in enumerate(items):
                FlashSaleItem.objects.create(
                    sale=sale,
                    product=products[name],
                    discount_type=kind,
                    value=value if kind == "percent" else value * 100,
                    quantity_cap=cap,
                    sold_count=self.rng.randint(0, cap // 2) if cap else 0,
                    position=position,
                )

        flash = commerce.FLASH_SALE
        sale = FlashSale.objects.create(
            title=flash["title"],
            subtitle=flash["subtitle"],
            starts_at=now - timedelta(hours=2),
            ends_at=now + timedelta(hours=flash["hours"]),
        )
        add_items(sale, flash["items"])
        today = timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0)
        for title, day, items in commerce.DAILY_DEALS:
            deal = FlashSale.objects.create(
                kind=FlashSale.Kind.DAILY_DEAL,
                title=title,
                subtitle="One piece, one day, one remarkable price.",
                starts_at=today + timedelta(days=day),
                ends_at=today + timedelta(days=day + 1),
            )
            add_items(deal, items)

        for title, desc, kind, value, names in commerce.BUNDLES:
            bundle = Bundle.objects.create(
                title=title,
                description=desc,
                discount_type=kind,
                value=value if kind == "percent" else value * 100,
            )
            for name in names:
                BundleItem.objects.create(bundle=bundle, product=products[name])

        categories = {c.name: c for c in Category.get_root_nodes()}
        for code, desc, kind, value, cap, min_order, extra in commerce.COUPONS:
            coupon = Coupon.objects.create(
                code=code,
                description=desc,
                discount_type=kind,
                value=value if kind == "percent" else value * 100,
                max_discount_paise=cap * 100 if cap else None,
                min_order_paise=min_order * 100,
                starts_at=now - timedelta(days=60),
                ends_at=now - timedelta(days=3) if extra.get("expired") else None,
                usage_limit_total=extra.get("usage_limit_total"),
                times_used=extra.get("times_used", 0),
                first_order_only=extra.get("first_order_only", False),
            )
            for name in extra.get("categories", []):
                coupon.applicable_categories.add(categories[name])
        from apps.offers.tasks import sync_flash_sale_prices

        sync_flash_sale_prices()

    # ------------------------------------------------------------------ traffic
    @transaction.atomic
    def seed_traffic(self):
        """A year of daily visits, scaled to orders so conversion lands around 2–3%."""
        if DailyMetric.objects.exists():
            return
        today = timezone.localdate()
        per_day = dict(
            Order.objects.filter(placed_at__isnull=False)
            .annotate(day=TruncDate("placed_at", tzinfo=timezone.get_current_timezone()))
            .values("day")
            .annotate(n=Count("id"))
            .values_list("day", "n")
        )
        rows = []
        for back in range(1, 400):
            day = today - timedelta(days=back)
            orders = per_day.get(day, 0)
            visits = orders * self.rng.randint(26, 40) + self.rng.randint(4, 12) + (day.weekday() >= 5) * 6
            views = int(visits * self.rng.uniform(3.2, 4.6))
            rows.append(DailyMetric(date=day, visits=visits, page_views=views, product_views=int(views * 0.45)))
        DailyMetric.objects.bulk_create(rows)

    # ------------------------------------------------------------------ CMS
    def seed_cms(self):
        if HomeSection.objects.exists():
            return
        self.stdout.write("Seeding homepage, banners and pages…")
        jobs = [(h["photo"], "banner") for h in cms.HERO] + [(h["photo"], "tile") for h in cms.HERO]
        jobs += [(b[1], "banner") for b in cms.BANNERS] + [(b[1], "tile") for b in cms.BANNERS]
        jobs += [(x[4]["photo"], "tile") for x in cms.SECTIONS if "photo" in x[4]]
        self.photos.prefetch(jobs)
        for position, h in enumerate(cms.HERO):
            slide = HeroSlide(
                eyebrow=h["eyebrow"],
                headline=h["headline"],
                subtext=h["subtext"],
                image_alt=h["headline"],
                cta_label=h["cta"][0],
                cta_url=h["cta"][1],
                secondary_cta_label=h["secondary"][0] if h["secondary"] else "",
                secondary_cta_url=h["secondary"][1] if h["secondary"] else "",
                text_theme=h["theme"],
                text_align=h["align"],
                position=position,
            )
            slide.image.save(f"hero-{position}.jpg", self.photos.get(h["photo"], "banner", h["headline"]), save=False)
            slide.mobile_image.save(
                f"hero-{position}-m.jpg", self.photos.get(h["photo"], "tile", h["headline"]), save=False
            )
            slide.save()
        for position, (kind, eyebrow, title, subtitle, extra) in enumerate(cms.SECTIONS):
            section = HomeSection(
                type=kind,
                eyebrow=eyebrow,
                title=title,
                subtitle=subtitle,
                body=extra.get("body", ""),
                limit=extra.get("limit", 12),
                cta_label=extra.get("cta", ("", ""))[0],
                cta_url=extra.get("cta", ("", ""))[1],
                position=position,
            )
            if "photo" in extra:
                section.image.save(
                    f"section-{position}.jpg", self.photos.get(extra["photo"], "tile", title), save=False
                )
            section.save()
        for position, (placement, photo, eyebrow, title, subtitle, cta, badge) in enumerate(cms.BANNERS):
            banner = PromoBanner(
                placement=placement,
                eyebrow=eyebrow,
                title=title,
                subtitle=subtitle,
                cta_label=cta[0],
                cta_url=cta[1],
                badge_text=badge,
                position=position,
            )
            banner.image.save(f"banner-{position}.jpg", self.photos.get(photo, "banner", title), save=False)
            banner.mobile_image.save(f"banner-{position}-m.jpg", self.photos.get(photo, "tile", title), save=False)
            banner.save()
        for position, (icon, title, text) in enumerate(cms.TRUST_BADGES):
            TrustBadge.objects.create(icon=icon, title=title, text=text, position=position)
        for position, (value, prefix, suffix, label) in enumerate(cms.COUNTERS):
            Counter.objects.create(value=value, prefix=prefix, suffix=suffix, label=label, position=position)
        for position, (name, location, quote) in enumerate(cms.TESTIMONIALS):
            Testimonial.objects.create(name=name, location=location, quote=quote, position=position)
        for position, (slug, title, summary, body) in enumerate(cms.PAGES):
            Page.objects.create(
                slug=slug,
                title=title,
                summary=summary,
                body=body,
                position=position,
                seo_title=title,
                seo_description=summary,
            )

    # ------------------------------------------------------------------ customers & orders
    FLOW = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"]

    def _weighted(self, pairs):
        total = sum(w for _, w in pairs)
        roll = self.rng.uniform(0, total)
        for value, weight in pairs:
            roll -= weight
            if roll <= 0:
                return value
        return pairs[-1][0]

    def seed_activity(self):
        if Order.objects.filter(email__endswith="@example.in").exists():
            return
        self.stdout.write("Seeding customers, orders, reviews and returns…")
        rng = self.rng
        now = timezone.now()
        password = os.environ.get("SEED_CUSTOMER_PASSWORD", "Sartoria@Guest1")

        customers = []
        demo = User.objects.filter(email="patron@sartoria.test").first() or User.objects.create_user(
            "patron@sartoria.test", password, first_name="Meera", last_name="Nair", phone="9820012345"
        )
        customers.append(demo)
        for i, first in enumerate(activity.FIRST_NAMES):
            last = activity.LAST_NAMES[i % len(activity.LAST_NAMES)]
            user = User.objects.create_user(
                f"{first.lower()}.{last.lower()}{i}@example.in",
                password,
                first_name=first,
                last_name=last,
                phone=f"9{rng.randint(100000000, 999999999)}",
                marketing_opt_in=rng.random() < 0.4,
            )
            user.date_joined = now - timedelta(days=rng.randint(5, 420))
            user.save(update_fields=["date_joined"])
            customers.append(user)
        for user in customers:
            city, state, pincode = rng.choice(activity.CITIES)
            Address.objects.create(
                user=user,
                label=rng.choice(["Home", "Work", ""]),
                full_name=user.full_name,
                phone=user.phone or "9820012345",
                line1=f"{rng.randint(2, 180)}, {rng.choice(activity.STREETS)}",
                city=city,
                state=state,
                state_code=STATE_CODES[state],
                pincode=pincode,
                is_default_shipping=True,
            )
        self.stdout.write(f"  customer login: patron@sartoria.test / {password}")

        variants = list(
            ProductVariant.objects.filter(is_active=True, stock__gt=2, product__is_active=True).select_related(
                "product"
            )
        )
        # Mostly spread over the year, plus a dozen in the last few days so fulfilment queues aren't empty.
        dates = sorted(
            [now - timedelta(days=int(rng.triangular(0, 360, 10)), hours=rng.randint(0, 23)) for _ in range(138)]
            + [now - timedelta(hours=rng.randint(2, 5 * 24)) for _ in range(12)]
        )
        delivered_orders = []
        for placed_at in dates:
            user = rng.choice(customers) if rng.random() < 0.85 else None
            address = (
                user.addresses.first().as_snapshot()
                if user
                else {
                    "full_name": f"{rng.choice(activity.FIRST_NAMES)} {rng.choice(activity.LAST_NAMES)}",
                    "phone": f"9{rng.randint(100000000, 999999999)}",
                    "line1": f"{rng.randint(2, 99)}, {rng.choice(activity.STREETS)}",
                    "line2": "",
                    "landmark": "",
                    "country": "IN",
                    **dict(zip(("city", "state", "pincode"), rng.choice(activity.CITIES), strict=True)),
                }
            )
            address.setdefault("state_code", STATE_CODES[address["state"]])
            age_days = (now - placed_at).days
            status = self._status_for_age(age_days)
            payment_method = (
                "cod" if rng.random() < 0.3 and status not in ("pending_payment", "payment_failed") else "razorpay"
            )
            lines = [(v.pk, rng.choice([1, 1, 1, 2])) for v in rng.sample(variants, rng.choice([1, 1, 2, 2, 3]))]
            quote = price_cart(
                lines,
                pincode=address["pincode"],
                shipping_method="express" if rng.random() < 0.15 else "standard",
                payment_method=payment_method,
                destination_state_code=address["state_code"],
            )
            order = self._create_order(quote, address, user, status, payment_method, placed_at)
            if order.status == "delivered":
                delivered_orders.append(order)

        self._seed_reviews(customers, delivered_orders)
        self._seed_returns(delivered_orders)
        self._seed_views()

    def _status_for_age(self, age_days: int) -> str:
        """Recent orders are still moving through fulfilment; older ones have settled."""
        roll = self.rng.random()
        if roll < 0.06:
            return "cancelled"
        if roll < 0.09:
            return "payment_failed"
        if age_days <= 1:
            return self.rng.choice(["placed", "placed", "confirmed"])
        if age_days <= 3:
            return self.rng.choice(["confirmed", "packed", "packed"])
        if age_days <= 6:
            return self.rng.choice(["shipped", "shipped", "out_for_delivery", "delivered"])
        return "delivered"

    def _create_order(self, quote, address, user, status, payment_method, placed_at):
        rng = self.rng
        email = user.email if user else f"{address['full_name'].split()[0].lower()}{rng.randint(10, 99)}@example.in"
        order = Order.objects.create(
            number=next_order_number(),
            user=user,
            email=email,
            phone=address["phone"],
            status=status,
            payment_method=payment_method,
            shipping_address=address,
            billing_address=address,
            shipping_method=quote.shipping_method,
            subtotal_paise=quote.subtotal,
            item_discount_paise=max(0, quote.mrp_total - quote.subtotal),
            bundle_discount_paise=quote.bundle_discount,
            shipping_fee_paise=quote.shipping_fee,
            cod_fee_paise=quote.cod_fee,
            tax_total_paise=quote.tax_total,
            cgst_paise=quote.cgst,
            sgst_paise=quote.sgst,
            igst_paise=quote.igst,
            grand_total_paise=quote.total,
            placed_at=placed_at if status not in ("pending_payment", "payment_failed") else None,
            estimated_delivery_date=(placed_at + timedelta(days=rng.randint(3, 6))).date(),
            review_request_sent=True,
        )
        for line in quote.lines:
            v = line.variant
            image = v.product.images.all()[0] if v.product.images.all() else None
            OrderItem.objects.create(
                order=order,
                variant=v,
                product_id_snapshot=v.product_id,
                product_name=v.product.name,
                product_slug=v.product.slug,
                variant_label=v.label,
                sku=v.sku,
                image_url=(image.renditions.get("400") or image.image.url) if image else "",
                hsn_code=v.product.hsn_code,
                mrp_paise=line.mrp,
                unit_price_paise=line.unit_price,
                quantity=line.quantity,
                line_discount_paise=line.discount,
                tax_rate=v.product.tax_rate,
                tax_paise=line.tax,
                line_total_paise=line.net,
            )

        # Status history with plausible gaps between steps.
        events = []
        moment = placed_at
        if payment_method == "razorpay":
            events.append(("", "pending_payment", moment))
        if status in ("pending_payment", "payment_failed"):
            if status == "payment_failed":
                events.append(("pending_payment", "payment_failed", moment + timedelta(minutes=20)))
        else:
            previous = "pending_payment" if payment_method == "razorpay" else ""
            target = status
            if status == "cancelled":
                target = rng.choice(["placed", "confirmed"])
            for step in self.FLOW[: self.FLOW.index(target) + 1]:
                events.append((previous, step, moment))
                previous = step
                moment += timedelta(hours=rng.randint(4, 30))
            if status == "cancelled":
                events.append((previous, "cancelled", moment))
        for from_status, to_status, at in events:
            event = OrderStatusEvent.objects.create(order=order, from_status=from_status, to_status=to_status)
            OrderStatusEvent.objects.filter(pk=event.pk).update(created_at=at)

        fields = {"created_at": placed_at, "updated_at": events[-1][2]}
        paid = payment_method == "razorpay" and status not in ("pending_payment", "payment_failed")
        if status in ("shipped", "out_for_delivery", "delivered"):
            courier, url = rng.choice(activity.COURIERS)
            tracking = f"{courier[:2].upper()}{rng.randint(10**9, 10**10 - 1)}"
            fields.update(courier_name=courier, tracking_number=tracking, tracking_url=url.format(tracking))
        if status == "delivered":
            fields["delivered_at"] = events[-1][2]
            paid = True
        if status == "cancelled":
            fields.update(
                cancelled_at=events[-1][2],
                cancel_reason=rng.choice(
                    [
                        "Ordered the wrong size",
                        "Found it cheaper elsewhere",
                        "No longer needed",
                        "Delivery date too late",
                    ]
                ),
            )
        if status not in ("pending_payment", "payment_failed"):
            fields["invoice_number"] = next_invoice_number()
        if status == "payment_failed":
            fields["payment_status"] = "failed"
        elif status == "cancelled" and payment_method == "razorpay":
            fields["payment_status"] = "refunded"
        elif paid:
            fields["payment_status"] = "paid"
        Order.objects.filter(pk=order.pk).update(**fields)

        payment = Payment.objects.create(
            order=order,
            provider=payment_method,
            provider_order_id=f"order_seed{order.pk:05d}" if payment_method == "razorpay" else "",
            provider_payment_id=f"pay_seed{order.pk:05d}" if paid and payment_method == "razorpay" else "",
            amount_paise=order.grand_total_paise,
            status="captured"
            if paid or (status == "cancelled" and payment_method == "razorpay")
            else ("failed" if status == "payment_failed" else "created"),
            method=rng.choice(["upi", "card", "netbanking"]) if payment_method == "razorpay" else "",
            signature_verified=paid,
        )
        if status == "cancelled" and payment_method == "razorpay":
            Refund.objects.create(
                payment=payment,
                amount_paise=payment.amount_paise,
                status="processed",
                provider_refund_id=f"rfnd_seed{order.pk:05d}",
                reason="Order cancelled",
            )
            Payment.objects.filter(pk=payment.pk).update(status="refunded")
        order.refresh_from_db()
        return order

    def _seed_reviews(self, customers, delivered_orders):
        rng = self.rng
        reviewed = set()
        verified_pairs = [
            (o.user, item.product_id_snapshot) for o in delivered_orders if o.user for item in o.items.all()
        ]
        products = list(Product.objects.all())
        target = 180
        while len(reviewed) < target:
            if verified_pairs and rng.random() < 0.6:
                user, product_id = verified_pairs.pop(rng.randrange(len(verified_pairs)))
                verified = True
            else:
                user, product_id, verified = rng.choice(customers), rng.choice(products).pk, False
            if (user.pk, product_id) in reviewed:
                continue
            reviewed.add((user.pk, product_id))
            rating = self._weighted(activity.RATING_WEIGHTS)
            title, body = rng.choice(activity.REVIEWS[rating])
            status = "approved" if rng.random() < 0.9 else rng.choice(["pending", "pending", "rejected"])
            review = Review.objects.create(
                product_id=product_id,
                user=user,
                rating=rating,
                title=title,
                body=body,
                is_verified_buyer=verified,
                status=status,
                admin_reply="Thank you for letting us know. We've shared this with our makers." if rating <= 2 else "",
            )
            Review.objects.filter(pk=review.pk).update(created_at=timezone.now() - timedelta(days=rng.randint(1, 300)))
        for product_id in {pid for _, pid in reviewed}:
            refresh_ratings(product_id)

    def _seed_returns(self, delivered_orders):
        rng = self.rng
        candidates = [o for o in delivered_orders if o.delivered_at]
        for (status, reason, resolution, note), order in zip(
            activity.RETURNS, rng.sample(candidates, len(activity.RETURNS)), strict=False
        ):
            item = order.items.first()
            refund_amount = item.line_total_paise // item.quantity if resolution == "refund" else 0
            ret = ReturnRequest.objects.create(
                number=next_return_number(),
                order=order,
                user=order.user,
                email=order.email,
                status=status,
                reason=reason,
                resolution=resolution,
                refund_amount_paise=refund_amount,
                admin_note=note,
                refund_upi_id="patron@okaxis" if order.payment_method == "cod" else "",
                comments="Lovely piece, but it isn't quite right for me.",
                pickup_date=(order.delivered_at + timedelta(days=4)).date() if status != "requested" else None,
            )
            ReturnItem.objects.create(return_request=ret, order_item=item, quantity=1)
            chain = {
                "requested": ["requested"],
                "approved": ["requested", "approved"],
                "pickup_scheduled": ["requested", "approved", "pickup_scheduled"],
                "received": ["requested", "approved", "pickup_scheduled", "received"],
                "refunded": ["requested", "approved", "pickup_scheduled", "received", "refunded"],
                "replaced": ["requested", "approved", "pickup_scheduled", "received", "replaced"],
                "rejected": ["requested", "rejected"],
            }[status]
            previous = ""
            for step in chain:
                ReturnStatusEvent.objects.create(return_request=ret, from_status=previous, to_status=step)
                previous = step
            if status in ("received", "refunded", "replaced"):
                OrderItem.objects.filter(pk=item.pk).update(returned_quantity=1)
            if status == "refunded":
                payment = order.payments.first()
                Refund.objects.create(
                    payment=payment,
                    return_request=ret,
                    amount_paise=refund_amount,
                    status="manual" if order.payment_method == "cod" else "processed",
                    reason=f"Return {ret.number}",
                )
                Order.objects.filter(pk=order.pk).update(payment_status="partially_refunded")

    def _seed_views(self):
        rng = self.rng
        today = timezone.localdate()
        rows = []
        for product in Product.objects.all():
            base = rng.randint(5, 80) + (60 if product.is_featured else 0)
            for day in range(14):
                rows.append(
                    ProductView(
                        product=product,
                        date=today - timedelta(days=day),
                        views=max(0, int(base * rng.uniform(0.5, 1.4))),
                    )
                )
        ProductView.objects.bulk_create(rows, ignore_conflicts=True)
        from apps.catalog.tasks import recompute_trending_scores

        recompute_trending_scores()

    # ------------------------------------------------------------------ catalog
    def seed_catalog(self):
        if Product.objects.exists():
            self.stdout.write("Catalogue already present — skipping (use --flush to rebuild).")
            return
        self.stdout.write("Fetching photos…")
        jobs = [(pid, crop) for pid in data.CATEGORY_PHOTOS.values() for crop in ("banner", "tile")]
        for spec in data.PRODUCTS:
            jobs += [(pid, "main") for pid in spec["photos"]] + [(spec["photos"][0], "detail")]
        self.photos.prefetch(jobs)
        self.stdout.write("Seeding attributes, brands and categories…")
        with transaction.atomic():
            values = self._seed_attributes()
            brands = {name: Brand.objects.create(name=name, description=desc) for name, desc in data.BRANDS.items()}
            subcategories = self._seed_categories()
        self.stdout.write(f"Seeding {len(data.PRODUCTS)} products (downloading photos on first run)…")
        now = timezone.now()
        ids = []
        for index, spec in enumerate(data.PRODUCTS):
            with transaction.atomic():
                product = self._seed_product(spec, index, brands, subcategories, values, now)
            ids.append(product.pk)
            if (index + 1) % 15 == 0:
                self.stdout.write(f"  {index + 1} products")
        refresh_products(ids)
        refresh_search_vectors(ids)

    def _seed_attributes(self):
        values: dict[tuple[str, str], AttributeValue] = {}
        for position, (name, (kind, unit, axis, options)) in enumerate(data.ATTRIBUTES.items()):
            attr = Attribute.objects.create(name=name, kind=kind, unit=unit, is_variant_axis=axis, position=position)
            for vpos, option in enumerate(options):
                value, hex_code = option if isinstance(option, tuple) else (option, "")
                numeric = None
                if kind == "numeric":
                    number = value.replace('"', "").split()[0]
                    numeric = float(number) * (1024 if "TB" in value else 1)
                values[(name, value)] = AttributeValue.objects.create(
                    attribute=attr, value=value, hex=hex_code, numeric_value=numeric, position=vpos
                )
        return values

    def _seed_categories(self):
        attrs = {a.name: a for a in Attribute.objects.all()}
        subcategories = {}
        for position, (name, headline, policy, window, filterable, children) in enumerate(data.CATEGORIES):
            photo = data.CATEGORY_PHOTOS[name]
            root = Category.add_root(
                name=name,
                position=position,
                banner_headline=headline,
                banner_subtext=f"Explore {name.lower()} chosen by our buyers for craft and longevity.",
                return_policy=policy,
                return_window_days=window,
                seo_title=f"{name} — curated at Sartoria",
                seo_description=f"Shop considered {name.lower()} at Sartoria. {headline}.",
            )
            root.banner_image.save(f"{root.slug}-banner.jpg", self.photos.get(photo, "banner", name), save=False)
            root.image.save(f"{root.slug}.jpg", self.photos.get(photo, "tile", name), save=False)
            root.menu_image.save(f"{root.slug}-menu.jpg", self.photos.get(photo, "tile", name), save=False)
            root.save()
            root.filterable_attributes.set([attrs[a] for a in filterable])
            for child_pos, child_name in enumerate(children):
                child = Category.objects.get(pk=root.pk).add_child(
                    name=child_name,
                    position=child_pos,
                    return_policy=policy,
                    banner_headline=child_name,
                    banner_subtext=headline,
                )
                subcategories[child_name] = child
        return subcategories

    def _seed_product(self, spec, index, brands, subcategories, values, now):
        rng = self.rng
        days_old = spec["days_old"] if spec["days_old"] is not None else rng.randint(35, 400)
        product = Product.objects.create(
            name=spec["name"],
            brand=brands[spec["brand"]],
            category=subcategories[spec["category"]],
            product_type=Product.Type.BULKY if spec["bulky"] else Product.Type.STANDARD,
            short_description=spec["short"],
            description=self._description(spec),
            highlights=spec["highlights"],
            care_info=spec["care"],
            warranty_info=spec["warranty"],
            box_contents=spec["box"],
            tax_rate=spec["tax"],
            hsn_code=spec["hsn"],
            is_returnable=spec["returnable"],
            is_featured=spec["featured"],
            published_at=now - timedelta(days=days_old, hours=index),
            sales_count=rng.randint(0, 40) if days_old > 30 else rng.randint(0, 8),
            seo_title=f"{spec['name']} by {spec['brand']}",
            seo_description=spec["short"][:300],
        )
        for name, value in spec["facts"]:
            product.attribute_values.add(values[(name, value)])
        position = 0
        for group, rows in spec["specs"].items():
            for key, value in rows:
                ProductSpec.objects.create(product=product, group=group, key=key, value=value, position=position)
                position += 1
        if spec["brand"]:
            ProductSpec.objects.create(
                product=product, group="General", key="Brand", value=spec["brand"], position=position
            )
        self._seed_variants(product, spec, values)
        self._seed_images(product, spec)
        return product

    @staticmethod
    def _description(spec) -> str:
        paragraphs = [f"<p>{spec['short']}</p>"]
        if spec["highlights"]:
            items = "".join(f"<li>{h}</li>" for h in spec["highlights"])
            paragraphs.append(f"<ul>{items}</ul>")
        paragraphs.append(
            f"<p>Every {spec['brand']} piece at Sartoria is inspected by our team before it ships, "
            "and arrives in recyclable packaging.</p>"
        )
        return "".join(paragraphs)

    def _seed_variants(self, product, spec, values):
        rng = self.rng
        axes = spec["axes"]
        names = list(axes)
        options = [[o if isinstance(o, tuple) else (o, 0) for o in axes[n]] for n in names]
        combos = list(itertools.product(*options)) if names else [()]
        mrp_ratio = (spec["mrp"] / spec["price"]) if spec["mrp"] else None
        sku_base = "".join(w[0] for w in spec["name"].split()[:4]).upper() + f"{product.pk:03d}"
        for position, combo in enumerate(combos):
            delta = sum(d for _, d in combo)
            price = (spec["price"] + delta) * 100
            mrp = self._price_point(price * mrp_ratio) if mrp_ratio else None
            if spec["stock"] is not None:
                stock = spec["stock"]
            else:
                roll = rng.random()
                stock = 0 if roll < 0.07 else rng.randint(1, 4) if roll < 0.2 else rng.randint(8, 60)
            suffix = "-".join(slugify(v)[:6].upper() for v, _ in combo)
            variant = ProductVariant.objects.create(
                product=product,
                sku=f"SRT-{sku_base}{'-' + suffix if suffix else ''}",
                price_paise=price,
                compare_at_paise=mrp,
                stock=stock,
                weight_g=20000 if spec["bulky"] else rng.choice([250, 400, 600, 900, 1200]),
                position=position,
            )
            if combo:
                variant.option_values.set([values[(n, v)] for n, (v, _) in zip(names, combo, strict=True)])
            if stock:
                StockMovement.objects.create(
                    variant=variant, delta=stock, balance_after=stock, reason=StockMovement.Reason.INITIAL
                )

    @staticmethod
    def _price_point(paise: float) -> int:
        """Round an MRP up to a familiar price point (₹70,908 → ₹70,999; ₹849 → ₹899)."""
        rupees = paise / 100
        step = 1000 if rupees >= 5000 else 100
        return int((-(-rupees // step) * step - 1) * 100)

    def _seed_images(self, product, spec):
        photos = spec["photos"]
        plan = [(photos[0], "main", "front view")]
        if len(photos) > 1:
            plan.append((photos[1], "main", "worn outdoors"))
        plan.append((photos[0], "detail", "close-up detail"))
        for position, (photo_id, crop, view) in enumerate(plan):
            ProductImage.objects.create(
                product=product,
                image=self.photos.get(photo_id, crop, product.name),
                alt_text=f"{product.name}, {view}",
                position=position,
            )
