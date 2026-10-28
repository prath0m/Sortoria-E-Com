from django.urls import path

from . import views

urlpatterns = [
    path("cart/", views.CartView.as_view(), name="cart"),
    path("cart/items/", views.CartItemsView.as_view(), name="cart-items"),
    path("cart/items/<int:pk>/", views.CartItemView.as_view(), name="cart-item"),
    path(
        "cart/items/<int:pk>/save-for-later/",
        views.CartItemSaveView.as_view(saved=True),
        name="cart-item-save",
    ),
    path(
        "cart/items/<int:pk>/move-to-cart/",
        views.CartItemSaveView.as_view(saved=False),
        name="cart-item-restore",
    ),
    path("cart/coupon/", views.CartCouponView.as_view(), name="cart-coupon"),
    path("cart/merge/", views.CartMergeView.as_view(), name="cart-merge"),
    path("cart/quote/", views.GuestQuoteView.as_view(), name="cart-quote"),
    path("wishlist/", views.WishlistView.as_view(), name="wishlist"),
    path("wishlist/merge/", views.WishlistMergeView.as_view(), name="wishlist-merge"),
    path("wishlist/<int:product_id>/", views.WishlistItemView.as_view(), name="wishlist-item"),
]
