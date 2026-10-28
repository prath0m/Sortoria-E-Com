from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("account/addresses", views.AddressViewSet, basename="address")

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", views.MeView.as_view(), name="auth-me"),
    path("auth/password/forgot/", views.PasswordForgotView.as_view(), name="auth-password-forgot"),
    path("auth/password/reset/", views.PasswordResetView.as_view(), name="auth-password-reset"),
    path("auth/password/change/", views.PasswordChangeView.as_view(), name="auth-password-change"),
    *router.urls,
]
