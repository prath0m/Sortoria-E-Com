from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core import seo


def health(_request):
    return JsonResponse({"status": "ok"})


api_v1 = [
    path("health/", health, name="health"),
    path("", include("apps.core.urls")),
    path("", include("apps.accounts.urls")),
    path("", include("apps.catalog.urls")),
    path("", include("apps.cart.urls")),
    path("", include("apps.shipping.urls")),
    path("", include("apps.offers.urls")),
    path("", include("apps.orders.urls")),
    path("", include("apps.payments.urls")),
    path("", include("apps.reviews.urls")),
    path("", include("apps.cms.urls")),
    path("", include("apps.analytics.urls")),
    path("", include("apps.catalog.admin_urls")),
    path("", include("apps.orders.admin_urls")),
    path("", include("apps.offers.admin_urls")),
    path("", include("apps.cms.admin_urls")),
    path("", include("apps.shipping.admin_urls")),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger"),
    path("robots.txt", seo.robots_txt, name="robots"),
    path("sitemap.xml", seo.sitemap_xml, name="sitemap"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Everything else is the storefront/admin SPA, served with per-URL meta (production and `make build`).
urlpatterns += [re_path(r"^(?!api/|django-admin/|static/|media/).*$", seo.spa, name="spa")]
