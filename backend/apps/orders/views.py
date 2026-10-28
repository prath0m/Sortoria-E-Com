from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import Address
from apps.cart.services.cart import get_cart
from apps.core.exceptions import DomainError
from apps.payments.providers import ProviderError, available_providers, get_provider

from .models import Order, OrderStatus, ReturnRequest
from .serializers import (
    CheckoutSerializer,
    OrderDetailSerializer,
    OrderSummarySerializer,
    ReturnInput,
    ReturnSerializer,
    TrackInput,
)
from .services.checkout import CheckoutInput, place_order
from .services.invoices import ensure_invoice
from .services.returns import eligibility, request_return
from .services.state_machine import CUSTOMER, transition


def order_queryset():
    return Order.objects.prefetch_related("items", "events")


def get_accessible_order(request, number: str) -> Order:
    """The owner, or anyone holding the order's access token (guest links in emails)."""
    order = get_object_or_404(order_queryset(), number=number)
    token = request.query_params.get("token") or request.data.get("token")
    if request.user.is_authenticated and order.user_id == request.user.pk:
        return order
    if token and token == order.guest_access_token:
        return order
    raise Http404


class CheckoutConfigView(APIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(
            {
                "payment_methods": [
                    {"code": p.code, "name": p.display_name, "prepaid": p.prepaid} for p in available_providers()
                ]
            }
        )


class CheckoutView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "checkout"

    @extend_schema(request=CheckoutSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data
        user = request.user if request.user.is_authenticated else None

        if v.get("address_id"):
            address = get_object_or_404(Address, pk=v["address_id"], user=user)
            shipping = address.as_snapshot()
        else:
            shipping = dict(v["shipping_address"])
        billing = shipping if v["billing_same_as_shipping"] else dict(v["billing_address"])

        if user:
            cart = get_cart(user)
            items = list(cart.items.filter(saved_for_later=False).values_list("variant_id", "quantity"))
            coupon_code = cart.coupon.code if cart.coupon_id else ""
            email = user.email
            phone = v.get("phone") or user.phone or shipping["phone"]
        else:
            items = [(line["variant_id"], line["quantity"]) for line in v["lines"]]
            coupon_code = v.get("coupon_code", "")
            email, phone = v["email"], v["phone"]

        order, payment = place_order(
            CheckoutInput(
                email=email,
                phone=phone,
                shipping_address=shipping,
                billing_address=billing,
                items=items,
                shipping_method=v["shipping_method"],
                payment_method=v["payment_method"],
                coupon_code=coupon_code,
                customer_note=v.get("customer_note", ""),
                expected_total=v.get("expected_total_paise"),
            ),
            user=user,
        )
        if user and v.get("save_address") and not v.get("address_id"):
            has_default = user.addresses.filter(is_default_shipping=True).exists()
            Address.objects.create(
                user=user,
                is_default_shipping=not has_default,
                **{
                    k: shipping[k]
                    for k in (
                        "full_name",
                        "phone",
                        "line1",
                        "line2",
                        "landmark",
                        "city",
                        "state",
                        "state_code",
                        "pincode",
                    )
                },
            )
        return Response(
            {"order": OrderDetailSerializer(order).data, "payment": payment}, status=status.HTTP_201_CREATED
        )


class RetryPaymentView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "checkout"

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    def post(self, request, number):
        order = get_accessible_order(request, number)
        if order.payment_method == "cod" or order.status not in (
            OrderStatus.PENDING_PAYMENT,
            OrderStatus.PAYMENT_FAILED,
        ):
            raise DomainError("This order doesn't need payment.", code="no_payment_due")
        provider = get_provider(order.payment_method)
        with transaction.atomic():
            if order.status == OrderStatus.PAYMENT_FAILED:
                order = transition(order, OrderStatus.PENDING_PAYMENT, actor_type=CUSTOMER, note="Payment retried")
            order.reservation_expires_at = timezone.now() + timedelta(minutes=settings.PAYMENT_RESERVATION_MINUTES)
            order.save(update_fields=["reservation_expires_at"])
            try:
                payment = provider.create_payment(order)
            except ProviderError as exc:
                raise DomainError(str(exc), code="payment_provider_error") from exc
        return Response(
            {
                "order": OrderDetailSerializer(order_queryset().get(pk=order.pk)).data,
                "payment": provider.client_payload(payment),
            }
        )


class OrderDetailView(APIView):
    @extend_schema(parameters=[OpenApiParameter("token", str)], responses=OrderDetailSerializer)
    def get(self, request, number):
        return Response(OrderDetailSerializer(get_accessible_order(request, number)).data)


class InvoiceView(APIView):
    @extend_schema(
        parameters=[OpenApiParameter("token", str)], responses={(200, "application/pdf"): OpenApiTypes.BINARY}
    )
    def get(self, request, number):
        order = get_accessible_order(request, number)
        if not order.invoice_number:
            raise DomainError("The invoice is issued once the order is placed.", code="no_invoice")
        if not order.invoice_pdf:
            ensure_invoice(order)
        return FileResponse(
            order.invoice_pdf.open("rb"),
            as_attachment=True,
            filename=f"Invoice-{order.number}.pdf",
            content_type="application/pdf",
        )


class OrderListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSummarySerializer
    filter_backends: list = []

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .exclude(status=OrderStatus.PENDING_PAYMENT, reservation_expires_at__lt=timezone.now())
            .prefetch_related("items")
            .order_by("-created_at")
        )


class CancelOrderView(APIView):
    @extend_schema(request=OpenApiTypes.OBJECT, responses=OrderDetailSerializer)
    def post(self, request, number):
        order = get_accessible_order(request, number)
        reason = str(request.data.get("reason", "")).strip()[:300] or "Cancelled by customer"
        transition(order, OrderStatus.CANCELLED, actor_type=CUSTOMER, actor=request.user if request.user.is_authenticated else None, note=reason)
        return Response(OrderDetailSerializer(order_queryset().get(pk=order.pk)).data)


class TrackOrderView(APIView):
    """Public lookup by order number + the email or phone used. Returns the order with its access token."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "track"

    @extend_schema(request=TrackInput, responses=OrderDetailSerializer)
    def post(self, request):
        data = TrackInput(data=request.data)
        data.is_valid(raise_exception=True)
        number = data.validated_data["number"].strip().upper()
        contact = data.validated_data["contact"].strip().lower()
        digits = "".join(c for c in contact if c.isdigit())[-10:]
        order = order_queryset().filter(number=number).first()
        if order is None or not (contact == order.email or (len(digits) == 10 and digits == order.phone)):
            return Response(
                {"detail": "We couldn't find an order with those details. Please check and try again."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(OrderDetailSerializer(order).data)


class ReturnableItemsView(APIView):
    @extend_schema(parameters=[OpenApiParameter("token", str)], responses=OpenApiTypes.OBJECT)
    def get(self, request, number):
        order = get_accessible_order(request, number)
        return Response(
            {
                "order_number": order.number,
                "payment_method": order.payment_method,
                "items": [
                    {
                        "order_item_id": e.item.pk,
                        "product_name": e.item.product_name,
                        "variant_label": e.item.variant_label,
                        "image_url": e.item.image_url,
                        "quantity": e.item.quantity,
                        "returnable_quantity": e.returnable_quantity,
                        "policy": e.policy,
                        "window_days": e.window_days,
                        "eligible": e.eligible,
                        "note": e.reason,
                    }
                    for e in eligibility(order)
                ],
            }
        )


def return_queryset():
    return ReturnRequest.objects.select_related("order").prefetch_related("items__order_item", "photos", "events")


class ReturnsView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(responses=ReturnSerializer(many=True))
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Sign in to see your returns."}, status=status.HTTP_401_UNAUTHORIZED)
        returns = return_queryset().filter(order__user=request.user)
        return Response(ReturnSerializer(returns, many=True).data)

    @extend_schema(request=ReturnInput, responses=ReturnSerializer)
    def post(self, request):
        data = ReturnInput(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        order = get_accessible_order(request, v["order_number"])
        ret = request_return(
            order,
            items=v["items"],
            reason=v["reason"],
            comments=v.get("comments", ""),
            refund_upi_id=v.get("refund_upi_id", ""),
            photos=request.FILES.getlist("photos"),
            user=request.user if request.user.is_authenticated else None,
        )
        return Response(ReturnSerializer(return_queryset().get(pk=ret.pk)).data, status=status.HTTP_201_CREATED)


class ReturnDetailView(APIView):
    @extend_schema(parameters=[OpenApiParameter("token", str)], responses=ReturnSerializer)
    def get(self, request, number):
        ret = get_object_or_404(return_queryset(), number=number)
        get_accessible_order(request, ret.order.number)  # same access rule as the order
        return Response(ReturnSerializer(ret).data)


class OrderReturnsView(APIView):
    @extend_schema(parameters=[OpenApiParameter("token", str)], responses=ReturnSerializer(many=True))
    def get(self, request, number):
        order = get_accessible_order(request, number)
        return Response(ReturnSerializer(return_queryset().filter(order=order), many=True).data)
