from django.urls import path

from . import views

urlpatterns = [
    path("store/navigation/", views.NavigationView.as_view(), name="navigation"),
    path("categories/", views.CategoryTreeView.as_view(), name="category-tree"),
    path("categories/<slug:slug>/", views.CategoryDetailView.as_view(), name="category-detail"),
    path("brands/", views.BrandListView.as_view(), name="brand-list"),
    path("brands/<slug:slug>/", views.BrandDetailView.as_view(), name="brand-detail"),
    path("products/", views.ProductListView.as_view(), name="product-list"),
    path("products/facets/", views.ProductFacetsView.as_view(), name="product-facets"),
    path("products/batch/", views.ProductBatchView.as_view(), name="product-batch"),
    path("products/<slug:slug>/", views.ProductDetailView.as_view(), name="product-detail"),
    path("products/<slug:slug>/related/", views.RelatedProductsView.as_view(), name="product-related"),
    path("search/suggest/", views.SearchSuggestView.as_view(), name="search-suggest"),
]
