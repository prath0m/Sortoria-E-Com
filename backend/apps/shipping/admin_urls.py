from rest_framework.routers import SimpleRouter

from . import admin_api

router = SimpleRouter()
router.register("admin/shipping/methods", admin_api.ShippingMethodViewSet, basename="admin-shipping-method")
router.register("admin/shipping/zones", admin_api.ShippingZoneViewSet, basename="admin-shipping-zone")
router.register("admin/shipping/pincodes", admin_api.PincodeViewSet, basename="admin-pincode")

urlpatterns = router.urls
