from django.urls import path

from . import views

urlpatterns = [
    path("analytics/events/", views.BeaconView.as_view(), name="analytics-beacon"),
    path("admin/analytics/dashboard/", views.DashboardView.as_view(), name="admin-dashboard"),
]
