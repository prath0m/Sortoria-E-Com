from django.urls import path

from . import views

urlpatterns = [
    path("offers/flash-sales/", views.FlashSalesView.as_view(), name="flash-sales"),
    path("offers/flash-sales/<slug:slug>/", views.FlashSaleDetailView.as_view(), name="flash-sale-detail"),
    path("offers/deals/", views.DailyDealsView.as_view(), name="daily-deals"),
    path("offers/bundles/", views.BundlesView.as_view(), name="bundles"),
    path("offers/bundles/<slug:slug>/", views.BundleDetailView.as_view(), name="bundle-detail"),
]
