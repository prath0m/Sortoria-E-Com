import secrets

from django.conf import settings
from django.db import models

from apps.catalog.models import ProductVariant
from apps.core.models import BaseModel


class OrderStatus(models.TextChoices):
    PENDING_PAYMENT = "pending_payment", "Awaiting payment"
    PAYMENT_FAILED = "payment_failed", "Payment failed"
    PLACED = "placed", "Placed"
    CONFIRMED = "confirmed", "Confirmed"
    PACKED = "packed", "Packed"
    SHIPPED = "shipped", "Shipped"
    OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PAID = "paid", "Paid"
    FAILED = "failed", "Failed"
    REFUNDED = "refunded", "Refunded"
    PARTIALLY_REFUNDED = "partially_refunded", "Partially refunded"


def _token():
    return secrets.token_urlsafe(24)


class Order(BaseModel):
    UNSUCCESSFUL_STATUSES = (OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED)
    SUCCESSFUL_STATUSES = (
        OrderStatus.PLACED,
        OrderStatus.CONFIRMED,
        OrderStatus.PACKED,
        OrderStatus.SHIPPED,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
    )

    number = models.CharField(max_length=24, unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="orders"
    )
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=10)
    status = models.CharField(max_length=20, choices=OrderStatus.choices, db_index=True)
    payment_method = models.CharField(max_length=20)
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING, db_index=True
    )
    currency = models.CharField(max_length=3, default="INR")

    shipping_address = models.JSONField()
    billing_address = models.JSONField()
    shipping_method = models.CharField(max_length=20)
    coupon_code = models.CharField(max_length=30, blank=True)

    subtotal_paise = models.PositiveBigIntegerField(help_text="Sum of unit prices × quantities.")
    item_discount_paise = models.PositiveBigIntegerField(default=0, help_text="MRP savings, informational.")
    bundle_discount_paise = models.PositiveBigIntegerField(default=0)
    coupon_discount_paise = models.PositiveBigIntegerField(default=0)
    shipping_fee_paise = models.PositiveBigIntegerField(default=0)
    cod_fee_paise = models.PositiveBigIntegerField(default=0)
    tax_total_paise = models.PositiveBigIntegerField(default=0)
    cgst_paise = models.PositiveBigIntegerField(default=0)
    sgst_paise = models.PositiveBigIntegerField(default=0)
    igst_paise = models.PositiveBigIntegerField(default=0)
    grand_total_paise = models.PositiveBigIntegerField()

    courier_name = models.CharField(max_length=60, blank=True)
    tracking_number = models.CharField(max_length=60, blank=True)
    tracking_url = models.URLField(blank=True)
    estimated_delivery_date = models.DateField(null=True, blank=True)

    reservation_expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    placed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=300, blank=True)
    customer_note = models.CharField(max_length=500, blank=True)
    internal_note = models.TextField(blank=True)
    guest_access_token = models.CharField(max_length=64, default=_token, editable=False)
    invoice_number = models.CharField(max_length=32, blank=True)
    invoice_pdf = models.FileField(upload_to="invoices/%Y/%m/", blank=True)
    review_request_sent = models.BooleanField(default=False)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("status", "placed_at"))]

    def __str__(self):
        return self.number


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey(
        ProductVariant, null=True, on_delete=models.SET_NULL, related_name="order_items"
    )
    product_id_snapshot = models.PositiveBigIntegerField(null=True)
    product_name = models.CharField(max_length=160)
    product_slug = models.CharField(max_length=170, blank=True)
    variant_label = models.CharField(max_length=120, blank=True)
    sku = models.CharField(max_length=64)
    image_url = models.CharField(max_length=300, blank=True)
    hsn_code = models.CharField(max_length=8, blank=True)
    mrp_paise = models.PositiveBigIntegerField()
    unit_price_paise = models.PositiveBigIntegerField()
    quantity = models.PositiveIntegerField()
    line_discount_paise = models.PositiveBigIntegerField(
        default=0, help_text="Allocated bundle + coupon discount."
    )
    tax_rate = models.PositiveSmallIntegerField()
    tax_paise = models.PositiveBigIntegerField()
    line_total_paise = models.PositiveBigIntegerField()
    returned_quantity = models.PositiveIntegerField(default=0)
    flash_sale_item_id = models.PositiveBigIntegerField(null=True, blank=True)

    class Meta:
        ordering = ("id",)

    def __str__(self):
        return f"{self.quantity} × {self.product_name}"


class OrderStatusEvent(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="events")
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, choices=OrderStatus.choices)
    note = models.CharField(max_length=300, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("created_at", "id")

    def __str__(self):
        return f"{self.order_id}: {self.from_status} → {self.to_status}"
