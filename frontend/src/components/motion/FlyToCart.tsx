import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Flight {
  id: number;
  image?: string;
  from: DOMRect;
  to: DOMRect;
}

export const BAG_TARGET_ATTR = 'data-bag-target';

/** Dispatch from anywhere to fly a thumbnail from `from` into the bag icon. */
export function flyToBag(from: Element | null, image?: string) {
  window.dispatchEvent(new CustomEvent('sartoria:added-to-bag', { detail: { from, image } }));
}

export function FlyToCartLayer() {
  const reduce = useReducedMotion();
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    const onAdd = (e: Event) => {
      const { from, image } = (e as CustomEvent<{ from: Element | null; image?: string }>).detail;
      const target = Array.from(document.querySelectorAll(`[${BAG_TARGET_ATTR}]`)).find(
        (el) => (el as HTMLElement).offsetParent !== null,
      );
      window.dispatchEvent(new CustomEvent('sartoria:bag-bump'));
      if (reduce || !from || !target) return;
      setFlights((f) => [
        ...f,
        { id: Date.now() + Math.random(), image, from: from.getBoundingClientRect(), to: target.getBoundingClientRect() },
      ]);
    };
    window.addEventListener('sartoria:added-to-bag', onAdd);
    return () => window.removeEventListener('sartoria:added-to-bag', onAdd);
  }, [reduce]);

  return createPortal(
    <AnimatePresence>
      {flights.map((f) => {
        const size = 56;
        const startX = f.from.left + f.from.width / 2 - size / 2;
        const startY = f.from.top + f.from.height / 2 - size / 2;
        const endX = f.to.left + f.to.width / 2 - size / 2;
        const endY = f.to.top + f.to.height / 2 - size / 2;
        return (
          <motion.div
            key={f.id}
            aria-hidden="true"
            className="pointer-events-none fixed left-0 top-0 z-toast h-14 w-14 overflow-hidden rounded-full border-2 border-gold-300 bg-cream-200 shadow-lift"
            initial={{ x: startX, y: startY, scale: 1, opacity: 1 }}
            animate={{
              x: [startX, (startX + endX) / 2, endX],
              y: [startY, Math.min(startY, endY) - 120, endY],
              scale: [1, 0.9, 0.3],
              opacity: [1, 1, 0.6],
            }}
            transition={{ duration: 0.85, ease: [0.65, 0, 0.35, 1], times: [0, 0.45, 1] }}
            onAnimationComplete={() => setFlights((all) => all.filter((x) => x.id !== f.id))}
          >
            {f.image ? <img src={f.image} alt="" className="h-full w-full object-cover" /> : null}
          </motion.div>
        );
      })}
    </AnimatePresence>,
    document.body,
  );
}
