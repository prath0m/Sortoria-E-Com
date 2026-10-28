from django.urls import path
from rest_framework.routers import SimpleRouter

from . import admin_api, admin_views, views

router = SimpleRouter()
router.register("admin/staff", admin_api.StaffViewSet, basename="admin-staff")
router.register("admin/audit-log", admin_api.AuditLogViewSet, basename="admin-audit")
router.register("admin/imports", admin_api.ImportJobViewSet, basename="admin-import")

urlpatterns = [
    path("store/settings/", views.StoreSettingsView.as_view(), name="store-settings"),
    path("admin/notifications/", admin_views.NotificationsView.as_view(), name="admin-notifications"),
    path("admin/search/", admin_views.GlobalSearchView.as_view(), name="admin-search"),
    path("admin/settings/", admin_api.AdminSettingsView.as_view(), name="admin-settings"),
    path("admin/export/<slug:kind>/", admin_api.ExportView.as_view(), name="admin-export"),
    *router.urls,
]
