from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.core.models import BaseModel, OrderedModel
from apps.core.utils import unique_slug


class ScheduledQuerySet(models.QuerySet):
    def live(self, at=None):
        at = at or timezone.now()
        return self.filter(is_active=True, starts_at__lte=at).filter(
            Q(ends_at__isnull=True) | Q(ends_at__gt=at)
        )


class Coupon(BaseModel):
    class DiscountType(models.TextChoices):
        PERCENT = "percent", "Percentage"
        FIXED = "fixed", "Fixed amount"

    code = models.CharField(max_length=30, unique=True)
    description = models.CharField(max_length=200, blank=True)
    discount_type = models.CharField(max_length=10, choices=DiscountType.choices)
    value = models.PositiveIntegerField(help_text="Percent (1-90) or amount in paise.")
    max_discount_paise = models.PositiveBigIntegerField(
        null=True, blank=True, help_text="Cap for percent coupons."
    )
    min_order_paise = models.PositiveBigIntegerField(default=0)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)
    usage_limit_total = models.PositiveIntegerField(null=True, blank=True)
    usage_limit_per_user = models.PositiveIntegerField(null=True, blank=True, default=1)
    first_order_only = models.BooleanField(default=False)
    applicable_categories = models.ManyToManyField(Category, blank=True, related_name="+")
    applicable_products = models.ManyToManyField(Product, blank=True, related_name="+")
    is_active = models.BooleanField(default=True)
    times_used = models.PositiveIntegerField(default=0)

    objects = ScheduledQuerySet.as_manager()

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.code

    def clean(self):
        if self.discount_type == self.DiscountType.PERCENT and not 1 <= self.value <= 90:
            raise ValidationError({"value": "Percentage coupons must be between 1 and 90."})
        if self.ends_at and self.ends_at <= self.starts_at:
            raise ValidationError({"ends_at": "The end must be after the start."})

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)


class FlashSale(OrderedModel, BaseModel):
    class Kind(models.TextChoices):
        FLASH = "flash", "Flash sale"
        DAILY_DEAL = "daily_deal", "Daily deal"

    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.FLASH)
    title = models.CharField(max_length=120)
    slug = models.SlugField(max_length=130, unique=True)
    subtitle = models.CharField(max_length=240, blank=True)
    banner_image = models.ImageField(upload_to="offers/", blank=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    # Whether product price aggregates currently include this sale; flipped by the sync task.
    prices_applied = models.BooleanField(default=False, editable=False)

    objects = ScheduledQuerySet.as_manager()

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return self.title

    def clean(self):
        if self.ends_at and self.starts_at and self.ends_at <= self.starts_at:
            raise ValidationError({"ends_at": "The end must be after the start."})

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title)
        super().save(*args, **kwargs)

    @property
    def is_live(self):
        now = timezone.now()
        return self.is_active and self.starts_at <= now < self.ends_at


class FlashSaleItem(models.Model):
    class DiscountType(models.TextChoices):
        PERCENT = "percent", "Percent off"
        FIXED_PRICE = "fixed_price", "Fixed sale price"

    sale = models.ForeignKey(FlashSale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="flash_items")
    discount_type = models.CharField(
        max_length=12, choices=DiscountType.choices, default=DiscountType.PERCENT
    )
    value = models.PositiveBigIntegerField(help_text="Percent off, or the sale price in paise.")
    quantity_cap = models.PositiveIntegerField(
        null=True, blank=True, help_text="Units available at this price."
    )
    sold_count = models.PositiveIntegerField(default=0)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("position", "id")
        constraints = [models.UniqueConstraint(fields=("sale", "product"), name="uniq_sale_product")]

    def __str__(self):
        return f"{self.sale} · {self.product}"

    @property
    def remaining(self):
        if self.quantity_cap is None:
            return None
        return max(0, self.quantity_cap - self.sold_count)

    def price_for(self, base_price: int) -> int:
        if self.discount_type == self.DiscountType.PERCENT:
            return max(100, base_price - (base_price * min(self.value, 95)) // 100)
        return min(base_price, max(100, self.value))


class Bundle(BaseModel):
    class DiscountType(models.TextChoices):
        PERCENT = "percent", "Percent off the set"
        FIXED_OFF = "fixed_off", "Amount off the set"
        FIXED_PRICE = "fixed_price", "Set price"

    title = models.CharField(max_length=120)
    slug = models.SlugField(max_length=130, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="offers/bundles/", blank=True)
    discount_type = models.CharField(
        max_length=12, choices=DiscountType.choices, default=DiscountType.PERCENT
    )
    value = models.PositiveBigIntegerField()
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    objects = ScheduledQuerySet.as_manager()

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title)
        super().save(*args, **kwargs)


class BundleItem(models.Model):
    bundle = models.ForeignKey(Bundle, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="bundle_items")
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("bundle", "product"), name="uniq_bundle_product")]

    def __str__(self):
        return f"{self.quantity} × {self.product}"
