from django.urls import path

from . import views

urlpatterns = [
    path("payments/razorpay/verify/", views.RazorpayVerifyView.as_view(), name="razorpay-verify"),
    path("payments/razorpay/failed/", views.RazorpayFailureView.as_view(), name="razorpay-failed"),
    path("payments/razorpay/webhook/", views.razorpay_webhook, name="razorpay-webhook"),
]
