"""Admin-wide endpoints: notifications and global search."""

from django.db.models import Exists, OuterRef, Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.catalog.models import Product
from apps.orders.models import Order

from .models import AdminNotification
from .permissions import HasCapability, IsStaffMember, has_capability


class NotificationsView(APIView):
    permission_classes = [IsStaffMember]

    def _qs(self, request):
        read = AdminNotification.read_by.through.objects.filter(
            adminnotification_id=OuterRef("pk"), user_id=request.user.pk
        )
        return AdminNotification.objects.annotate(is_read=Exists(read))

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        qs = self._qs(request)
        items = qs[:30]
        return Response(
            {
                "unread": qs.filter(is_read=False).count(),
                "results": [
                    {
                        "id": n.pk,
                        "kind": n.kind,
                        "title": n.title,
                        "link": n.link,
                        "created_at": n.created_at,
                        "read": n.is_read,
                    }
                    for n in items
                ],
            }
        )

    @extend_schema(request=OpenApiTypes.OBJECT, responses={204: None})
    def post(self, request):
        """Mark notifications read: {"ids": [...]} or {"all": true}."""
        qs = self._qs(request).filter(is_read=False)
        if not request.data.get("all"):
            qs = qs.filter(pk__in=[int(i) for i in request.data.get("ids", []) if str(i).isdigit()])
        through = AdminNotification.read_by.through
        through.objects.bulk_create(
            [through(adminnotification_id=n.pk, user_id=request.user.pk) for n in qs], ignore_conflicts=True
        )
        return Response(status=204)


class GlobalSearchView(APIView):
    permission_classes = [HasCapability("dashboard.view")]

    @extend_schema(parameters=[OpenApiParameter("q", str)], responses=OpenApiTypes.OBJECT)
    def get(self, request):
        q = (request.query_params.get("q") or "").strip()[:60]
        if len(q) < 2:
            return Response({"orders": [], "products": [], "customers": []})
        user = request.user
        orders = (
            Order.objects.filter(Q(number__icontains=q) | Q(email__icontains=q) | Q(phone__icontains=q)).order_by(
                "-created_at"
            )[:5]
            if has_capability(user, "orders.view")
            else []
        )
        products = Product.objects.filter(Q(name__icontains=q) | Q(variants__sku__icontains=q)).distinct()[:5]
        customers = (
            User.objects.filter(role=User.Role.CUSTOMER).filter(
                Q(email__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(phone__icontains=q)
            )[:5]
            if has_capability(user, "customers.view")
            else []
        )
        return Response(
            {
                "orders": [
                    {
                        "number": o.number,
                        "email": o.email,
                        "status": o.get_status_display(),
                        "total": o.grand_total_paise,
                    }
                    for o in orders
                ],
                "products": [{"id": p.pk, "name": p.name, "slug": p.slug} for p in products],
                "customers": [{"id": c.pk, "name": c.full_name or c.email, "email": c.email} for c in customers],
            }
        )
