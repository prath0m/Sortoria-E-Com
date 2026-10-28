import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type RefObject } from 'react';
import type { Variant } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/lib/money';

/** Mobile-only bar that appears once the main Add to bag button scrolls out of view. */
export function StickyPurchaseBar({
  watch,
  name,
  variant,
  onAdd,
}: {
  watch: RefObject<HTMLElement | null>;
  name: string;
  variant: Variant | undefined;
  onAdd: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = watch.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(node);
    return () => observer.disconnect();
  }, [watch]);

  const inStock = !!variant && variant.stock > 0;
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-0 z-header border-t border-line bg-surface-raised/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-lift backdrop-blur lg:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="text-sm text-ink-soft">
                {variant ? formatMoney(variant.price_paise) : ''}
                {variant?.label ? ` · ${variant.label}` : ''}
              </p>
            </div>
            <Button onClick={onAdd} disabled={!inStock}>
              {inStock ? 'Add to bag' : 'Sold out'}
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
