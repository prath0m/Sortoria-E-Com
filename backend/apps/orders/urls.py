from django.urls import path

from . import views

urlpatterns = [
    path("checkout/", views.CheckoutView.as_view(), name="checkout"),
    path("checkout/config/", views.CheckoutConfigView.as_view(), name="checkout-config"),
    path("checkout/<str:number>/retry-payment/", views.RetryPaymentView.as_view(), name="checkout-retry"),
    path("orders/", views.OrderListView.as_view(), name="order-list"),
    path("orders/track/", views.TrackOrderView.as_view(), name="order-track"),
    path("orders/<str:number>/", views.OrderDetailView.as_view(), name="order-detail"),
    path("orders/<str:number>/cancel/", views.CancelOrderView.as_view(), name="order-cancel"),
    path("orders/<str:number>/returnable-items/", views.ReturnableItemsView.as_view(), name="order-returnable"),
    path("orders/<str:number>/returns/", views.OrderReturnsView.as_view(), name="order-returns"),
    path("returns/", views.ReturnsView.as_view(), name="returns"),
    path("returns/<str:number>/", views.ReturnDetailView.as_view(), name="return-detail"),
    path("orders/<str:number>/invoice/", views.InvoiceView.as_view(), name="order-invoice"),
]
