from django.db import models

from apps.core.models import BaseModel


class Payment(BaseModel):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        CAPTURED = "captured", "Captured"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"
        PARTIALLY_REFUNDED = "partially_refunded", "Partially refunded"

    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, related_name="payments")
    provider = models.CharField(max_length=20)
    provider_order_id = models.CharField(max_length=80, blank=True, db_index=True)
    provider_payment_id = models.CharField(max_length=80, blank=True, db_index=True)
    amount_paise = models.PositiveBigIntegerField()
    currency = models.CharField(max_length=3, default="INR")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CREATED, db_index=True)
    signature_verified = models.BooleanField(default=False)
    method = models.CharField(max_length=30, blank=True, help_text="card, upi, netbanking… as reported.")
    error_description = models.CharField(max_length=300, blank=True)
    raw = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.provider} {self.provider_order_id or self.pk} ({self.status})"

    @property
    def refunded_paise(self) -> int:
        return sum(r.amount_paise for r in self.refunds.exclude(status=Refund.Status.FAILED))


class Refund(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSED = "processed", "Processed"
        MANUAL = "manual", "Manual transfer required"
        FAILED = "failed", "Failed"

    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="refunds")
    return_request = models.ForeignKey(
        "orders.ReturnRequest", null=True, blank=True, on_delete=models.SET_NULL, related_name="refunds"
    )
    amount_paise = models.PositiveBigIntegerField()
    provider_refund_id = models.CharField(max_length=80, blank=True, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reason = models.CharField(max_length=200, blank=True)
    reference = models.CharField(max_length=120, blank=True, help_text="UTR or transfer reference for manual refunds.")
    raw = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Refund {self.amount_paise} ({self.status})"


class WebhookEvent(models.Model):
    provider = models.CharField(max_length=20)
    event_id = models.CharField(max_length=120, unique=True)
    event_type = models.CharField(max_length=60)
    payload = models.JSONField()
    processed_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-received_at",)

    def __str__(self):
        return f"{self.provider}:{self.event_type}"
