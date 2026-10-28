from django.urls import path

from . import views

urlpatterns = [
    path("checkout/", views.CheckoutView.as_view(), name="checkout"),
    path("checkout/config/", views.CheckoutConfigView.as_view(), name="checkout-config"),
    path("checkout/<str:number>/retry-payment/", views.RetryPaymentView.as_view(), name="checkout-retry"),
    path("orders/<str:number>/", views.OrderDetailView.as_view(), name="order-detail"),
    path("orders/<str:number>/invoice/", views.InvoiceView.as_view(), name="order-invoice"),
]
