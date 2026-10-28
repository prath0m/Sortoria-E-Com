from rest_framework.routers import SimpleRouter

from . import admin_api

router = SimpleRouter()
router.register("admin/products", admin_api.AdminProductViewSet, basename="admin-product")
router.register("admin/product-images", admin_api.AdminImageViewSet, basename="admin-product-image")
router.register("admin/categories", admin_api.AdminCategoryViewSet, basename="admin-category")
router.register("admin/brands", admin_api.AdminBrandViewSet, basename="admin-brand")
router.register("admin/attributes", admin_api.AdminAttributeViewSet, basename="admin-attribute")
router.register("admin/inventory", admin_api.AdminInventoryViewSet, basename="admin-inventory")
router.register("admin/catalog/options", admin_api.CatalogOptionsView, basename="admin-catalog-options")

urlpatterns = router.urls
