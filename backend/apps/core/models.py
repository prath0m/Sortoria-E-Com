from django.conf import settings
from django.core.cache import cache
from django.db import models


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OrderedModel(models.Model):
    """Rows the admin can drag into order."""

    position = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        abstract = True
        ordering = ("position", "id")


class StoreSettings(BaseModel):
    """Singleton holding every store-wide value the storefront reads."""

    CACHE_KEY = "store-settings"

    name = models.CharField(max_length=80, default="Sartoria")
    tagline = models.CharField(max_length=160, blank=True)
    logo = models.FileField(upload_to="brand/", blank=True)
    logo_monogram = models.FileField(upload_to="brand/", blank=True)
    favicon = models.FileField(upload_to="brand/", blank=True)
    og_default_image = models.ImageField(upload_to="brand/", blank=True)

    contact_email = models.EmailField(blank=True)
    support_phone = models.CharField(max_length=20, blank=True)
    whatsapp = models.CharField(max_length=20, blank=True)
    support_hours = models.CharField(max_length=80, blank=True)
    address_line1 = models.CharField(max_length=160, blank=True)
    address_line2 = models.CharField(max_length=160, blank=True)
    city = models.CharField(max_length=80, blank=True)
    state = models.CharField(max_length=80, blank=True)
    state_code = models.CharField(
        max_length=2, default="27", help_text="GST state code of the store, used for CGST/SGST vs IGST."
    )
    pincode = models.CharField(max_length=6, blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    legal_name = models.CharField(max_length=160, blank=True)

    instagram_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    pinterest_url = models.URLField(blank=True)
    youtube_url = models.URLField(blank=True)
    x_url = models.URLField(blank=True)

    announcement_text = models.CharField(max_length=200, blank=True)
    announcement_enabled = models.BooleanField(default=False)
    footer_blurb = models.TextField(blank=True)
    meta_title_suffix = models.CharField(max_length=80, blank=True)
    meta_description = models.CharField(max_length=300, blank=True)

    low_stock_threshold_default = models.PositiveIntegerField(default=5)
    return_window_days = models.PositiveIntegerField(default=15)
    cod_enabled = models.BooleanField(default=True)
    cod_fee_paise = models.PositiveIntegerField(default=4900)
    cod_max_order_paise = models.PositiveBigIntegerField(default=5000000)
    infinite_scroll_mobile = models.BooleanField(default=True)
    dispatch_cutoff_hour = models.PositiveSmallIntegerField(
        default=14, help_text="Orders placed after this hour (IST) ship the next working day."
    )

    class Meta:
        verbose_name = "store settings"
        verbose_name_plural = "store settings"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.pk = 1
        if self._state.adding:
            existing = StoreSettings.objects.filter(pk=1).values_list("created_at", flat=True).first()
            if existing:
                self._state.adding = False
                self.created_at = existing
        super().save(*args, **kwargs)
        cache.delete(self.CACHE_KEY)

    @classmethod
    def load(cls):
        obj = cache.get(cls.CACHE_KEY)
        if obj is None:
            obj, _ = cls.objects.get_or_create(pk=1)
            cache.set(cls.CACHE_KEY, obj, 60 * 60)
        return obj


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"
        BULK = "bulk"
        TRANSITION = "transition"
        IMPORT = "import"
        LOGIN = "login"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    object_type = models.CharField(max_length=60)
    object_id = models.CharField(max_length=64, blank=True)
    object_repr = models.CharField(max_length=200, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("object_type", "object_id"))]

    def __str__(self):
        return f"{self.action} {self.object_type}#{self.object_id}"


class AdminNotification(models.Model):
    class Kind(models.TextChoices):
        NEW_ORDER = "new_order"
        LOW_STOCK = "low_stock"
        RETURN_REQUESTED = "return_requested"
        REVIEW_PENDING = "review_pending"
        IMPORT_FINISHED = "import_finished"
        PAYMENT_FAILED = "payment_failed"

    kind = models.CharField(max_length=30, choices=Kind.choices)
    title = models.CharField(max_length=200)
    link = models.CharField(max_length=200, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    dedupe_key = models.CharField(max_length=120, blank=True, db_index=True)
    read_by = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.title


class ImportJob(BaseModel):
    class Kind(models.TextChoices):
        PRODUCTS = "products"
        INVENTORY = "inventory"
        PINCODES = "pincodes"

    class Status(models.TextChoices):
        PENDING = "pending"
        RUNNING = "running"
        COMPLETED = "completed"
        FAILED = "failed"

    kind = models.CharField(max_length=20, choices=Kind.choices)
    file = models.FileField(upload_to="imports/")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    total_rows = models.PositiveIntegerField(default=0)
    success_rows = models.PositiveIntegerField(default=0)
    error_rows = models.PositiveIntegerField(default=0)
    error_report = models.FileField(upload_to="imports/errors/", blank=True)
    message = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.kind} import #{self.pk}"
