import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, type DependencyList, type RefObject } from 'react';
import { getLenis } from '@/components/motion/SmoothScroll';
import { usePrefersReducedMotion } from '@/lib/hooks';

gsap.registerPlugin(ScrollTrigger);

let lenisLinked = false;

/** Keep ScrollTrigger in step with Lenis smooth scrolling (once per page load). */
function linkLenis() {
  const lenis = getLenis();
  if (lenis && !lenisLinked) {
    lenis.on('scroll', ScrollTrigger.update);
    lenisLinked = true;
  }
}

/** Run a GSAP setup scoped to `scope`; reverted on unmount. Skipped entirely for reduced motion. */
export function useGsap(scope: RefObject<HTMLElement | null>, setup: (ctx: { gsap: typeof gsap; ScrollTrigger: typeof ScrollTrigger }) => void, deps: DependencyList = []) {
  const reduce = usePrefersReducedMotion();
  useEffect(() => {
    if (reduce || !scope.current) return;
    linkLenis();
    const ctx = gsap.context(() => setup({ gsap, ScrollTrigger }), scope);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, ...deps]);
}

export { gsap, ScrollTrigger };
