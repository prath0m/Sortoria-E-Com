"""Admin API for coupons, flash sales / daily deals and bundles."""

from django.db import transaction
from django.db.models import Count, Sum
from django.db.models.functions import Coalesce
from django_filters import rest_framework as filters
from rest_framework import serializers, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from apps.catalog.models import Category, Product
from apps.core import caching
from apps.core.admin_tools import FormBooleanMixin, ModelCleanMixin, ReorderMixin, SafeImageField
from apps.core.audit import AuditedViewSetMixin
from apps.core.pagination import AdminPagination
from apps.core.permissions import HasCapability

from .models import Bundle, BundleItem, Coupon, FlashSale, FlashSaleItem

OffersPermission = HasCapability("offers.manage")


def _schedule_state(obj) -> str:
    from django.utils import timezone

    now = timezone.now()
    if not obj.is_active:
        return "inactive"
    if obj.starts_at and obj.starts_at > now:
        return "scheduled"
    if obj.ends_at and obj.ends_at <= now:
        return "ended"
    return "live"


class ProductRefSerializer(serializers.ModelSerializer):
    thumb = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ("id", "name", "min_price_paise", "thumb")

    def get_thumb(self, obj) -> str | None:
        image = next(iter(obj.images.all()), None)
        return image.image.url if image else None


# --------------------------------------------------------------------------- coupons
class AdminCouponSerializer(FormBooleanMixin, ModelCleanMixin, serializers.ModelSerializer):
    applicable_categories = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Category.objects.all(), required=False
    )
    applicable_products = serializers.PrimaryKeyRelatedField(many=True, queryset=Product.objects.all(), required=False)
    products_detail = ProductRefSerializer(source="applicable_products", many=True, read_only=True)
    state = serializers.SerializerMethodField()
    revenue_paise = serializers.IntegerField(read_only=True, default=0)
    discount_given_paise = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Coupon
        fields = (
            "id",
            "code",
            "description",
            "discount_type",
            "value",
            "max_discount_paise",
            "min_order_paise",
            "starts_at",
            "ends_at",
            "usage_limit_total",
            "usage_limit_per_user",
            "first_order_only",
            "applicable_categories",
            "applicable_products",
            "products_detail",
            "is_active",
            "times_used",
            "state",
            "revenue_paise",
            "discount_given_paise",
        )
        read_only_fields = ("times_used",)

    def get_state(self, obj) -> str:
        return _schedule_state(obj)

    def validate_code(self, value):
        code = value.strip().upper()
        if not code.replace("-", "").isalnum():
            raise serializers.ValidationError("Use letters, numbers and hyphens only.")
        if Coupon.objects.filter(code=code).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("Another coupon already uses this code.")
        return code


class CouponFilter(filters.FilterSet):
    state = filters.ChoiceFilter(
        method="filter_state", choices=[(s, s) for s in ("live", "scheduled", "ended", "inactive")]
    )

    class Meta:
        model = Coupon
        fields = ("discount_type", "state")

    def filter_state(self, qs, name, value):
        from django.db.models import Q
        from django.utils import timezone

        now = timezone.now()
        if value == "inactive":
            return qs.filter(is_active=False)
        active = qs.filter(is_active=True)
        if value == "scheduled":
            return active.filter(starts_at__gt=now)
        if value == "ended":
            return active.filter(ends_at__lte=now)
        return active.filter(starts_at__lte=now).filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now))


class AdminCouponViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [OffersPermission]
    serializer_class = AdminCouponSerializer
    pagination_class = AdminPagination
    filterset_class = CouponFilter
    search_fields = ("code", "description")
    ordering_fields = ("created_at", "times_used", "code", "ends_at")
    ordering = ("-created_at",)

    def get_queryset(self):
        return Coupon.objects.prefetch_related("applicable_categories", "applicable_products__images").annotate(
            revenue_paise=Coalesce(Sum("redemptions__order__grand_total_paise"), 0),
            discount_given_paise=Coalesce(Sum("redemptions__discount_paise"), 0),
        )


# --------------------------------------------------------------------------- flash sales & deals
class FlashItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    product_detail = ProductRefSerializer(source="product", read_only=True)

    class Meta:
        model = FlashSaleItem
        fields = ("id", "product", "product_detail", "discount_type", "value", "quantity_cap", "sold_count")
        read_only_fields = ("sold_count",)

    def validate(self, attrs):
        if attrs.get("discount_type") == FlashSaleItem.DiscountType.PERCENT and not 1 <= attrs.get("value", 0) <= 90:
            raise serializers.ValidationError({"value": "Percent off must be between 1 and 90."})
        if attrs.get("discount_type") == FlashSaleItem.DiscountType.FIXED_PRICE and attrs.get("value", 0) < 100:
            raise serializers.ValidationError({"value": "Enter the sale price."})
        return attrs


class AdminFlashSaleSerializer(FormBooleanMixin, ModelCleanMixin, serializers.ModelSerializer):
    items = FlashItemSerializer(many=True, required=False)
    slug = serializers.SlugField(required=False, allow_blank=True)
    state = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    banner_image = SafeImageField()

    class Meta:
        model = FlashSale
        fields = (
            "id",
            "kind",
            "title",
            "slug",
            "subtitle",
            "banner_image",
            "starts_at",
            "ends_at",
            "is_active",
            "position",
            "items",
            "item_count",
            "state",
        )
        read_only_fields = ("position",)

    def get_state(self, obj) -> str:
        return _schedule_state(obj)

    def get_item_count(self, obj) -> int:
        return len(obj.items.all())

    def validate_items(self, items):
        products = [i["product"].pk for i in items]
        if len(products) != len(set(products)):
            raise serializers.ValidationError("Each product can appear only once in a sale.")
        return items

    def _sync_items(self, sale, items):
        keep = []
        for position, data in enumerate(items):
            item_id = data.pop("id", None)
            item = sale.items.filter(pk=item_id).first() if item_id else None
            if item is None:
                item = sale.items.filter(product=data["product"]).first() or FlashSaleItem(sale=sale)
            for key, value in data.items():
                setattr(item, key, value)
            item.position = position
            item.save()
            keep.append(item.pk)
        for stale in sale.items.exclude(pk__in=keep):
            stale.delete()  # one by one so the post_delete signal refreshes each product's prices

    @transaction.atomic
    def create(self, validated):
        items = validated.pop("items", [])
        sale = FlashSale.objects.create(**validated)
        self._sync_items(sale, items)
        return sale

    @transaction.atomic
    def update(self, instance, validated):
        items = validated.pop("items", None)
        instance = super().update(instance, validated)
        if items is not None:
            self._sync_items(instance, items)
        return instance


class AdminFlashSaleViewSet(AuditedViewSetMixin, ReorderMixin, viewsets.ModelViewSet):
    permission_classes = [OffersPermission]
    serializer_class = AdminFlashSaleSerializer
    pagination_class = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ("kind",)

    def get_queryset(self):
        return FlashSale.objects.prefetch_related("items__product__images").order_by("-starts_at")

    def after_reorder(self):
        caching.bump(caching.OFFERS, caching.HOME)


# --------------------------------------------------------------------------- bundles
class BundleItemSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    product_detail = ProductRefSerializer(source="product", read_only=True)

    class Meta:
        model = BundleItem
        fields = ("product", "product_detail", "quantity")


class AdminBundleSerializer(FormBooleanMixin, serializers.ModelSerializer):
    items = BundleItemSerializer(many=True, required=False)
    slug = serializers.SlugField(required=False, allow_blank=True)
    state = serializers.SerializerMethodField()
    full_price_paise = serializers.SerializerMethodField()
    image = SafeImageField()

    class Meta:
        model = Bundle
        fields = (
            "id",
            "title",
            "slug",
            "description",
            "image",
            "discount_type",
            "value",
            "starts_at",
            "ends_at",
            "is_active",
            "items",
            "state",
            "full_price_paise",
        )

    def get_state(self, obj) -> str:
        return _schedule_state(obj)

    def get_full_price_paise(self, obj) -> int:
        return sum(i.product.min_price_paise * i.quantity for i in obj.items.all())

    def validate_items(self, items):
        if len(items) < 2:
            raise serializers.ValidationError("A bundle needs at least two products.")
        products = [i["product"].pk for i in items]
        if len(products) != len(set(products)):
            raise serializers.ValidationError("Each product can appear only once; raise its quantity instead.")
        return items

    def validate(self, attrs):
        kind, value = attrs.get("discount_type"), attrs.get("value")
        if kind == Bundle.DiscountType.PERCENT and value is not None and not 1 <= value <= 90:
            raise serializers.ValidationError({"value": "Percent off must be between 1 and 90."})
        starts, ends = attrs.get("starts_at"), attrs.get("ends_at")
        if starts and ends and ends <= starts:
            raise serializers.ValidationError({"ends_at": "The end must be after the start."})
        return attrs

    def _sync_items(self, bundle, items):
        bundle.items.all().delete()
        BundleItem.objects.bulk_create([BundleItem(bundle=bundle, **i) for i in items])
        caching.bump(caching.OFFERS, caching.HOME)

    @transaction.atomic
    def create(self, validated):
        items = validated.pop("items", None)
        if not items:
            raise serializers.ValidationError({"items": ["A bundle needs at least two products."]})
        bundle = Bundle.objects.create(**validated)
        self._sync_items(bundle, items)
        return bundle

    @transaction.atomic
    def update(self, instance, validated):
        items = validated.pop("items", None)
        instance = super().update(instance, validated)
        if items is not None:
            self._sync_items(instance, items)
        return instance


class AdminBundleViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [OffersPermission]
    serializer_class = AdminBundleSerializer
    pagination_class = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return Bundle.objects.prefetch_related("items__product__images").annotate(n=Count("items"))
