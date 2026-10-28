from rest_framework.routers import SimpleRouter

from . import admin_api

router = SimpleRouter()
router.register("admin/coupons", admin_api.AdminCouponViewSet, basename="admin-coupon")
router.register("admin/sales", admin_api.AdminFlashSaleViewSet, basename="admin-sale")
router.register("admin/bundles", admin_api.AdminBundleViewSet, basename="admin-bundle")

urlpatterns = router.urls
