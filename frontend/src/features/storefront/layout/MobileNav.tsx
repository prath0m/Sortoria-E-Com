import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigation, useStoreSettings } from '@/api/hooks/store';
import type { NavNode } from '@/api/types';
import { LeftDrawer } from '@/components/ui/Overlay';
import { useAuth } from '@/stores/auth';
import { useUI } from '@/stores/ui';
import { ease } from '@/design/motion';

export function MobileNav() {
  const open = useUI((s) => s.mobileNavOpen);
  const setOpen = useUI((s) => s.setMobileNavOpen);
  const { data: categories = [] } = useNavigation();
  const { data: store } = useStoreSettings();
  const user = useAuth((s) => s.user);
  const [stack, setStack] = useState<NavNode[]>([]);
  const close = () => {
    setOpen(false);
    setStack([]);
  };
  const level = stack[stack.length - 1];
  const items = level ? level.children : categories;

  return (
    <LeftDrawer open={open} onClose={close} title="Menu" hideTitle>
      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={level?.id ?? 'root'}
            initial={{ x: stack.length ? '30%' : '-30%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: ease.luxe }}
            className="px-5 pb-8"
          >
            {level ? (
              <>
                <button
                  type="button"
                  onClick={() => setStack((s) => s.slice(0, -1))}
                  className="mb-2 flex items-center gap-1 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <Link to={`/shop/${level.slug}`} onClick={close} className="mb-4 block font-display text-display-md">
                  {level.name}
                </Link>
              </>
            ) : (
              <p className="eyebrow mb-3 mt-1">Departments</p>
            )}
            <ul className="divide-y divide-line">
              {level ? (
                <li>
                  <Link to={`/shop/${level.slug}`} onClick={close} className="block py-3.5 font-semibold text-burgundy-800">
                    Shop all
                  </Link>
                </li>
              ) : null}
              {items.map((node) => (
                <li key={node.id}>
                  {node.children.length ? (
                    <button
                      type="button"
                      onClick={() => setStack((s) => [...s, node])}
                      className="flex w-full items-center justify-between py-3.5 text-left text-[0.9375rem]"
                    >
                      {node.name}
                      <ChevronRight className="h-4 w-4 text-ink-muted" />
                    </button>
                  ) : (
                    <Link to={`/shop/${node.slug}`} onClick={close} className="block py-3.5 text-[0.9375rem]">
                      {node.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            {!level ? (
              <div className="mt-8 space-y-3 border-t border-line pt-6 text-sm">
                <Link to={user ? '/account' : '/login'} onClick={close} className="block">
                  {user ? `Hello, ${user.first_name || 'there'}` : 'Sign in or create an account'}
                </Link>
                <Link to="/offers" onClick={close} className="block font-semibold text-burgundy-800">
                  Offers
                </Link>
                <Link to="/wishlist" onClick={close} className="block">
                  Wishlist
                </Link>
                <Link to="/track-order" onClick={close} className="block text-ink-soft">
                  Track an order
                </Link>
                {store?.support_phone ? <p className="text-ink-muted">Need help? {store.support_phone}</p> : null}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </LeftDrawer>
  );
}
