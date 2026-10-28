from django.urls import path

from . import views

urlpatterns = [
    path("home/", views.HomeView.as_view(), name="home"),
    path("cms/banners/", views.BannersView.as_view(), name="banners"),
    path("pages/", views.PageListView.as_view(), name="pages"),
    path("pages/<slug:slug>/", views.PageDetailView.as_view(), name="page-detail"),
    path("newsletter/subscribe/", views.NewsletterSubscribeView.as_view(), name="newsletter-subscribe"),
    path("newsletter/confirm/", views.NewsletterConfirmView.as_view(), name="newsletter-confirm"),
    path("newsletter/unsubscribe/", views.NewsletterUnsubscribeView.as_view(), name="newsletter-unsubscribe"),
]
