from rest_framework import serializers

from apps.accounts.serializers import STATE_CODES

from .models import Order, OrderItem, OrderStatusEvent, ReturnRequest
from .services.state_machine import CUSTOMER, allowed_transitions


class CheckoutAddressSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=120)
    phone = serializers.RegexField(r"^[6-9][0-9]{9}$", error_messages={"invalid": "Enter a 10-digit mobile number."})
    line1 = serializers.CharField(max_length=160)
    line2 = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")
    landmark = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    city = serializers.CharField(max_length=80)
    state = serializers.ChoiceField(choices=sorted(STATE_CODES))
    pincode = serializers.RegexField(r"^[1-9][0-9]{5}$", error_messages={"invalid": "Enter a valid 6-digit pincode."})

    def validate(self, attrs):
        attrs["state_code"] = STATE_CODES[attrs["state"]]
        attrs["country"] = "IN"
        return attrs


class CheckoutLineSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=10)


class CheckoutSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    phone = serializers.RegexField(r"^[6-9][0-9]{9}$", required=False)
    address_id = serializers.IntegerField(required=False)
    shipping_address = CheckoutAddressSerializer(required=False)
    billing_same_as_shipping = serializers.BooleanField(default=True)
    billing_address = CheckoutAddressSerializer(required=False)
    save_address = serializers.BooleanField(default=False)
    lines = CheckoutLineSerializer(many=True, required=False, max_length=50)
    coupon_code = serializers.CharField(required=False, allow_blank=True, max_length=30)
    shipping_method = serializers.CharField(max_length=20)
    payment_method = serializers.ChoiceField(choices=["razorpay", "cod"])
    customer_note = serializers.CharField(required=False, allow_blank=True, max_length=500)
    expected_total_paise = serializers.IntegerField(required=False, min_value=0)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.is_authenticated:
            missing = [f for f in ("email", "phone", "shipping_address", "lines") if not attrs.get(f)]
            if missing:
                raise serializers.ValidationError({f: "This field is required." for f in missing})
        elif not attrs.get("address_id") and not attrs.get("shipping_address"):
            raise serializers.ValidationError({"shipping_address": "Please choose or add a delivery address."})
        if not attrs["billing_same_as_shipping"] and not attrs.get("billing_address"):
            raise serializers.ValidationError({"billing_address": "Please add a billing address."})
        return attrs


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product_name",
            "product_slug",
            "variant_label",
            "sku",
            "image_url",
            "mrp_paise",
            "unit_price_paise",
            "quantity",
            "line_discount_paise",
            "tax_rate",
            "tax_paise",
            "line_total_paise",
            "returned_quantity",
        )


class OrderEventSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="get_to_status_display")

    class Meta:
        model = OrderStatusEvent
        fields = ("to_status", "label", "note", "created_at")


class OrderSummarySerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display")
    item_count = serializers.SerializerMethodField()
    preview_images = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "number",
            "status",
            "status_label",
            "payment_status",
            "payment_method",
            "grand_total_paise",
            "placed_at",
            "created_at",
            "item_count",
            "preview_images",
        )

    def get_item_count(self, obj) -> int:
        return sum(i.quantity for i in obj.items.all())

    def get_preview_images(self, obj) -> list[str]:
        return [i.image_url for i in obj.items.all() if i.image_url][:4]


class OrderDetailSerializer(OrderSummarySerializer):
    items = OrderItemSerializer(many=True)
    events = OrderEventSerializer(many=True)
    can_cancel = serializers.SerializerMethodField()
    can_retry_payment = serializers.SerializerMethodField()
    has_invoice = serializers.SerializerMethodField()
    access_token = serializers.CharField(source="guest_access_token")

    class Meta(OrderSummarySerializer.Meta):
        fields = OrderSummarySerializer.Meta.fields + (
            "email",
            "phone",
            "shipping_address",
            "billing_address",
            "shipping_method",
            "coupon_code",
            "subtotal_paise",
            "item_discount_paise",
            "bundle_discount_paise",
            "coupon_discount_paise",
            "shipping_fee_paise",
            "cod_fee_paise",
            "tax_total_paise",
            "cgst_paise",
            "sgst_paise",
            "igst_paise",
            "courier_name",
            "tracking_number",
            "tracking_url",
            "estimated_delivery_date",
            "delivered_at",
            "cancelled_at",
            "cancel_reason",
            "customer_note",
            "items",
            "events",
            "can_cancel",
            "can_retry_payment",
            "has_invoice",
            "access_token",
        )

    def get_can_cancel(self, obj) -> bool:
        return "cancelled" in allowed_transitions(obj, CUSTOMER)

    def get_can_retry_payment(self, obj) -> bool:
        return obj.payment_method != "cod" and obj.status in ("pending_payment", "payment_failed")

    def get_has_invoice(self, obj) -> bool:
        return bool(obj.invoice_number)


class ReturnItemSerializer(serializers.Serializer):
    order_item_id = serializers.IntegerField(source="order_item.id")
    product_name = serializers.CharField(source="order_item.product_name")
    variant_label = serializers.CharField(source="order_item.variant_label")
    image_url = serializers.CharField(source="order_item.image_url")
    quantity = serializers.IntegerField()


class ReturnSerializer(serializers.Serializer):
    number = serializers.CharField()
    order_number = serializers.CharField(source="order.number")
    status = serializers.CharField()
    status_label = serializers.CharField(source="get_status_display")
    reason = serializers.CharField()
    reason_label = serializers.CharField(source="get_reason_display")
    resolution = serializers.CharField()
    comments = serializers.CharField()
    refund_amount_paise = serializers.IntegerField()
    pickup_date = serializers.DateField(allow_null=True)
    admin_note = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField()
    resolved_at = serializers.DateTimeField(allow_null=True)
    items = ReturnItemSerializer(many=True)
    photos = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()

    def get_admin_note(self, obj) -> str:
        return obj.admin_note if obj.status == "rejected" else ""

    def get_photos(self, obj) -> list[str]:
        return [p.image.url for p in obj.photos.all()]

    def get_events(self, obj) -> list[dict]:
        return [{"status": e.to_status, "label": e.get_to_status_display(), "created_at": e.created_at} for e in obj.events.all()]


class ReturnInput(serializers.Serializer):
    order_number = serializers.CharField()
    token = serializers.CharField(required=False, allow_blank=True)
    items = serializers.JSONField()
    reason = serializers.ChoiceField(choices=ReturnRequest.Reason.choices)
    comments = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    refund_upi_id = serializers.RegexField(r"^[\w.\-]{2,}@[a-zA-Z]{2,}$", required=False, allow_blank=True,
                                           error_messages={"invalid": "Enter a valid UPI ID, like name@bank."})

    def validate_items(self, value):
        if not isinstance(value, list) or not all(isinstance(i, dict) and "order_item_id" in i for i in value):
            raise serializers.ValidationError("Choose the pieces you'd like to return.")
        return value


class TrackInput(serializers.Serializer):
    number = serializers.CharField(max_length=24)
    contact = serializers.CharField(max_length=120, help_text="Email or mobile number used for the order.")
