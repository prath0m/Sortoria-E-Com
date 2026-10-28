import { AnimatePresence } from 'framer-motion';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/motion/PageTransition';
import { SmoothScroll } from '@/components/motion/SmoothScroll';
import { PageLoader } from '@/components/ui/PageLoader';
import { QuickView } from '@/features/storefront/catalog/QuickView';
import { AnnouncementBar } from './AnnouncementBar';
import { Footer } from './Footer';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { SearchOverlay } from './SearchOverlay';

export function StorefrontLayout() {
  const location = useLocation();
  return (
    <SmoothScroll>
      <a
        href="#main"
        className="sr-only z-toast rounded-xs bg-burgundy-800 px-4 py-2 text-cream-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <Header />
      <main id="main" tabIndex={-1} className="min-h-[60vh] outline-none">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </PageTransition>
        </AnimatePresence>
      </main>
      <Footer />
      <MobileNav />
      <SearchOverlay />
      <QuickView />
    </SmoothScroll>
  );
}
