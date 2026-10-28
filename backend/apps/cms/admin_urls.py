from rest_framework.routers import SimpleRouter

from . import admin_api

router = SimpleRouter()
router.register("admin/cms/hero-slides", admin_api.HeroSlideViewSet, basename="admin-hero-slide")
router.register("admin/cms/sections", admin_api.HomeSectionViewSet, basename="admin-home-section")
router.register("admin/cms/banners", admin_api.PromoBannerViewSet, basename="admin-banner")
router.register("admin/cms/trust-badges", admin_api.TrustBadgeViewSet, basename="admin-trust-badge")
router.register("admin/cms/counters", admin_api.CounterViewSet, basename="admin-counter")
router.register("admin/cms/testimonials", admin_api.TestimonialViewSet, basename="admin-testimonial")
router.register("admin/cms/pages", admin_api.PageViewSet, basename="admin-page")
router.register("admin/newsletter", admin_api.SubscriberViewSet, basename="admin-newsletter")

urlpatterns = router.urls
