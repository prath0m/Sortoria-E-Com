from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Page, PromoBanner
from .services import banners, confirm, homepage, subscribe, unsubscribe


class HomeView(APIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response({"sections": homepage()})


class BannersView(APIView):
    @extend_schema(
        parameters=[OpenApiParameter("placement", str, enum=PromoBanner.Placement.values)],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request):
        placement = request.query_params.get("placement", PromoBanner.Placement.HOME)
        if placement not in PromoBanner.Placement.values:
            return Response([])
        return Response(banners(placement))


class PageListView(APIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        pages = Page.objects.filter(is_active=True, show_in_footer=True)
        return Response([{"title": p.title, "slug": p.slug} for p in pages])


class PageDetailView(APIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, slug):
        page = get_object_or_404(Page, slug=slug, is_active=True)
        return Response(
            {
                "title": page.title,
                "slug": page.slug,
                "summary": page.summary,
                "body": page.body,
                "seo_title": page.seo_title,
                "seo_description": page.seo_description,
                "updated_at": page.updated_at,
            }
        )


SubscribeInput = inline_serializer(
    "NewsletterSubscribe", fields={"email": serializers.EmailField(), "source": serializers.CharField(required=False)}
)


class NewsletterSubscribeView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "newsletter"

    @extend_schema(request=SubscribeInput, responses={202: None})
    def post(self, request):
        email = serializers.EmailField().run_validation(request.data.get("email"))
        subscribe(email, source=str(request.data.get("source", "")))
        return Response(
            {"detail": "Almost there: please confirm your subscription from the email we've just sent."},
            status=status.HTTP_202_ACCEPTED,
        )


class NewsletterConfirmView(APIView):
    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        sub = confirm(str(request.data.get("token", "")))
        return Response({"email": sub.email, "status": sub.status})


class NewsletterUnsubscribeView(APIView):
    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        sub = unsubscribe(str(request.data.get("token", "")))
        return Response({"email": sub.email, "status": sub.status})
