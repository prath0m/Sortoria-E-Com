from django.urls import path

from . import views

urlpatterns = [
    path("store/settings/", views.StoreSettingsView.as_view(), name="store-settings"),
]
