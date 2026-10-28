from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.offers.services.flash import effective_price, live_flash_items

from .services import lookup_pincode, shipping_options


class DeliveryEstimateView(APIView):
    """Pincode checker for the product page: serviceability, options, fees and dates."""

    @extend_schema(
        parameters=[OpenApiParameter("pincode", str, required=True), OpenApiParameter("product", str)],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request):
        pincode = (request.query_params.get("pincode") or "").strip()
        if not (len(pincode) == 6 and pincode.isdigit() and pincode[0] != "0"):
            return Response({"detail": "Enter a valid 6-digit pincode."}, status=400)
        serviceable = lookup_pincode(pincode)
        if serviceable is None:
            return Response({"pincode": pincode, "serviceable": False, "options": [], "cod_available": False})
        subtotal, bulky = 0, 0
        slug = request.query_params.get("product")
        if slug:
            product = get_object_or_404(Product.objects.prefetch_related("variants"), slug=slug)
            item = live_flash_items([product.pk]).get(product.pk)
            prices = [effective_price(v.price_paise, item) for v in product.variants.all() if v.is_active]
            subtotal = min(prices) if prices else 0
            bulky = 1 if product.product_type == Product.Type.BULKY else 0
        options = shipping_options(serviceable.zone, subtotal_after_discounts=subtotal, bulky_units=bulky)
        return Response(
            {
                "pincode": pincode,
                "serviceable": True,
                "city": serviceable.city,
                "state": serviceable.state,
                "options": [o.as_dict() for o in options],
                "cod_available": serviceable.zone.cod_available,
            }
        )
