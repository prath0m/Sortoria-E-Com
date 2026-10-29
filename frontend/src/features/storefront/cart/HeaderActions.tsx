import { motion, useAnimationControls } from 'framer-motion';
import { Heart, ShoppingBag } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@/api/hooks/cart';
import { useWishlist } from '@/api/hooks/wishlist';
import { BAG_TARGET_ATTR } from '@/components/motion/FlyToCart';
import { useGuestCart } from '@/stores/cart';

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute right-0.5 top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-charcoal-800 px-1 text-[0.625rem] font-bold leading-none text-paper-50">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function HeaderActions() {
  const { count } = useCart();
  const { ids } = useWishlist();
  const openDrawer = useGuestCart((s) => s.setDrawerOpen);
  const controls = useAnimationControls();

  useEffect(() => {
    const bump = () => controls.start({ scale: [1, 1.25, 0.95, 1], transition: { duration: 0.5, delay: 0.7 } });
    window.addEventListener('sartoria:bag-bump', bump);
    return () => window.removeEventListener('sartoria:bag-bump', bump);
  }, [controls]);

  return (
    <>
      <Link
        to="/wishlist"
        aria-label={`Wishlist${ids.length ? `, ${ids.length} saved` : ''}`}
        title="Wishlist"
        className="relative hidden h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5 sm:inline-flex"
      >
        <Heart className="h-5 w-5" />
        <CountBadge count={ids.length} />
      </Link>
      <motion.button
        type="button"
        animate={controls}
        {...{ [BAG_TARGET_ATTR]: '' }}
        onClick={() => openDrawer(true)}
        aria-label={`Bag${count ? `, ${count} items` : ''}`}
        title="Bag"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5"
      >
        <ShoppingBag className="h-5 w-5" />
        <CountBadge count={count} />
      </motion.button>
    </>
  );
}
