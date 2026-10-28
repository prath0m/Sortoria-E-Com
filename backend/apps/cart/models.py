from django.conf import settings
from django.db import models

from apps.catalog.models import Product, ProductVariant
from apps.offers.models import Coupon


class Cart(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cart")
    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart of {self.user}"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="+")
    quantity = models.PositiveIntegerField(default=1)
    saved_for_later = models.BooleanField(default=False)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("added_at", "id")
        constraints = [models.UniqueConstraint(fields=("cart", "variant"), name="uniq_cart_variant")]

    def __str__(self):
        return f"{self.quantity} × {self.variant_id}"


class WishlistItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wishlist")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="+")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-added_at",)
        constraints = [models.UniqueConstraint(fields=("user", "product"), name="uniq_wishlist_product")]

    def __str__(self):
        return f"{self.user_id} ♥ {self.product_id}"
