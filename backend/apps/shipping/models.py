from django.core.validators import RegexValidator
from django.db import models

from apps.core.models import BaseModel, OrderedModel


class ShippingMethod(OrderedModel, BaseModel):
    class Code(models.TextChoices):
        STANDARD = "standard", "Standard"
        EXPRESS = "express", "Express"

    code = models.CharField(max_length=20, choices=Code.choices, unique=True)
    name = models.CharField(max_length=60)
    description = models.CharField(max_length=200, blank=True)
    base_rate_paise = models.PositiveIntegerField(default=0)
    free_threshold_paise = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        help_text="Orders at or above this (after discounts) ship free. Blank = never free.",
    )
    bulky_surcharge_paise = models.PositiveIntegerField(default=0, help_text="Added once per bulky item.")
    allows_bulky = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        pass

    def __str__(self):
        return self.name


class ShippingZone(BaseModel):
    name = models.CharField(max_length=60, unique=True)
    standard_days_min = models.PositiveSmallIntegerField(default=3)
    standard_days_max = models.PositiveSmallIntegerField(default=6)
    express_days_min = models.PositiveSmallIntegerField(default=1)
    express_days_max = models.PositiveSmallIntegerField(default=2)
    express_available = models.BooleanField(default=True)
    cod_available = models.BooleanField(default=True)
    extra_fee_paise = models.PositiveIntegerField(default=0, help_text="Added to every method in this zone.")

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name

    def days_for(self, method_code: str) -> tuple[int, int]:
        if method_code == ShippingMethod.Code.EXPRESS:
            return self.express_days_min, self.express_days_max
        return self.standard_days_min, self.standard_days_max


class ServiceablePincode(models.Model):
    pincode = models.CharField(
        max_length=6,
        unique=True,
        validators=[RegexValidator(r"^[1-9][0-9]{5}$", "Enter a valid 6-digit pincode.")],
    )
    zone = models.ForeignKey(ShippingZone, on_delete=models.PROTECT, related_name="pincodes")
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80)
    state_code = models.CharField(max_length=2, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("pincode",)

    def __str__(self):
        return f"{self.pincode} {self.city}"
