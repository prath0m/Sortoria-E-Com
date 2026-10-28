"""Load realistic demo data: `python manage.py seed_demo [--flush] [--no-images]`.

Photos are fetched once from Unsplash's CDN into backend/seed_assets/images/ and reused on later runs.
Without network access (or with --no-images) on-brand placeholder artwork is generated instead.
"""

import itertools
import os
import random
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image, ImageDraw, ImageFont

from apps.accounts.models import User
from apps.accounts.serializers import STATE_CODES
from apps.catalog.models import (
    Attribute,
    AttributeValue,
    Brand,
    Category,
    Product,
    ProductImage,
    ProductSpec,
    ProductVariant,
    StockMovement,
)
from apps.catalog.services.aggregates import refresh_products, refresh_search_vectors
from apps.catalog.tasks import build_image_renditions
from apps.core import caching
from apps.core.models import StoreSettings
from apps.offers.models import Bundle, BundleItem, Coupon, CouponRedemption, FlashSale, FlashSaleItem
from apps.shipping.models import ServiceablePincode, ShippingMethod, ShippingZone
from config.celery import app as celery_app

from .seed_data import catalog as data
from .seed_data import commerce

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
            self._flush()
        with transaction.atomic():
            self.seed_store_settings()
            self.seed_staff()
        self.seed_catalog()
        self.build_missing_renditions()
        with transaction.atomic():
            self.seed_shipping()
            self.seed_offers()
        caching.bump(caching.CATALOG, caching.NAVIGATION, caching.HOME, caching.OFFERS, caching.SHIPPING)
        self.stdout.write(self.style.SUCCESS("Sartoria demo data is ready."))

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
