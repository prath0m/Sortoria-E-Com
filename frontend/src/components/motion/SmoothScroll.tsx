import Lenis from 'lenis';
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { usePrefersReducedMotion } from '@/lib/hooks';

let lenis: Lenis | null = null;

export function getLenis() {
  return lenis;
}

/** Lenis smooth scrolling for the storefront; disabled for reduced-motion users. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = usePrefersReducedMotion();
  const { pathname } = useLocation();

  useEffect(() => {
    if (reduce) return;
    lenis = new Lenis({ duration: 1.1, smoothWheel: true, easing: (t) => 1 - Math.pow(1 - t, 3.2) });
    let frame = 0;
    const raf = (time: number) => {
      lenis?.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis?.destroy();
      lenis = null;
    };
  }, [reduce]);

  useEffect(() => {
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }, [pathname]);

  return <>{children}</>;
}
