import secrets

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import BaseModel, OrderedModel
from apps.core.sanitize import clean_html
from apps.core.utils import unique_slug


class ScheduledQuerySet(models.QuerySet):
    def live(self):
        now = timezone.now()
        return self.filter(is_active=True).filter(
            Q(starts_at__isnull=True) | Q(starts_at__lte=now), Q(ends_at__isnull=True) | Q(ends_at__gt=now)
        )


class Scheduled(models.Model):
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    objects = ScheduledQuerySet.as_manager()

    class Meta:
        abstract = True


class HeroSlide(OrderedModel, Scheduled, BaseModel):
    class Theme(models.TextChoices):
        LIGHT = "light", "Light text on dark image"
        DARK = "dark", "Dark text on light image"

    class Align(models.TextChoices):
        LEFT = "left", "Left"
        CENTER = "center", "Centre"
        RIGHT = "right", "Right"

    eyebrow = models.CharField(max_length=60, blank=True)
    headline = models.CharField(max_length=120)
    subtext = models.CharField(max_length=240, blank=True)
    image = models.ImageField(upload_to="cms/hero/")
    mobile_image = models.ImageField(upload_to="cms/hero/", blank=True)
    image_alt = models.CharField(max_length=160, blank=True)
    cta_label = models.CharField(max_length=40, blank=True)
    cta_url = models.CharField(max_length=200, blank=True)
    secondary_cta_label = models.CharField(max_length=40, blank=True)
    secondary_cta_url = models.CharField(max_length=200, blank=True)
    text_theme = models.CharField(max_length=10, choices=Theme.choices, default=Theme.LIGHT)
    text_align = models.CharField(max_length=10, choices=Align.choices, default=Align.LEFT)

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return self.headline


class HomeSection(OrderedModel, BaseModel):
    class Type(models.TextChoices):
        HERO = "hero", "Hero slider"
        FEATURED_CATEGORIES = "featured_categories", "Featured categories"
        TRENDING = "trending", "Trending now"
        NEW_ARRIVALS = "new_arrivals", "New arrivals"
        BEST_SELLERS = "best_sellers", "Best sellers"
        FEATURED_PRODUCTS = "featured_products", "Hand-picked products"
        FLASH_SALE = "flash_sale", "Flash sale"
        DAILY_DEALS = "daily_deals", "Daily deals"
        BUNDLES = "bundles", "Bundles"
        PROMO_BANNERS = "promo_banners", "Promo banners"
        TRUST_BADGES = "trust_badges", "Trust badges"
        COUNTERS = "counters", "Counters"
        TESTIMONIALS = "testimonials", "Testimonials"
        NEWSLETTER = "newsletter", "Newsletter sign-up"
        EDITORIAL = "editorial", "Editorial story"

    PRODUCT_TYPES = {Type.TRENDING, Type.NEW_ARRIVALS, Type.BEST_SELLERS, Type.FEATURED_PRODUCTS}

    type = models.CharField(max_length=30, choices=Type.choices)
    eyebrow = models.CharField(max_length=60, blank=True)
    title = models.CharField(max_length=120, blank=True)
    subtitle = models.CharField(max_length=240, blank=True)
    body = models.TextField(blank=True, help_text="Editorial sections only.")
    image = models.ImageField(upload_to="cms/sections/", blank=True)
    cta_label = models.CharField(max_length=40, blank=True)
    cta_url = models.CharField(max_length=200, blank=True)
    limit = models.PositiveSmallIntegerField(default=12)
    products = models.ManyToManyField(
        "catalog.Product", blank=True, related_name="+", help_text="Hand-picked products."
    )
    categories = models.ManyToManyField("catalog.Category", blank=True, related_name="+")
    is_active = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return f"{self.get_type_display()}: {self.title}" if self.title else self.get_type_display()


class PromoBanner(OrderedModel, Scheduled, BaseModel):
    class Placement(models.TextChoices):
        HOME = "home", "Homepage"
        OFFERS = "offers", "Offers page"
        CART = "cart", "Cart"

    placement = models.CharField(max_length=20, choices=Placement.choices, default=Placement.HOME)
    eyebrow = models.CharField(max_length=60, blank=True)
    title = models.CharField(max_length=120)
    subtitle = models.CharField(max_length=240, blank=True)
    image = models.ImageField(upload_to="cms/banners/")
    mobile_image = models.ImageField(upload_to="cms/banners/", blank=True)
    cta_label = models.CharField(max_length=40, blank=True)
    cta_url = models.CharField(max_length=200, blank=True)
    badge_text = models.CharField(max_length=30, blank=True)

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return self.title


class TrustBadge(OrderedModel, BaseModel):
    class Icon(models.TextChoices):
        TRUCK = "truck", "Delivery truck"
        RETURN = "return", "Returns"
        SHIELD = "shield", "Secure payment"
        CHAT = "chat", "Support"
        GIFT = "gift", "Gift wrapping"
        LEAF = "leaf", "Sustainability"
        AWARD = "award", "Quality"

    icon = models.CharField(max_length=20, choices=Icon.choices)
    title = models.CharField(max_length=60)
    text = models.CharField(max_length=160, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return self.title


class Counter(OrderedModel, BaseModel):
    value = models.PositiveIntegerField()
    prefix = models.CharField(max_length=6, blank=True)
    suffix = models.CharField(max_length=12, blank=True, help_text="e.g. +, %, k")
    label = models.CharField(max_length=60)
    is_active = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return f"{self.value}{self.suffix} {self.label}"


class Testimonial(OrderedModel, BaseModel):
    name = models.CharField(max_length=80)
    location = models.CharField(max_length=80, blank=True)
    quote = models.TextField(max_length=600)
    rating = models.PositiveSmallIntegerField(default=5)
    avatar = models.ImageField(upload_to="cms/testimonials/", blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return self.name

    def clean(self):
        if not 1 <= self.rating <= 5:
            raise ValidationError({"rating": "Ratings run from 1 to 5."})


class Page(BaseModel):
    title = models.CharField(max_length=120)
    slug = models.SlugField(max_length=130, unique=True)
    summary = models.CharField(max_length=300, blank=True)
    body = models.TextField(help_text="Sanitised HTML.")
    seo_title = models.CharField(max_length=120, blank=True)
    seo_description = models.CharField(max_length=300, blank=True)
    show_in_footer = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("position", "title")

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title)
        self.body = clean_html(self.body)
        super().save(*args, **kwargs)


def _token():
    return secrets.token_urlsafe(24)


class NewsletterSubscriber(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Awaiting confirmation"
        CONFIRMED = "confirmed", "Confirmed"
        UNSUBSCRIBED = "unsubscribed", "Unsubscribed"

    email = models.EmailField(unique=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING, db_index=True)
    token = models.CharField(max_length=64, default=_token, unique=True)
    source = models.CharField(max_length=40, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.email
