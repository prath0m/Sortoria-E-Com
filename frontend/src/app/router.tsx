import { lazy, Suspense } from 'react';
import { PageLoader } from '@/components/ui/PageLoader';
import { createBrowserRouter } from 'react-router-dom';
import { StorefrontLayout } from '@/features/storefront/layout/StorefrontLayout';
import { ErrorPage } from '@/features/storefront/pages/ErrorPage';
import { NotFoundPage } from '@/features/storefront/pages/NotFoundPage';

const HomePage = lazy(() => import('@/features/storefront/home/HomePage'));
const CategoryPage = lazy(() => import('@/features/storefront/catalog/CategoryPage'));
const ShopAllPage = lazy(() => import('@/features/storefront/catalog/CategoryPage').then((m) => ({ default: m.ShopAllPage })));
const SearchPage = lazy(() => import('@/features/storefront/catalog/SearchPage'));
const BrandPage = lazy(() => import('@/features/storefront/catalog/BrandPage'));
const ProductPage = lazy(() => import('@/features/storefront/product/ProductPage'));
const CartPage = lazy(() => import('@/features/storefront/cart/CartPage'));
const WishlistPage = lazy(() => import('@/features/storefront/wishlist/WishlistPage'));
const OffersPage = lazy(() => import('@/features/storefront/offers/OffersPage'));
const SalePage = lazy(() => import('@/features/storefront/offers/SalePage'));
const BundlePage = lazy(() => import('@/features/storefront/offers/BundlePage'));
const CheckoutPage = lazy(() => import('@/features/storefront/checkout/CheckoutPage'));
const OrderPage = lazy(() => import('@/features/storefront/orders/OrderPage'));
const TrackOrderPage = lazy(() => import('@/features/storefront/orders/TrackOrderPage'));
const NewReturnPage = lazy(() => import('@/features/storefront/returns/NewReturnPage'));
const ReturnDetailPage = lazy(() => import('@/features/storefront/returns/ReturnDetailPage'));
const OrdersPage = lazy(() => import('@/features/storefront/account/OrdersPage'));
const AccountOrderPage = lazy(() => import('@/features/storefront/account/AccountOrderPage'));
const ReturnsPage = lazy(() => import('@/features/storefront/account/ReturnsPage'));
const CmsPage = lazy(() => import('@/features/storefront/pages/CmsPage'));
const NewsletterActionPage = lazy(() => import('@/features/storefront/pages/NewsletterActionPage'));
const AdminShell = lazy(() => import('@/features/admin/layout/AdminShell'));
const AdminLogin = lazy(() => import('@/features/admin/AdminLogin'));
const DashboardPage = lazy(() => import('@/features/admin/dashboard/DashboardPage'));
const AdminNotFound = lazy(() => import('@/features/admin/AdminNotFound'));
const LoginPage = lazy(() => import('@/features/storefront/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/storefront/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/features/storefront/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/storefront/auth/ResetPasswordPage'));
const AccountLayout = lazy(() => import('@/features/storefront/account/AccountLayout'));
const OverviewPage = lazy(() => import('@/features/storefront/account/OverviewPage'));
const ProfilePage = lazy(() => import('@/features/storefront/account/ProfilePage'));
const AddressesPage = lazy(() => import('@/features/storefront/account/AddressesPage'));

export const router = createBrowserRouter([
  {
    path: 'admin-panel',
    errorElement: <ErrorPage />,
    children: [
      { path: 'login', element: <Suspense fallback={<PageLoader />}><AdminLogin /></Suspense> },
      {
        element: <Suspense fallback={<PageLoader />}><AdminShell /></Suspense>,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: '*', element: <AdminNotFound /> },
        ],
      },
    ],
  },
  {
    element: <StorefrontLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'shop', element: <ShopAllPage /> },
      { path: 'shop/:slug', element: <CategoryPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'brands/:slug', element: <BrandPage /> },
      { path: 'products/:slug', element: <ProductPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'wishlist', element: <WishlistPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'order/:number', element: <OrderPage /> },
      { path: 'track-order', element: <TrackOrderPage /> },
      { path: 'returns/new', element: <NewReturnPage /> },
      { path: 'returns/:number', element: <ReturnDetailPage /> },
      { path: 'offers', element: <OffersPage /> },
      { path: 'offers/sale/:slug', element: <SalePage /> },
      { path: 'offers/bundles/:slug', element: <BundlePage /> },
      { path: 'pages/:slug', element: <CmsPage /> },
      { path: 'newsletter/confirm/:token', element: <NewsletterActionPage action="confirm" /> },
      { path: 'newsletter/unsubscribe/:token', element: <NewsletterActionPage action="unsubscribe" /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password/:uid/:token', element: <ResetPasswordPage /> },
      {
        path: 'account',
        element: <AccountLayout />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'addresses', element: <AddressesPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:number', element: <AccountOrderPage /> },
          { path: 'returns', element: <ReturnsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
