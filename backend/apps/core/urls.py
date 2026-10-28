from django.urls import path

from . import admin_views, views

urlpatterns = [
    path("store/settings/", views.StoreSettingsView.as_view(), name="store-settings"),
    path("admin/notifications/", admin_views.NotificationsView.as_view(), name="admin-notifications"),
    path("admin/search/", admin_views.GlobalSearchView.as_view(), name="admin-search"),
]
