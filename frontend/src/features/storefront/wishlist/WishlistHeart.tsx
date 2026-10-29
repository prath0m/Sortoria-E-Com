import { AnimatePresence, motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/api/hooks/wishlist';
import { cn } from '@/lib/cn';

/** Animated heart: fills with a pop and a burst of gold particles when saved. */
export function WishlistHeart({ productId, name, className, size = 'md' }: { productId: number; name: string; className?: string; size?: 'md' | 'lg' }) {
  const { has, toggle } = useWishlist();
  const saved = has(productId);
  const dim = size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate(productId);
      }}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full bg-surface-raised/90 text-ink shadow-soft backdrop-blur transition-colors hover:text-charcoal-800',
        dim,
        className,
      )}
    >
      <motion.span
        key={saved ? 'on' : 'off'}
        initial={{ scale: saved ? 0.4 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 14 }}
        className="inline-flex"
      >
        <Heart
          className={cn(size === 'lg' ? 'h-5 w-5' : 'h-4 w-4', saved && 'text-charcoal-800')}
          fill={saved ? 'currentColor' : 'none'}
          strokeWidth={1.8}
        />
      </motion.span>
      <AnimatePresence>
        {saved ? (
          <motion.span key="burst" className="pointer-events-none absolute inset-0" initial="hidden" animate="show" exit="hidden">
            {Array.from({ length: 6 }, (_, i) => {
              const angle = (i / 6) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-iris-400"
                  variants={{
                    hidden: { x: 0, y: 0, opacity: 0 },
                    show: {
                      x: Math.cos(angle) * 18,
                      y: Math.sin(angle) * 18,
                      opacity: [0, 1, 0],
                      transition: { duration: 0.6, ease: 'easeOut' },
                    },
                  }}
                />
              );
            })}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}
