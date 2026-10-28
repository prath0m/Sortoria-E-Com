from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.catalog.services.aggregates import refresh_ratings
from apps.core.audit import record
from apps.core.exceptions import DomainError
from apps.core.models import AuditLog
from apps.core.pagination import AdminPagination
from apps.core.permissions import HasCapability

from .models import Review
from .services import moderate


class AdminReviewSerializer(serializers.ModelSerializer):
    product = serializers.CharField(source="product.name", read_only=True)
    product_id = serializers.IntegerField(read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    author = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    photos = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "product",
            "product_id",
            "product_slug",
            "author",
            "email",
            "rating",
            "title",
            "body",
            "photos",
            "is_verified_buyer",
            "status",
            "admin_reply",
            "created_at",
            "moderated_at",
        )
        read_only_fields = ("id", "rating", "title", "body", "is_verified_buyer", "created_at", "moderated_at")

    def get_photos(self, obj) -> list[str]:
        return [p.image.url for p in obj.photos.all()]


class AdminReviewViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [HasCapability("reviews.manage")]
    serializer_class = AdminReviewSerializer
    pagination_class = AdminPagination
    filterset_fields = ("status", "rating", "is_verified_buyer", "product")
    search_fields = ("title", "body", "product__name", "user__email")
    ordering_fields = ("created_at", "rating")
    ordering = ("-created_at",)
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_queryset(self):
        return Review.objects.select_related("product", "user").prefetch_related("photos")

    def perform_update(self, serializer):
        review = serializer.instance
        status_value = serializer.validated_data.get("status", review.status)
        reply = serializer.validated_data.get("admin_reply")
        moderate(review, status_value, reply=reply)
        record(self.request, AuditLog.Action.UPDATE, obj=review, changes={"status": status_value, "reply": bool(reply)})

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["post"])
    def bulk(self, request):
        ids = [int(i) for i in request.data.get("ids", []) if str(i).isdigit()]
        op = request.data.get("action")
        reviews = list(Review.objects.filter(pk__in=ids))
        with transaction.atomic():
            if op in ("approve", "reject"):
                for review in reviews:
                    moderate(review, Review.Status.APPROVED if op == "approve" else Review.Status.REJECTED)
            elif op == "delete":
                product_ids = {r.product_id for r in reviews}
                Review.objects.filter(pk__in=ids).delete()
                for pid in product_ids:
                    refresh_ratings(pid)
            else:
                raise DomainError("Unknown bulk action.", code="bad_action")
        record(
            request,
            AuditLog.Action.BULK,
            object_type="reviews.Review",
            object_repr=f"{op} × {len(reviews)}",
            changes={"ids": ids},
        )
        return Response({"updated": len(reviews)})
