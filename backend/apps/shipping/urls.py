from django.urls import path

from . import views

urlpatterns = [path("shipping/estimate/", views.DeliveryEstimateView.as_view(), name="shipping-estimate")]
