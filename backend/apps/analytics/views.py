import re

from django.db.models import F
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.catalog.models import ProductView
from apps.core.permissions import HasCapability

from .models import PageVisit
from .services import dashboard, parse_range

SESSION_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")


class BeaconView(APIView):
    """Anonymous page-view beacon from the storefront. Never fails loudly."""

    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "beacon"

    @extend_schema(request=OpenApiTypes.OBJECT, responses={204: None})
    def post(self, request):
        session = str(request.data.get("session_id", ""))
        path = str(request.data.get("path", ""))[:300]
        if not SESSION_RE.match(session) or not path.startswith("/") or path.startswith("/admin"):
            return Response(status=status.HTTP_204_NO_CONTENT)
        PageVisit.objects.create(session_id=session, path=path, referrer=str(request.data.get("referrer", ""))[:300])
        product_id = request.data.get("product_id")
        if isinstance(product_id, int) and product_id > 0:
            row, _ = ProductView.objects.get_or_create(product_id=product_id, date=timezone.localdate())
            ProductView.objects.filter(pk=row.pk).update(views=F("views") + 1)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DashboardView(APIView):
    permission_classes = [HasCapability("dashboard.view")]

    @extend_schema(
        parameters=[
            OpenApiParameter("range", str, enum=["today", "7d", "30d", "12m", "custom"]),
            OpenApiParameter("from", str, description="YYYY-MM-DD (custom)"),
            OpenApiParameter("to", str, description="YYYY-MM-DD (custom)"),
        ],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request):
        params = request.query_params
        try:
            r = parse_range(params.get("range"), params.get("from"), params.get("to"))
        except ValueError:
            return Response({"detail": "Dates must be in YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(dashboard(r))
