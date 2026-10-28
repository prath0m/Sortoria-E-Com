import { lazy } from 'react';
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
    element: <StorefrontLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'shop', element: <ShopAllPage /> },
      { path: 'shop/:slug', element: <CategoryPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'brands/:slug', element: <BrandPage /> },
      { path: 'products/:slug', element: <ProductPage /> },
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
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
