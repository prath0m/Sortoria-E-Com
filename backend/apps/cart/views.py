from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.catalog.views import card_queryset, serialize_cards
from apps.offers.models import Coupon

from .models import CartItem, WishlistItem
from .serializers import (
    CartItemInput,
    CartItemUpdate,
    CartMergeInput,
    CouponInput,
    GuestQuoteInput,
    WishlistInput,
    WishlistMergeInput,
    serialize_line,
    serialize_quote,
)
from .services.cart import (
    add_item,
    get_cart,
    merge_guest_cart,
    merge_wishlist,
    quote_for_cart,
    saved_quote,
    update_quantity,
)
from .services.pricing import price_cart

QUOTE_PARAMS = [
    OpenApiParameter("pincode", str),
    OpenApiParameter("shipping_method", str),
    OpenApiParameter("payment_method", str),
]


def cart_payload(request, cart):
    params = request.query_params
    quote = quote_for_cart(
        cart,
        pincode=params.get("pincode") or None,
        shipping_method=params.get("shipping_method") or None,
        payment_method=params.get("payment_method") or None,
    )
    saved = saved_quote(cart)
    return {**serialize_quote(quote), "saved_for_later": [serialize_line(line) for line in saved.lines]}


class CartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(parameters=QUOTE_PARAMS, responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(cart_payload(request, get_cart(request.user)))


class CartItemsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=CartItemInput, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        data = CartItemInput(data=request.data)
        data.is_valid(raise_exception=True)
        cart = get_cart(request.user)
        add_item(cart, data.validated_data["variant_id"], data.validated_data["quantity"])
        return Response(cart_payload(request, cart), status=status.HTTP_201_CREATED)


class CartItemView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _item(self, request, pk):
        return get_object_or_404(CartItem.objects.select_related("variant"), pk=pk, cart__user=request.user)

    @extend_schema(request=CartItemUpdate, responses=OpenApiTypes.OBJECT)
    def patch(self, request, pk):
        data = CartItemUpdate(data=request.data)
        data.is_valid(raise_exception=True)
        update_quantity(self._item(request, pk), data.validated_data["quantity"])
        return Response(cart_payload(request, get_cart(request.user)))

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def delete(self, request, pk):
        self._item(request, pk).delete()
        return Response(cart_payload(request, get_cart(request.user)))


class CartItemSaveView(APIView):
    """POST /cart/items/<id>/save-for-later/ and /move-to-cart/."""

    permission_classes = [permissions.IsAuthenticated]
    saved = True

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    def post(self, request, pk):
        item = get_object_or_404(CartItem, pk=pk, cart__user=request.user)
        item.saved_for_later = self.saved
        item.save(update_fields=["saved_for_later"])
        return Response(cart_payload(request, get_cart(request.user)))


class CartCouponView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=CouponInput, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        data = CouponInput(data=request.data)
        data.is_valid(raise_exception=True)
        cart = get_cart(request.user)
        code = data.validated_data["code"].strip().upper()
        cart.coupon = Coupon.objects.filter(code=code).first()
        payload = cart_payload(request, cart) if cart.coupon else None
        if cart.coupon is None or not payload["coupon"]["applied"]:
            message = payload["coupon"]["message"] if payload else f"We don't recognise the code {code}."
            return Response({"detail": message, "code": "coupon_invalid"}, status=status.HTTP_400_BAD_REQUEST)
        cart.save(update_fields=["coupon"])
        return Response(payload)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def delete(self, request):
        cart = get_cart(request.user)
        cart.coupon = None
        cart.save(update_fields=["coupon"])
        return Response(cart_payload(request, cart))


class CartMergeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=CartMergeInput, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        data = CartMergeInput(data=request.data)
        data.is_valid(raise_exception=True)
        cart = get_cart(request.user)
        merge_guest_cart(cart, data.validated_data["lines"])
        return Response(cart_payload(request, cart))


class GuestQuoteView(APIView):
    """Totals for a guest bag held in the browser. Nothing is stored."""

    @extend_schema(request=GuestQuoteInput, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        data = GuestQuoteInput(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        quote = price_cart(
            [(line["variant_id"], line["quantity"]) for line in v["lines"]],
            user=request.user if request.user.is_authenticated else None,
            email=v.get("email") or None,
            coupon_code=v.get("coupon_code") or None,
            pincode=v.get("pincode") or None,
            shipping_method=v.get("shipping_method") or None,
            payment_method=v.get("payment_method") or None,
        )
        return Response(serialize_quote(quote))


def wishlist_payload(request):
    ids = list(WishlistItem.objects.filter(user=request.user).values_list("product_id", flat=True))
    products = {p.pk: p for p in card_queryset(Product.objects.filter(pk__in=ids, is_active=True))}
    return {
        "product_ids": ids,
        "products": serialize_cards([products[i] for i in ids if i in products], request),
    }


class WishlistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(wishlist_payload(request))

    @extend_schema(request=WishlistInput, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        data = WishlistInput(data=request.data)
        data.is_valid(raise_exception=True)
        product = get_object_or_404(Product, pk=data.validated_data["product_id"], is_active=True)
        WishlistItem.objects.get_or_create(user=request.user, product=product)
        return Response(wishlist_payload(request), status=status.HTTP_201_CREATED)


class WishlistItemView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def delete(self, request, product_id):
        WishlistItem.objects.filter(user=request.user, product_id=product_id).delete()
        return Response(wishlist_payload(request))


class WishlistMergeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=WishlistMergeInput, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        data = WishlistMergeInput(data=request.data)
        data.is_valid(raise_exception=True)
        merge_wishlist(request.user, data.validated_data["product_ids"])
        return Response(wishlist_payload(request))
