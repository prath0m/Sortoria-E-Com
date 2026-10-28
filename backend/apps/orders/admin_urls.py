from rest_framework.routers import SimpleRouter

from apps.reviews.admin_api import AdminReviewViewSet

from . import admin_api

router = SimpleRouter()
router.register("admin/orders", admin_api.AdminOrderViewSet, basename="admin-order")
router.register("admin/returns", admin_api.AdminReturnViewSet, basename="admin-return")
router.register("admin/customers", admin_api.AdminCustomerViewSet, basename="admin-customer")
router.register("admin/reviews", AdminReviewViewSet, basename="admin-review")

urlpatterns = router.urls
