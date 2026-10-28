"""Admin API for shipping methods, zones and serviceable pincodes."""

from django.db.models import Count, ProtectedError
from rest_framework import mixins, serializers, viewsets

from apps.core.admin_tools import ReorderMixin
from apps.core.audit import AuditedViewSetMixin
from apps.core.exceptions import DomainError
from apps.core.pagination import AdminPagination
from apps.core.permissions import HasCapability

from .models import ServiceablePincode, ShippingMethod, ShippingZone

ShippingPermission = HasCapability("shipping.manage")


class ShippingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingMethod
        exclude = ("created_at", "updated_at")
        read_only_fields = ("code", "position")


class ShippingMethodViewSet(
    AuditedViewSetMixin,
    ReorderMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Standard and Express are fixed by code (checkout relies on them); their rates and wording are editable."""

    permission_classes = [ShippingPermission]
    serializer_class = ShippingMethodSerializer
    queryset = ShippingMethod.objects.all()
    pagination_class = None


class ShippingZoneSerializer(serializers.ModelSerializer):
    pincode_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ShippingZone
        exclude = ("created_at", "updated_at")

    def validate(self, attrs):
        for prefix in ("standard", "express"):
            lo = attrs.get(f"{prefix}_days_min", getattr(self.instance, f"{prefix}_days_min", 0))
            hi = attrs.get(f"{prefix}_days_max", getattr(self.instance, f"{prefix}_days_max", 0))
            if lo > hi:
                raise serializers.ValidationError(
                    {f"{prefix}_days_max": "The slowest estimate can't be under the fastest."}
                )
        return attrs


class ShippingZoneViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [ShippingPermission]
    serializer_class = ShippingZoneSerializer
    pagination_class = None

    def get_queryset(self):
        return ShippingZone.objects.annotate(pincode_count=Count("pincodes"))

    def perform_destroy(self, instance):
        try:
            super().perform_destroy(instance)
        except ProtectedError as exc:
            raise DomainError("Move this zone's pincodes to another zone first.", code="in_use") from exc


class PincodeSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source="zone.name", read_only=True)

    class Meta:
        model = ServiceablePincode
        fields = ("id", "pincode", "zone", "zone_name", "city", "state", "state_code", "is_active")

    def validate(self, attrs):
        from apps.accounts.serializers import STATE_CODES

        state = attrs.get("state")
        if state and not attrs.get("state_code"):
            attrs["state_code"] = STATE_CODES.get(state, "")
        return attrs


class PincodeViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [ShippingPermission]
    serializer_class = PincodeSerializer
    pagination_class = AdminPagination
    queryset = ServiceablePincode.objects.select_related("zone")
    filterset_fields = ("zone", "is_active", "state_code")
    search_fields = ("pincode", "city", "state")
    ordering_fields = ("pincode", "city", "state")
    ordering = ("pincode",)
