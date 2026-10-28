from django.db.models import Count
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.services.listing import visible_products
from apps.core.pagination import StandardPagination

from .models import Review
from .serializers import ReviewInput, ReviewSerializer
from .services import is_verified_buyer, submit_review

SORTS = {"newest": ("-created_at",), "highest": ("-rating", "-created_at"), "lowest": ("rating", "-created_at")}


class ReviewPagination(StandardPagination):
    page_size = 6


class ProductReviewsView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        return [permissions.IsAuthenticated()] if self.request.method == "POST" else []

    @extend_schema(
        parameters=[OpenApiParameter("sort", str, enum=list(SORTS)), OpenApiParameter("rating", int)],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request, slug):
        product = get_object_or_404(visible_products(), slug=slug)
        approved = Review.objects.filter(product=product, status=Review.Status.APPROVED)
        distribution = {r: 0 for r in range(1, 6)}
        for row in approved.values("rating").annotate(n=Count("id")):
            distribution[row["rating"]] = row["n"]
        qs = approved.select_related("user").prefetch_related("photos")
        if request.query_params.get("rating", "").isdigit():
            qs = qs.filter(rating=int(request.query_params["rating"]))
        qs = qs.order_by(*SORTS.get(request.query_params.get("sort"), SORTS["newest"]))
        paginator = ReviewPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        response = paginator.get_paginated_response(ReviewSerializer(page, many=True).data)
        response.data["summary"] = {
            "average": float(product.rating_avg),
            "count": product.rating_count,
            "distribution": distribution,
        }
        mine = None
        if request.user.is_authenticated:
            own = Review.objects.filter(product=product, user=request.user).first()
            mine = {
                "status": own.status if own else None,
                "verified_buyer": is_verified_buyer(request.user, product),
            }
        response.data["viewer"] = mine
        return response

    @extend_schema(request=ReviewInput, responses=ReviewSerializer)
    def post(self, request, slug):
        product = get_object_or_404(visible_products(), slug=slug)
        data = ReviewInput(data=request.data)
        data.is_valid(raise_exception=True)
        review = submit_review(request.user, product, photos=request.FILES.getlist("photos"), **data.validated_data)
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)
