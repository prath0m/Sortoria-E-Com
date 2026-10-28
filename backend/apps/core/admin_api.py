"""Admin API for store settings, staff, the audit log and CSV import/export."""

from django.db import transaction
from django.http import HttpResponse, StreamingHttpResponse
from django_filters import rest_framework as filters
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .admin_tools import FormBooleanMixin, SafeImageField
from .audit import diff, record, snapshot
from .exceptions import DomainError
from .models import AuditLog, ImportJob, StoreSettings
from .pagination import AdminPagination
from .permissions import CAPABILITIES, HasCapability, capabilities_for, has_capability
from .services import dataio


# --------------------------------------------------------------------------- store settings
class AdminSettingsSerializer(FormBooleanMixin, serializers.ModelSerializer):
    logo = SafeImageField(max_side=1200)
    logo_monogram = SafeImageField(max_side=512)
    favicon = SafeImageField(max_side=256)
    og_default_image = SafeImageField(max_side=1600)

    class Meta:
        model = StoreSettings
        exclude = ("id", "created_at", "updated_at")

    def validate_state(self, value):
        from apps.accounts.serializers import STATE_CODES

        if value and value not in STATE_CODES:
            raise serializers.ValidationError("Choose a state from the list.")
        return value

    def validate_gstin(self, value):
        value = value.strip().upper()
        if value and (len(value) != 15 or not value.isalnum()):
            raise serializers.ValidationError("A GSTIN is 15 letters and digits.")
        return value

    def validate_dispatch_cutoff_hour(self, value):
        if not 0 <= value <= 23:
            raise serializers.ValidationError("Use an hour from 0 to 23.")
        return value

    def validate(self, attrs):
        from apps.accounts.serializers import STATE_CODES

        if attrs.get("state"):
            attrs["state_code"] = STATE_CODES[attrs["state"]]
        gstin = attrs.get("gstin", getattr(self.instance, "gstin", ""))
        state_code = attrs.get("state_code", getattr(self.instance, "state_code", ""))
        if gstin and state_code and gstin[:2] != state_code:
            raise serializers.ValidationError({"gstin": "The GSTIN's first two digits should match the store's state."})
        return attrs


class AdminSettingsView(APIView):
    permission_classes = [HasCapability("settings.manage")]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(responses=AdminSettingsSerializer)
    def get(self, request):
        return Response(AdminSettingsSerializer(StoreSettings.load(), context={"request": request}).data)

    @extend_schema(request=AdminSettingsSerializer, responses=AdminSettingsSerializer)
    def patch(self, request):
        instance = StoreSettings.objects.get_or_create(pk=1)[0]
        before = snapshot(instance)
        serializer = AdminSettingsSerializer(instance, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        saved = serializer.save()
        changes = diff(before, snapshot(saved))
        if changes:
            record(request, AuditLog.Action.UPDATE, obj=saved, object_repr="Store settings", changes=changes)
        from . import caching

        caching.bump(caching.HOME, caching.NAVIGATION)
        return Response(AdminSettingsSerializer(saved, context={"request": request}).data)


# --------------------------------------------------------------------------- staff
class StaffSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    capabilities = serializers.SerializerMethodField()
    invited = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "role",
            "is_active",
            "date_joined",
            "last_login",
            "capabilities",
            "invited",
        )
        read_only_fields = ("id", "email", "date_joined", "last_login")

    def get_capabilities(self, obj) -> list[str]:
        return capabilities_for(obj)

    def get_invited(self, obj) -> bool:
        """True until they've set a password."""
        return not obj.has_usable_password()

    def validate_role(self, value):
        if value not in (User.Role.MANAGER, User.Role.ADMIN):
            raise serializers.ValidationError("Staff are managers or admins. Remove access to make them a customer.")
        return value


class InviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=[User.Role.MANAGER, User.Role.ADMIN])


def _send_invite(user: User) -> None:
    from django.conf import settings

    from apps.accounts.services.auth import reset_link

    from .emails import send_email

    url = (
        reset_link(user) if not user.has_usable_password() else f"{settings.FRONTEND_URL.rstrip('/')}/admin-panel/login"
    )
    send_email(
        "staff_invite",
        user.email,
        {"first_name": user.first_name, "role": user.get_role_display().lower(), "reset_url": url},
    )


class StaffViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [HasCapability("staff.manage")]
    serializer_class = StaffSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return User.objects.filter(role__in=[User.Role.MANAGER, User.Role.ADMIN]).order_by(
            "role", "first_name", "email"
        )

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["get"])
    def roles(self, request):
        """What each role can do, for the role picker."""
        return Response(
            {
                role: sorted(cap for cap, roles in CAPABILITIES.items() if role in roles)
                for role in (User.Role.MANAGER, User.Role.ADMIN)
            }
        )

    @extend_schema(request=InviteSerializer, responses=StaffSerializer)
    def create(self, request):
        data = InviteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        email = User.objects.normalize_email(data.validated_data["email"]).lower()
        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()
            if user and user.is_store_staff:
                raise DomainError("This person already has admin access.", code="already_staff")
            if user is None:
                user = User(email=email)
                user.set_unusable_password()
            for key in ("first_name", "last_name"):
                if data.validated_data.get(key):
                    setattr(user, key, data.validated_data[key])
            user.role = data.validated_data["role"]
            user.is_active = True
            user.save()
        transaction.on_commit(lambda: _send_invite(user))
        record(
            request, AuditLog.Action.CREATE, obj=user, object_repr=f"Invited {user.email}", changes={"role": user.role}
        )
        return Response(StaffSerializer(user).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        user = serializer.instance
        incoming_role = serializer.validated_data.get("role", user.role)
        incoming_active = serializer.validated_data.get("is_active", user.is_active)
        if user.pk == self.request.user.pk and (incoming_role != user.role or not incoming_active):
            raise DomainError("You can't change your own role or access. Ask another admin.", code="self_change")
        losing_admin = user.role == User.Role.ADMIN and (incoming_role != User.Role.ADMIN or not incoming_active)
        if losing_admin and not User.objects.filter(role=User.Role.ADMIN, is_active=True).exclude(pk=user.pk).exists():
            raise DomainError("The store needs at least one active admin.", code="last_admin")
        before = snapshot(user)
        saved = serializer.save()
        if not saved.is_active:
            from apps.accounts.services.auth import revoke_all_tokens

            revoke_all_tokens(saved)
        record(self.request, AuditLog.Action.UPDATE, obj=saved, changes=diff(before, snapshot(saved)))

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        """Remove admin access entirely (the account remains as a customer)."""
        user = self.get_object()
        if user.pk == request.user.pk:
            raise DomainError("You can't remove your own access.", code="self_change")
        if (
            user.role == User.Role.ADMIN
            and not User.objects.filter(role=User.Role.ADMIN, is_active=True).exclude(pk=user.pk).exists()
        ):
            raise DomainError("The store needs at least one active admin.", code="last_admin")
        from apps.accounts.services.auth import revoke_all_tokens

        previous = user.role
        user.role = User.Role.CUSTOMER
        user.save(update_fields=["role"])
        revoke_all_tokens(user)
        record(request, AuditLog.Action.UPDATE, obj=user, changes={"role": {"from": previous, "to": "customer"}})
        return Response({"revoked": True})

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"])
    def resend(self, request, pk=None):
        user = self.get_object()
        _send_invite(user)
        return Response({"sent": True})


# --------------------------------------------------------------------------- audit log
class AuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()
    action_label = serializers.CharField(source="get_action_display")

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "action",
            "action_label",
            "object_type",
            "object_id",
            "object_repr",
            "changes",
            "ip",
            "user_agent",
            "created_at",
        )

    def get_actor(self, obj) -> dict | None:
        if obj.actor is None:
            return None
        return {"id": obj.actor_id, "email": obj.actor.email, "name": obj.actor.full_name}


class AuditFilter(filters.FilterSet):
    date_from = filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = filters.DateFilter(field_name="created_at", lookup_expr="date__lte")
    actor = filters.NumberFilter(field_name="actor_id")

    class Meta:
        model = AuditLog
        fields = ("action", "object_type", "actor")


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasCapability("audit.view")]
    serializer_class = AuditLogSerializer
    pagination_class = AdminPagination
    filterset_class = AuditFilter
    search_fields = ("object_repr", "object_id", "actor__email")
    ordering = ("-created_at",)
    queryset = AuditLog.objects.select_related("actor")

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["get"])
    def facets(self, request):
        return Response(
            {
                "object_types": list(
                    AuditLog.objects.order_by("object_type").values_list("object_type", flat=True).distinct()
                ),
                "actions": [{"value": v, "label": label} for v, label in AuditLog.Action.choices],
                "actors": [
                    {"id": u.pk, "email": u.email}
                    for u in User.objects.filter(pk__in=AuditLog.objects.values("actor_id")).order_by("email")
                ],
            }
        )


# --------------------------------------------------------------------------- import / export
class ImportJobSerializer(serializers.ModelSerializer):
    created_by = serializers.EmailField(source="created_by.email", default=None, read_only=True)
    file_name = serializers.SerializerMethodField()
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = ImportJob
        fields = (
            "id",
            "kind",
            "status",
            "total_rows",
            "success_rows",
            "error_rows",
            "has_report",
            "message",
            "file_name",
            "created_by",
            "created_at",
        )

    def get_file_name(self, obj) -> str:
        return _original_name(obj)

    def get_has_report(self, obj) -> bool:
        return bool(obj.error_report)


def _original_name(job) -> str:
    """Uploaded files are stored as <random>__<original name>."""
    name = job.file.name.rsplit("/", 1)[-1] if job.file else ""
    return name.split("__", 1)[-1]


IMPORT_CAPABILITY = {
    ImportJob.Kind.PRODUCTS: "import.run",
    ImportJob.Kind.INVENTORY: "inventory.manage",
    ImportJob.Kind.PINCODES: "shipping.manage",
}


class ImportJobViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [HasCapability("export.run")]
    serializer_class = ImportJobSerializer
    pagination_class = AdminPagination
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = ImportJob.objects.select_related("created_by")
    filterset_fields = ("kind", "status")

    @extend_schema(request={"multipart/form-data": OpenApiTypes.OBJECT}, responses=ImportJobSerializer)
    def create(self, request):
        kind = request.data.get("kind")
        upload = request.FILES.get("file")
        if kind not in ImportJob.Kind.values:
            raise DomainError("Choose what you're importing.", code="bad_kind")
        if not has_capability(request.user, IMPORT_CAPABILITY[kind]):
            return Response({"detail": "Your role can't run this import."}, status=status.HTTP_403_FORBIDDEN)
        if upload is None or not upload.name.lower().endswith(".csv"):
            raise DomainError("Upload a .csv file.", code="bad_file")
        if upload.size > dataio.MAX_BYTES:
            raise DomainError("Files must be 5 MB or smaller.", code="too_large")
        import secrets

        original = upload.name[-80:]
        upload.name = f"{secrets.token_urlsafe(12)}__{original}"
        job = ImportJob.objects.create(kind=kind, file=upload, created_by=request.user)
        record(request, AuditLog.Action.IMPORT, obj=job, changes={"file": original})
        from .tasks import run_import

        transaction.on_commit(lambda: run_import.delay(job.pk))
        return Response(ImportJobSerializer(job, context={"request": request}).data, status=status.HTTP_202_ACCEPTED)

    @extend_schema(responses={(200, "text/csv"): OpenApiTypes.BINARY})
    @action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        job = self.get_object()
        if not job.error_report:
            raise DomainError("This import had no errors.", code="no_report")
        from django.http import FileResponse

        return FileResponse(
            job.error_report.open("rb"), filename=f"import-{job.pk}-errors.csv", content_type="text/csv"
        )

    @extend_schema(responses={(200, "text/csv"): OpenApiTypes.BINARY})
    @action(detail=False, methods=["get"], url_path=r"template/(?P<kind>[a-z]+)")
    def template(self, request, kind=None):
        if kind not in dataio.TEMPLATES:
            raise DomainError("Unknown template.", code="bad_kind")
        header, example = dataio.TEMPLATES[kind]
        response = HttpResponse("".join(dataio.stream_csv(header, [example])), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="sartoria-{kind}-template.csv"'
        return response


EXPORT_CAPABILITY = {
    "products": "catalog.edit",
    "inventory": "inventory.manage",
    "orders": "orders.view",
    "customers": "customers.view",
    "pincodes": "shipping.manage",
}


class ExportView(APIView):
    permission_classes = [HasCapability("export.run")]

    @extend_schema(responses={(200, "text/csv"): OpenApiTypes.BINARY})
    def get(self, request, kind):
        if kind not in EXPORT_CAPABILITY:
            raise DomainError("Unknown export.", code="bad_kind")
        if not has_capability(request.user, EXPORT_CAPABILITY[kind]):
            return Response({"detail": "Your role can't run this export."}, status=status.HTTP_403_FORBIDDEN)
        header, rows = dataio.export_rows(kind, request.query_params)
        record(
            request,
            AuditLog.Action.EXPORT,
            object_type=f"export.{kind}",
            object_repr=f"Exported {kind}",
            changes=dict(request.query_params.items()),
        )
        response = StreamingHttpResponse(dataio.stream_csv(header, rows), content_type="text/csv; charset=utf-8")
        from django.utils import timezone

        response["Content-Disposition"] = (
            f'attachment; filename="sartoria-{kind}-{timezone.localdate().isoformat()}.csv"'
        )
        return response
