"""Admin API for homepage content, pages and the newsletter list."""

import csv

from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from apps.catalog.models import Category, Product
from apps.core import caching
from apps.core.admin_tools import FormBooleanMixin, ModelCleanMixin, ReorderMixin, SafeImageField
from apps.core.audit import AuditedViewSetMixin
from apps.core.pagination import AdminPagination
from apps.core.permissions import HasCapability

from .models import Counter, HeroSlide, HomeSection, NewsletterSubscriber, Page, PromoBanner, Testimonial, TrustBadge

CmsPermission = HasCapability("cms.manage")


def _state(obj) -> str:
    if not obj.is_active:
        return "inactive"
    now = timezone.now()
    if getattr(obj, "starts_at", None) and obj.starts_at > now:
        return "scheduled"
    if getattr(obj, "ends_at", None) and obj.ends_at <= now:
        return "ended"
    return "live"


class ScheduleValidationMixin:
    def validate(self, attrs):
        attrs = super().validate(attrs)
        starts = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts and ends and ends <= starts:
            raise serializers.ValidationError({"ends_at": "The end must be after the start."})
        return attrs


class CmsViewSet(AuditedViewSetMixin, ReorderMixin, viewsets.ModelViewSet):
    permission_classes = [CmsPermission]
    pagination_class = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def after_reorder(self):
        caching.bump(caching.HOME)


# --------------------------------------------------------------------------- hero slides
class HeroSlideSerializer(FormBooleanMixin, ScheduleValidationMixin, serializers.ModelSerializer):
    image = SafeImageField(required=False)
    mobile_image = SafeImageField(max_side=1400)
    state = serializers.SerializerMethodField()

    class Meta:
        model = HeroSlide
        exclude = ("created_at", "updated_at")
        read_only_fields = ("position",)

    def get_state(self, obj) -> str:
        return _state(obj)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None and not attrs.get("image"):
            raise serializers.ValidationError({"image": ["Every slide needs an image."]})
        return attrs


class HeroSlideViewSet(CmsViewSet):
    serializer_class = HeroSlideSerializer
    queryset = HeroSlide.objects.all()


# --------------------------------------------------------------------------- homepage sections
class HomeSectionSerializer(FormBooleanMixin, serializers.ModelSerializer):
    image = SafeImageField()
    products = serializers.PrimaryKeyRelatedField(many=True, queryset=Product.objects.all(), required=False)
    categories = serializers.PrimaryKeyRelatedField(many=True, queryset=Category.objects.all(), required=False)
    type_label = serializers.CharField(source="get_type_display", read_only=True)
    products_detail = serializers.SerializerMethodField()

    class Meta:
        model = HomeSection
        exclude = ("created_at", "updated_at")
        read_only_fields = ("position",)

    def get_products_detail(self, obj) -> list[dict]:
        from apps.offers.admin_api import ProductRefSerializer

        return ProductRefSerializer(obj.products.prefetch_related("images"), many=True).data

    def validate_limit(self, value):
        if not 1 <= value <= 24:
            raise serializers.ValidationError("Show between 1 and 24 items.")
        return value


class HomeSectionViewSet(CmsViewSet):
    serializer_class = HomeSectionSerializer
    queryset = HomeSection.objects.prefetch_related("products", "categories")


# --------------------------------------------------------------------------- banners, badges, counters, testimonials
class PromoBannerSerializer(FormBooleanMixin, ScheduleValidationMixin, serializers.ModelSerializer):
    image = SafeImageField(required=False)
    mobile_image = SafeImageField(max_side=1400)
    state = serializers.SerializerMethodField()

    class Meta:
        model = PromoBanner
        exclude = ("created_at", "updated_at")
        read_only_fields = ("position",)

    def get_state(self, obj) -> str:
        return _state(obj)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None and not attrs.get("image"):
            raise serializers.ValidationError({"image": ["Every banner needs an image."]})
        return attrs


class PromoBannerViewSet(CmsViewSet):
    serializer_class = PromoBannerSerializer
    queryset = PromoBanner.objects.all()
    filterset_fields = ("placement",)


class TrustBadgeSerializer(FormBooleanMixin, serializers.ModelSerializer):
    class Meta:
        model = TrustBadge
        exclude = ("created_at", "updated_at")
        read_only_fields = ("position",)


class TrustBadgeViewSet(CmsViewSet):
    serializer_class = TrustBadgeSerializer
    queryset = TrustBadge.objects.all()


class CounterSerializer(FormBooleanMixin, serializers.ModelSerializer):
    class Meta:
        model = Counter
        exclude = ("created_at", "updated_at")
        read_only_fields = ("position",)


class CounterViewSet(CmsViewSet):
    serializer_class = CounterSerializer
    queryset = Counter.objects.all()


class TestimonialSerializer(FormBooleanMixin, ModelCleanMixin, serializers.ModelSerializer):
    avatar = SafeImageField(max_side=400)

    class Meta:
        model = Testimonial
        exclude = ("created_at", "updated_at")
        read_only_fields = ("position",)


class TestimonialViewSet(CmsViewSet):
    serializer_class = TestimonialSerializer
    queryset = Testimonial.objects.all()


# --------------------------------------------------------------------------- pages
class PageSerializer(FormBooleanMixin, serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Page
        exclude = ("created_at",)
        read_only_fields = ("updated_at",)

    def validate_slug(self, value):
        if value and Page.objects.filter(slug=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("Another page already uses this URL.")
        return value


class PageViewSet(CmsViewSet):
    serializer_class = PageSerializer
    queryset = Page.objects.all()


# --------------------------------------------------------------------------- newsletter
class SubscriberSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = NewsletterSubscriber
        fields = ("id", "email", "status", "status_label", "source", "created_at", "confirmed_at")


class SubscriberViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Read, export and remove subscribers. Sign-ups happen on the storefront (double opt-in)."""

    permission_classes = [CmsPermission]
    serializer_class = SubscriberSerializer
    pagination_class = AdminPagination
    queryset = NewsletterSubscriber.objects.all()
    filterset_fields = ("status",)
    search_fields = ("email", "source")
    ordering_fields = ("created_at", "email", "confirmed_at")
    ordering = ("-created_at",)

    def perform_destroy(self, instance):
        from apps.core.audit import record
        from apps.core.models import AuditLog

        record(self.request, AuditLog.Action.DELETE, obj=instance, object_repr=instance.email)
        instance.delete()

    @extend_schema(responses={(200, "text/csv"): OpenApiTypes.BINARY})
    @action(detail=False, methods=["get"])
    def export(self, request):
        qs = self.filter_queryset(self.get_queryset()).filter(status=NewsletterSubscriber.Status.CONFIRMED)
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="newsletter-subscribers.csv"'
        writer = csv.writer(response)
        writer.writerow(["email", "source", "subscribed_at", "confirmed_at"])
        for s in qs.iterator():
            writer.writerow(
                [s.email, s.source, s.created_at.isoformat(), s.confirmed_at.isoformat() if s.confirmed_at else ""]
            )
        return response
