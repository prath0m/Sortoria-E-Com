from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import DomainError
from apps.orders.serializers import OrderDetailSerializer
from apps.orders.views import get_accessible_order, order_queryset

from .models import Payment
from .providers import ProviderError, get_provider
from .services import confirm_payment, fail_payment, handle_webhook

VerifyInput = inline_serializer(
    "RazorpayVerify",
    fields={
        "order_number": serializers.CharField(),
        "token": serializers.CharField(required=False),
        "razorpay_order_id": serializers.CharField(),
        "razorpay_payment_id": serializers.CharField(),
        "razorpay_signature": serializers.CharField(),
    },
)


class RazorpayVerifyView(APIView):
    """Called by the browser after Razorpay Checkout succeeds. The signature proves it came from Razorpay."""

    @extend_schema(request=VerifyInput, responses=OrderDetailSerializer)
    def post(self, request):
        order = get_accessible_order(request, request.data.get("order_number", ""))
        payment = get_object_or_404(
            Payment,
            order=order,
            provider="razorpay",
            provider_order_id=request.data.get("razorpay_order_id", ""),
        )
        if not get_provider("razorpay").verify_client_callback(payment, request.data):
            raise DomainError(
                "We couldn't verify this payment. If money was taken, it will be refunded.",
                code="bad_signature",
            )
        confirm_payment(payment, provider_payment_id=request.data["razorpay_payment_id"], raw=dict(request.data))
        return Response(OrderDetailSerializer(order_queryset().get(pk=order.pk)).data)


class RazorpayFailureView(APIView):
    """Called when the shopper's payment attempt fails inside Razorpay Checkout."""

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OrderDetailSerializer)
    def post(self, request):
        order = get_accessible_order(request, request.data.get("order_number", ""))
        payment = order.payments.filter(provider="razorpay").order_by("-created_at").first()
        if payment:
            fail_payment(payment, reason=str(request.data.get("description", "Payment failed"))[:300])
        return Response(OrderDetailSerializer(order_queryset().get(pk=order.pk)).data)


class RazorpayWebhookView(APIView):
    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes: list = []

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: None})
    def post(self, request):
        try:
            event = get_provider("razorpay").parse_webhook(request.body, request.headers)
        except ProviderError:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        handle_webhook("razorpay", event)
        return Response(status=status.HTTP_200_OK)


razorpay_webhook = csrf_exempt(RazorpayWebhookView.as_view())
