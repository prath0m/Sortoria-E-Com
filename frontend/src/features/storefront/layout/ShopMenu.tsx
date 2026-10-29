import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNavigation, useStoreSettings } from '@/api/hooks/store';
import type { NavNode } from '@/api/types';
import { cn } from '@/lib/cn';
import { useFocusTrap, usePrefersReducedMotion, useScrollLock } from '@/lib/hooks';
import { toSrcSet } from '@/lib/srcset';
import { useAuth } from '@/stores/auth';
import { useUI } from '@/stores/ui';

const ease = [0.76, 0, 0.24, 1] as const;

function Preview({ node }: { node: NavNode | undefined }) {
  const src = node?.menu_image ?? node?.image;
  const set = node?.renditions?.menu_image ?? node?.renditions?.image;
  return (
    <div className="relative hidden aspect-[4/5] w-full overflow-hidden rounded-md bg-white/5 lg:block">
      <AnimatePresence initial={false}>
        {src ? (
          <motion.img
            key={node!.id}
            src={src}
            srcSet={toSrcSet(set)}
            sizes="30vw"
            alt=""
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
      </AnimatePresence>
      {node?.children.length ? (
        <ul className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16">
          {node.children.map((c) => (
            <li key={c.id}>
              <Link
                to={`/shop/${c.slug}`}
                className="inline-flex rounded-full border border-white/30 px-3 py-1.5 text-[0.8125rem] text-white backdrop-blur transition-colors hover:bg-white hover:text-black"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Full-screen department index (desktop and mobile): department names set large, each with a
 * preview image and its subcategories. Replaces the classic mega-menu bar.
 */
export function ShopMenu() {
  const open = useUI((s) => s.mobileNavOpen);
  const setOpen = useUI((s) => s.setMobileNavOpen);
  const { data: categories = [] } = useNavigation();
  const { data: store } = useStoreSettings();
  const user = useAuth((s) => s.user);
  const { pathname } = useLocation();
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useScrollLock(open);
  useFocusTrap(ref, open, close);
  useEffect(() => setOpen(false), [pathname, setOpen]);
  useEffect(() => {
    if (open) setActive(categories[0]?.id ?? null);
  }, [open, categories]);

  const current = categories.find((c) => c.id === active);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label="Shop departments"
          data-lenis-prevent
          initial={reduce ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
          animate={reduce ? { opacity: 1 } : { clipPath: 'inset(0 0 0% 0)' }}
          exit={reduce ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
          transition={{ duration: reduce ? 0.2 : 0.7, ease }}
          className="fixed inset-0 z-modal overflow-y-auto bg-[#0a0a0a] text-white"
        >
          <div className="container-page flex min-h-full flex-col py-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/60">{store?.name ?? 'Sartoria'} — Departments</p>
              <button
                type="button"
                onClick={close}
                data-autofocus
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-4 text-sm transition-colors hover:bg-white hover:text-black"
              >
                Close <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-10 grid flex-1 gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
              <nav aria-label="Departments">
                <ol className="border-t border-white/10">
                  {categories.map((cat, i) => (
                    <motion.li
                      key={cat.id}
                      initial={reduce ? false : { opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease, delay: reduce ? 0 : 0.25 + i * 0.035 }}
                      className="border-b border-white/10"
                      onMouseEnter={() => setActive(cat.id)}
                    >
                      <Link
                        to={`/shop/${cat.slug}`}
                        onFocus={() => setActive(cat.id)}
                        className="group flex items-baseline gap-4 py-3 md:gap-6 md:py-4"
                      >
                        <span className="w-8 shrink-0 text-xs tabular-nums text-white/40">{String(i + 1).padStart(2, '0')}</span>
                        <span
                          className={cn(
                            'text-[clamp(1.75rem,4.2vw,3.75rem)] font-semibold leading-none tracking-[-0.04em] transition-[color,transform] duration-500 ease-luxe',
                            active === cat.id ? 'translate-x-2 text-white' : 'text-white/45',
                          )}
                        >
                          {cat.name}
                        </span>
                        <ArrowUpRight
                          className={cn('ml-auto h-6 w-6 shrink-0 transition-opacity', active === cat.id ? 'opacity-100' : 'opacity-0')}
                          aria-hidden="true"
                        />
                      </Link>
                    </motion.li>
                  ))}
                </ol>
              </nav>
              <Preview node={current} />
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-sm text-white/70">
              <Link to="/offers" className="font-semibold text-white hover:underline">Offers</Link>
              <Link to="/shop?sort=newest" className="hover:text-white">New in</Link>
              <Link to={user ? '/account' : '/login'} className="hover:text-white">{user ? 'Your account' : 'Sign in'}</Link>
              <Link to="/wishlist" className="hover:text-white">Wishlist</Link>
              <Link to="/track-order" className="hover:text-white">Track an order</Link>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
