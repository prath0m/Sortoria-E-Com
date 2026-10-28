"""Admin API for orders, returns and customers."""

from datetime import date
from io import BytesIO

from django.db.models import Count, Max, Q, Sum
from django.db.models.functions import Coalesce
from django.http import FileResponse, HttpResponse
from django_filters import rest_framework as filters
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from pypdf import PdfReader, PdfWriter
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.services.auth import revoke_all_tokens
from apps.core.audit import record, snapshot
from apps.core.exceptions import DomainError
from apps.core.models import AuditLog
from apps.core.pagination import AdminPagination
from apps.core.permissions import HasCapability

from .models import Order, OrderStatus, ReturnRequest, ReturnStatus
from .serializers import OrderDetailSerializer, ReturnSerializer
from .services.invoices import ensure_invoice, render_invoice_pdf
from .services.returns import TRANSITIONS as RETURN_TRANSITIONS
from .services.returns import transition_return
from .services.state_machine import STAFF, allowed_transitions, transition


# --------------------------------------------------------------------------- orders
class AdminOrderRowSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display")
    customer = serializers.SerializerMethodField()
    item_count = serializers.IntegerField()

    class Meta:
        model = Order
        fields = (
            "number",
            "customer",
            "email",
            "phone",
            "status",
            "status_label",
            "payment_method",
            "payment_status",
            "grand_total_paise",
            "item_count",
            "shipping_method",
            "created_at",
            "placed_at",
        )

    def get_customer(self, obj) -> str:
        return obj.shipping_address.get("full_name", "") or obj.email


class AdminOrderDetailSerializer(OrderDetailSerializer):
    allowed_transitions = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    returns = serializers.SerializerMethodField()
    customer_id = serializers.IntegerField(source="user_id", allow_null=True)
    customer_order_count = serializers.SerializerMethodField()

    class Meta(OrderDetailSerializer.Meta):
        fields = OrderDetailSerializer.Meta.fields + (
            "internal_note",
            "invoice_number",
            "allowed_transitions",
            "payments",
            "returns",
            "customer_id",
            "customer_order_count",
            "reservation_expires_at",
        )

    def get_allowed_transitions(self, obj) -> list[dict]:
        return [{"status": s, "label": OrderStatus(s).label} for s in allowed_transitions(obj, STAFF)]

    def get_payments(self, obj) -> list[dict]:
        return [
            {
                "provider": p.provider,
                "provider_order_id": p.provider_order_id,
                "provider_payment_id": p.provider_payment_id,
                "amount_paise": p.amount_paise,
                "status": p.status,
                "method": p.method,
                "created_at": p.created_at,
                "refunds": [
                    {
                        "amount_paise": r.amount_paise,
                        "status": r.status,
                        "reason": r.reason,
                        "reference": r.reference,
                        "created_at": r.created_at,
                    }
                    for r in p.refunds.all()
                ],
            }
            for p in obj.payments.all()
        ]

    def get_returns(self, obj) -> list[dict]:
        return [
            {"number": r.number, "status": r.status, "status_label": r.get_status_display()} for r in obj.returns.all()
        ]

    def get_customer_order_count(self, obj) -> int:
        return Order.objects.filter(email=obj.email, status__in=Order.SUCCESSFUL_STATUSES).count()


class AdminOrderUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ("courier_name", "tracking_number", "tracking_url", "estimated_delivery_date", "internal_note")


class OrderFilter(filters.FilterSet):
    status = filters.MultipleChoiceFilter(choices=OrderStatus.choices)
    payment_status = filters.CharFilter()
    payment_method = filters.CharFilter()
    date_from = filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = filters.DateFilter(field_name="created_at", lookup_expr="date__lte")
    min_total = filters.NumberFilter(method="filter_min")
    max_total = filters.NumberFilter(method="filter_max")
    customer = filters.NumberFilter(field_name="user_id")

    class Meta:
        model = Order
        fields = ("status", "payment_status", "payment_method", "customer")

    def filter_min(self, qs, name, value):
        return qs.filter(grand_total_paise__gte=int(value * 100))

    def filter_max(self, qs, name, value):
        return qs.filter(grand_total_paise__lte=int(value * 100))


class AdminOrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [HasCapability("orders.view", "orders.manage")]
    pagination_class = AdminPagination
    filterset_class = OrderFilter
    lookup_field = "number"
    search_fields = ("number", "email", "phone", "tracking_number", "shipping_address__full_name")
    ordering_fields = ("created_at", "grand_total_paise", "status")
    ordering = ("-created_at",)

    def get_queryset(self):
        qs = Order.objects.all()
        if self.action == "list":
            return qs.annotate(item_count=Coalesce(Sum("items__quantity"), 0))
        return qs.prefetch_related("items", "events", "payments__refunds", "returns")

    def get_serializer_class(self):
        return AdminOrderRowSerializer if self.action == "list" else AdminOrderDetailSerializer

    def _detail(self, order):
        return Response(AdminOrderDetailSerializer(self.get_queryset().get(pk=order.pk)).data)

    @extend_schema(request=AdminOrderUpdateSerializer, responses=AdminOrderDetailSerializer)
    def partial_update(self, request, number=None):
        order = self.get_object()
        before = snapshot(order)
        serializer = AdminOrderUpdateSerializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record(
            request,
            AuditLog.Action.UPDATE,
            obj=order,
            changes={k: v for k, v in snapshot(order).items() if before.get(k) != v},
        )
        return self._detail(order)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=AdminOrderDetailSerializer)
    @action(detail=True, methods=["post"])
    def transition(self, request, number=None):
        order = self.get_object()
        to, note = request.data.get("status"), str(request.data.get("note", ""))[:300]
        for field in ("courier_name", "tracking_number", "tracking_url"):
            if request.data.get(field):
                setattr(order, field, str(request.data[field])[:200])
        order.save(update_fields=["courier_name", "tracking_number", "tracking_url"])
        previous = order.status
        transition(order, to, actor_type=STAFF, actor=request.user, note=note)
        record(
            request,
            AuditLog.Action.TRANSITION,
            obj=order,
            changes={"status": {"from": previous, "to": to}, "note": note},
        )
        return self._detail(order)

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    @action(detail=True, methods=["get"])
    def invoice(self, request, number=None):
        order = self.get_object()
        if not order.invoice_number:
            raise DomainError("Invoices are issued once an order is placed.", code="no_invoice")
        if not order.invoice_pdf:
            ensure_invoice(order)
        return FileResponse(
            order.invoice_pdf.open("rb"), filename=f"Invoice-{order.number}.pdf", content_type="application/pdf"
        )

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["post"])
    def bulk(self, request):
        """{"numbers": [...], "action": "transition", "status": "confirmed"} or {"action": "invoices"} (merged PDF)."""
        numbers = [str(n) for n in request.data.get("numbers", [])][:200]
        orders = list(Order.objects.filter(number__in=numbers).prefetch_related("items"))
        op = request.data.get("action")
        if op == "invoices":
            writer = PdfWriter()
            for order in orders:
                if order.invoice_number:
                    for page in PdfReader(BytesIO(render_invoice_pdf(order))).pages:
                        writer.add_page(page)
            if not writer.pages:
                raise DomainError("None of these orders have invoices yet.", code="no_invoice")
            out = BytesIO()
            writer.write(out)
            return HttpResponse(
                out.getvalue(),
                content_type="application/pdf",
                headers={"Content-Disposition": 'attachment; filename="invoices.pdf"'},
            )
        if op != "transition":
            raise DomainError("Unknown bulk action.", code="bad_action")
        to = request.data.get("status")
        done, failed = [], []
        for order in orders:
            try:
                transition(order, to, actor_type=STAFF, actor=request.user, note="Bulk update")
                done.append(order.number)
            except DomainError as exc:
                failed.append({"number": order.number, "reason": str(exc.detail)})
        record(
            request,
            AuditLog.Action.BULK,
            object_type="orders.Order",
            object_repr=f"→ {to} × {len(done)}",
            changes={"done": done, "failed": failed},
        )
        return Response({"updated": done, "failed": failed})


# --------------------------------------------------------------------------- returns
class AdminReturnRowSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.number")
    status_label = serializers.CharField(source="get_status_display")
    reason_label = serializers.CharField(source="get_reason_display")
    customer = serializers.SerializerMethodField()
    item_count = serializers.IntegerField()

    class Meta:
        model = ReturnRequest
        fields = (
            "number",
            "order_number",
            "customer",
            "email",
            "status",
            "status_label",
            "reason",
            "reason_label",
            "resolution",
            "refund_amount_paise",
            "item_count",
            "created_at",
        )

    def get_customer(self, obj) -> str:
        return obj.order.shipping_address.get("full_name", "") or obj.email


class AdminReturnDetailSerializer(ReturnSerializer):
    admin_note = serializers.CharField()
    refund_upi_id = serializers.CharField()
    payment_method = serializers.CharField(source="order.payment_method")
    customer = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()

    def get_customer(self, obj) -> dict:
        address = obj.order.shipping_address
        return {"name": address.get("full_name", ""), "email": obj.email, "phone": obj.order.phone, "address": address}

    def get_allowed_transitions(self, obj) -> list[dict]:
        allowed = RETURN_TRANSITIONS[obj.status]
        if obj.resolution == ReturnRequest.Resolution.REFUND:
            allowed = allowed - {"replaced"}
        else:
            allowed = allowed - {"refunded"}
        order = ["approved", "pickup_scheduled", "received", "refunded", "replaced", "rejected"]
        return [{"status": s, "label": ReturnStatus(s).label} for s in order if s in allowed]


class AdminReturnViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [HasCapability("returns.manage")]
    pagination_class = AdminPagination
    lookup_field = "number"
    search_fields = ("number", "order__number", "email")
    ordering_fields = ("created_at", "refund_amount_paise")
    ordering = ("-created_at",)
    filterset_fields = ("status", "resolution", "reason")

    def get_queryset(self):
        qs = ReturnRequest.objects.select_related("order")
        if self.action == "list":
            return qs.annotate(item_count=Coalesce(Sum("items__quantity"), 0))
        return qs.prefetch_related("items__order_item", "photos", "events")

    def get_serializer_class(self):
        return AdminReturnRowSerializer if self.action == "list" else AdminReturnDetailSerializer

    @extend_schema(request=OpenApiTypes.OBJECT, responses=AdminReturnDetailSerializer)
    @action(detail=True, methods=["post"])
    def transition(self, request, number=None):
        ret = self.get_object()
        to = request.data.get("status")
        pickup = request.data.get("pickup_date") or None
        if pickup:
            try:
                pickup = date.fromisoformat(pickup)
            except ValueError as exc:
                raise DomainError("Pickup date must be YYYY-MM-DD.", code="bad_date") from exc
        previous = ret.status
        transition_return(ret, to, actor=request.user, note=str(request.data.get("note", ""))[:300], pickup_date=pickup)
        record(request, AuditLog.Action.TRANSITION, obj=ret, changes={"status": {"from": previous, "to": to}})
        return Response(AdminReturnDetailSerializer(self.get_queryset().get(pk=ret.pk)).data)


# --------------------------------------------------------------------------- customers
class AdminCustomerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    order_count = serializers.IntegerField(read_only=True)
    lifetime_value = serializers.IntegerField(read_only=True)
    last_order_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "first_name",
            "last_name",
            "phone",
            "is_active",
            "marketing_opt_in",
            "date_joined",
            "last_login",
            "order_count",
            "lifetime_value",
            "last_order_at",
        )
        read_only_fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "marketing_opt_in",
            "date_joined",
            "last_login",
        )


class CustomerFilter(filters.FilterSet):
    has_orders = filters.BooleanFilter(method="filter_has_orders")
    joined_from = filters.DateFilter(field_name="date_joined", lookup_expr="date__gte")
    joined_to = filters.DateFilter(field_name="date_joined", lookup_expr="date__lte")
    is_active = filters.BooleanFilter()

    class Meta:
        model = User
        fields = ("has_orders", "is_active")

    def filter_has_orders(self, qs, name, value):
        return qs.filter(order_count__gt=0) if value else qs.filter(order_count=0)


class AdminCustomerViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    permission_classes = [HasCapability("customers.view", "customers.manage")]
    serializer_class = AdminCustomerSerializer
    pagination_class = AdminPagination
    filterset_class = CustomerFilter
    search_fields = ("email", "first_name", "last_name", "phone")
    ordering_fields = ("date_joined", "order_count", "lifetime_value", "last_order_at")
    ordering = ("-date_joined",)
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        success = Q(orders__status__in=Order.SUCCESSFUL_STATUSES)
        return User.objects.filter(role=User.Role.CUSTOMER).annotate(
            order_count=Count("orders", filter=success, distinct=True),
            lifetime_value=Coalesce(Sum("orders__grand_total_paise", filter=success), 0),
            last_order_at=Max("orders__placed_at"),
        )

    def retrieve(self, request, *args, **kwargs):
        customer = self.get_object()
        data = self.get_serializer(customer).data
        data["addresses"] = [
            {**a.as_snapshot(), "id": a.pk, "label": a.label, "is_default": a.is_default_shipping}
            for a in customer.addresses.all()
        ]
        data["orders"] = AdminOrderRowSerializer(
            Order.objects.filter(user=customer)
            .annotate(item_count=Coalesce(Sum("items__quantity"), 0))
            .order_by("-created_at")[:50],
            many=True,
        ).data
        data["reviews"] = customer.reviews.count()
        data["returns"] = customer.returns.count()
        return Response(data)

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        user = serializer.save()
        if not user.is_active:
            revoke_all_tokens(user)
        record(
            self.request,
            AuditLog.Action.UPDATE,
            obj=user,
            changes={"is_active": {"from": before["is_active"], "to": user.is_active}},
        )
