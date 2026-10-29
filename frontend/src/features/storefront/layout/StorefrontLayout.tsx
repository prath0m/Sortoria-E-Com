import { AnimatePresence } from 'framer-motion';
import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/motion/PageTransition';
import { track } from '@/lib/analytics';
import { SmoothScroll } from '@/components/motion/SmoothScroll';
import { PageLoader } from '@/components/ui/PageLoader';
import { FlyToCartLayer } from '@/components/motion/FlyToCart';
import { MiniCartDrawer } from '@/features/storefront/cart/MiniCartDrawer';
import { QuickView } from '@/features/storefront/catalog/QuickView';
import { AnnouncementBar } from './AnnouncementBar';
import { Footer } from './Footer';
import { Header } from './Header';
import { SearchOverlay } from './SearchOverlay';
import { ShopMenu } from './ShopMenu';
import { cn } from '@/lib/cn';

export function StorefrontLayout() {
  const location = useLocation();
  useEffect(() => {
    if (!location.pathname.startsWith('/products/')) track(location.pathname);
  }, [location.pathname]);
  return (
    <SmoothScroll>
      <a
        href="#main"
        className="sr-only z-toast rounded-xs bg-charcoal-800 px-4 py-2 text-paper-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <Header />
      {/* The homepage hero runs under the floating header; other pages clear it. */}
      <main id="main" tabIndex={-1} className={cn('min-h-[100svh] outline-none', location.pathname !== '/' && 'pt-[4.75rem]')}>
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </PageTransition>
        </AnimatePresence>
      </main>
      <Footer />
      <ShopMenu />
      <SearchOverlay />
      <QuickView />
      <MiniCartDrawer />
      <FlyToCartLayer />
    </SmoothScroll>
  );
}
