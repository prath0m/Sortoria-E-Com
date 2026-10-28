from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from treebeard.mp_tree import MP_Node

from apps.core.models import BaseModel, OrderedModel, StoreSettings
from apps.core.utils import unique_slug

GST_RATES = [(0, "0%"), (3, "3% (gold & jewellery)"), (5, "5%"), (18, "18%"), (40, "40%")]


class ReturnPolicy(models.TextChoices):
    RETURNABLE = "returnable", "Returnable"
    REPLACEMENT_ONLY = "replacement_only", "Replacement only"
    NON_RETURNABLE = "non_returnable", "Non-returnable"


class Category(MP_Node, BaseModel):
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=90, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="categories/", blank=True)
    banner_image = models.ImageField(upload_to="categories/banners/", blank=True)
    banner_mobile_image = models.ImageField(upload_to="categories/banners/", blank=True)
    banner_headline = models.CharField(max_length=120, blank=True)
    banner_subtext = models.CharField(max_length=240, blank=True)
    menu_image = models.ImageField(upload_to="categories/menu/", blank=True)
    show_in_menu = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True, db_index=True)
    position = models.PositiveIntegerField(default=0)
    return_policy = models.CharField(
        max_length=20, choices=ReturnPolicy.choices, default=ReturnPolicy.RETURNABLE
    )
    return_window_days = models.PositiveIntegerField(
        null=True, blank=True, help_text="Leave blank to use the store default."
    )
    filterable_attributes = models.ManyToManyField("Attribute", blank=True, related_name="categories")
    seo_title = models.CharField(max_length=120, blank=True)
    seo_description = models.CharField(max_length=300, blank=True)

    node_order_by = ["position", "name"]

    class Meta:
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name)
        super().save(*args, **kwargs)

    def effective_return_policy(self):
        """Walk up the tree until a category sets a window; the policy itself is per node."""
        window = self.return_window_days
        if window is None:
            for ancestor in reversed(list(self.get_ancestors())):
                if ancestor.return_window_days is not None:
                    window = ancestor.return_window_days
                    break
        if window is None:
            window = StoreSettings.load().return_window_days
        return self.return_policy, window


class Brand(BaseModel):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True)
    logo = models.ImageField(upload_to="brands/", blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name)
        super().save(*args, **kwargs)


class Attribute(OrderedModel):
    class Kind(models.TextChoices):
        SWATCH = "swatch", "Colour swatch"
        TEXT = "text", "Text"
        NUMERIC = "numeric", "Numeric"

    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=60, unique=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEXT)
    unit = models.CharField(max_length=12, blank=True)
    is_variant_axis = models.BooleanField(default=True, help_text="Can products vary by this attribute?")
    is_filterable = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name, max_length=60)
        super().save(*args, **kwargs)


class AttributeValue(OrderedModel):
    attribute = models.ForeignKey(Attribute, on_delete=models.CASCADE, related_name="values")
    value = models.CharField(max_length=60)
    slug = models.SlugField(max_length=70)
    hex = models.CharField(max_length=7, blank=True, help_text="Swatch colour, e.g. #1F2A44")
    numeric_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta(OrderedModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=("attribute", "slug"), name="uniq_attribute_value_slug"),
        ]

    def __str__(self):
        return f"{self.attribute.name}: {self.value}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.value)[:70] or "value"
        super().save(*args, **kwargs)


class Product(BaseModel):
    class Type(models.TextChoices):
        STANDARD = "standard", "Standard"
        BULKY = "bulky", "Bulky (surcharge applies)"

    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=170, unique=True)
    brand = models.ForeignKey(
        Brand, null=True, blank=True, on_delete=models.SET_NULL, related_name="products"
    )
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    extra_categories = models.ManyToManyField(Category, blank=True, related_name="extra_products")
    product_type = models.CharField(max_length=10, choices=Type.choices, default=Type.STANDARD)
    short_description = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True, help_text="Sanitised HTML.")
    highlights = models.JSONField(default=list, blank=True, help_text="Short bullet points.")
    care_info = models.TextField(blank=True)
    warranty_info = models.CharField(max_length=200, blank=True)
    box_contents = models.CharField(max_length=300, blank=True)
    attribute_values = models.ManyToManyField(
        AttributeValue, blank=True, related_name="products", help_text="Non-variant facts, e.g. Material."
    )
    tax_rate = models.PositiveSmallIntegerField(
        choices=GST_RATES, default=18, help_text="GST slab (GST 2.0, Sept 2025)."
    )
    hsn_code = models.CharField(max_length=8, blank=True)
    is_returnable = models.BooleanField(
        null=True, blank=True, help_text="Override the category's return policy. Blank = follow category."
    )
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    published_at = models.DateTimeField(default=timezone.now)
    seo_title = models.CharField(max_length=120, blank=True)
    seo_description = models.CharField(max_length=300, blank=True)

    # Denormalised by apps.catalog.services.aggregates; never edited directly.
    min_price_paise = models.PositiveBigIntegerField(default=0)
    max_price_paise = models.PositiveBigIntegerField(default=0)
    mrp_paise = models.PositiveBigIntegerField(default=0)
    max_discount_pct = models.PositiveSmallIntegerField(default=0)
    in_stock = models.BooleanField(default=False)
    total_stock = models.IntegerField(default=0)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(default=0)
    sales_count = models.PositiveIntegerField(default=0)
    trending_score = models.FloatField(default=0)
    search_vector = SearchVectorField(null=True, editable=False)

    class Meta:
        ordering = ("-published_at",)
        indexes = [
            models.Index(fields=("is_active", "category")),
            models.Index(fields=("min_price_paise",)),
            models.Index(fields=("published_at",)),
            models.Index(fields=("rating_avg",)),
            models.Index(fields=("sales_count",)),
            models.Index(fields=("trending_score",)),
            models.Index(fields=("max_discount_pct",)),
            GinIndex(fields=("search_vector",), name="product_search_gin"),
            GinIndex(fields=("name",), name="product_name_trgm", opclasses=("gin_trgm_ops",)),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name, max_length=170)
        super().save(*args, **kwargs)

    @property
    def is_new(self):
        return (timezone.now() - self.published_at).days <= 30

    def return_terms(self) -> tuple[str, int]:
        policy, window = self.category.effective_return_policy()
        if self.is_returnable is False:
            policy = ReturnPolicy.NON_RETURNABLE
        elif self.is_returnable is True and policy == ReturnPolicy.NON_RETURNABLE:
            policy = ReturnPolicy.RETURNABLE
        return policy, window


class ProductVariant(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=64, unique=True)
    option_values = models.ManyToManyField(AttributeValue, blank=True, related_name="variants")
    price_paise = models.PositiveBigIntegerField(validators=[MinValueValidator(100)])
    compare_at_paise = models.PositiveBigIntegerField(
        null=True, blank=True, help_text="MRP. Shown struck through when higher than the price."
    )
    stock = models.IntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(null=True, blank=True)
    weight_g = models.PositiveIntegerField(default=500)
    is_active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("position", "id")
        indexes = [models.Index(fields=("stock",))]
        constraints = [
            models.CheckConstraint(condition=models.Q(stock__gte=0), name="variant_stock_non_negative")
        ]

    def __str__(self):
        return f"{self.product.name} ({self.label or self.sku})"

    @property
    def label(self) -> str:
        values = sorted(self.option_values.all(), key=lambda v: (v.attribute.position, v.attribute_id))
        return " / ".join(v.value for v in values)

    @property
    def mrp_paise(self) -> int:
        return max(self.compare_at_paise or 0, self.price_paise)

    def threshold(self) -> int:
        if self.low_stock_threshold is not None:
            return self.low_stock_threshold
        return StoreSettings.load().low_stock_threshold_default


class ProductImage(OrderedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    option_value = models.ForeignKey(
        AttributeValue,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text="Show this image when the shopper picks this colour or finish.",
    )
    image = models.ImageField(upload_to="products/%Y/%m/")
    alt_text = models.CharField(max_length=200)
    renditions = models.JSONField(default=dict, blank=True)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return self.alt_text


class ProductSpec(OrderedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="specs")
    group = models.CharField(max_length=60, blank=True)
    key = models.CharField(max_length=80)
    value = models.CharField(max_length=300)

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return f"{self.key}: {self.value}"


class StockMovement(models.Model):
    class Reason(models.TextChoices):
        ORDER_RESERVED = "order_reserved", "Reserved for order"
        ORDER_RELEASED = "order_released", "Released (unpaid order)"
        CANCELLED = "cancelled", "Order cancelled"
        RETURN_RESTOCK = "return_restock", "Return restocked"
        MANUAL = "manual_adjust", "Manual adjustment"
        IMPORT = "import", "CSV import"
        INITIAL = "initial", "Initial stock"

    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="movements")
    delta = models.IntegerField()
    balance_after = models.IntegerField()
    reason = models.CharField(max_length=20, choices=Reason.choices)
    reference = models.CharField(max_length=80, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.variant.sku} {self.delta:+d}"


class ProductView(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="daily_views")
    date = models.DateField(db_index=True)
    views = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("product", "date"), name="uniq_product_view_day")]

    def __str__(self):
        return f"{self.product_id} on {self.date}: {self.views}"
