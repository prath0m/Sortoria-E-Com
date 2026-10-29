import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { NavNode } from '@/api/types';
import { cn } from '@/lib/cn';
import { ease } from '@/design/motion';
import { toSrcSet } from '@/lib/srcset';

/**
 * Desktop department menu. Each department is a link to its category page; the panel opens on
 * hover (with intent delay) or with the Down arrow, listing subcategories beside an editorial image.
 */
export function MegaMenu({ categories }: { categories: NavNode[] }) {
  const [active, setActive] = useState<number | null>(null);
  const closeTimer = useRef<number>();
  const openTimer = useRef<number>();
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => setActive(null), [pathname]);

  // Opened from the keyboard: move focus into the panel once it has rendered.
  const focusPanel = useRef(false);
  useEffect(() => {
    if (active === null || !focusPanel.current) return;
    focusPanel.current = false;
    document.querySelector<HTMLElement>('[data-mega-panel] a')?.focus();
  }, [active]);

  const openSoon = (id: number) => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setActive(id), active === null ? 120 : 0);
  };
  const closeSoon = () => {
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setActive(null), 160);
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const buttons = navRef.current?.querySelectorAll<HTMLAnchorElement>('[data-menu-trigger]');
    if (!buttons) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
      if (active !== null) setActive(categories[next].id);
    } else if (e.key === 'Escape') {
      setActive(null);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusPanel.current = true;
      setActive(categories[index].id);
    }
  };

  const current = categories.find((c) => c.id === active);

  return (
    <nav ref={navRef} aria-label="Departments" className="relative" onMouseLeave={closeSoon}>
      {/* Fixed height so the header doesn't grow when the departments arrive. */}
      <ul className="scrollbar-none container-page flex h-[2.625rem] items-center justify-between gap-1 overflow-x-auto">
        {categories.map((cat, i) => (
          <li key={cat.id} onMouseEnter={() => openSoon(cat.id)}>
            <Link
              to={`/shop/${cat.slug}`}
              data-menu-trigger
              aria-expanded={active === cat.id}
              aria-controls="mega-panel"
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'relative block whitespace-nowrap px-1.5 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-burgundy-800 2xl:px-2.5',
                active === cat.id && 'text-burgundy-800',
              )}
            >
              {cat.name}
              <span
                className={cn(
                  'absolute inset-x-1.5 bottom-1.5 h-px origin-left scale-x-0 bg-gold-400 transition-transform duration-400 ease-luxe 2xl:inset-x-2.5',
                  active === cat.id && 'scale-x-100',
                )}
              />
            </Link>
          </li>
        ))}
        <li>
          <Link
            to="/offers"
            className="relative whitespace-nowrap px-1.5 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-burgundy-700 transition-colors hover:text-burgundy-900 2xl:px-2.5"
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px rotate-45 bg-gold-400" aria-hidden="true" />
            Offers
          </Link>
        </li>
      </ul>
      <AnimatePresence>
        {current ? (
          <motion.div
            key="panel"
            id="mega-panel"
            data-mega-panel
            onMouseEnter={() => window.clearTimeout(closeTimer.current)}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: ease.luxe }}
            className="absolute inset-x-0 top-full z-header border-y border-line bg-surface-raised shadow-lift"
          >
            <motion.div
              key={current.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="container-page grid grid-cols-12 gap-10 py-10"
            >
              <div className="col-span-3">
                <p className="eyebrow mb-2">Department</p>
                <Link
                  to={`/shop/${current.slug}`}
                  className="block w-fit font-display text-display-md text-burgundy-800 hover:text-burgundy-700"
                >
                  {current.name}
                </Link>
                <Link
                  to={`/shop/${current.slug}`}
                  className="link-underline mt-6 inline-block text-xs font-semibold uppercase tracking-[0.14em] text-burgundy-800"
                >
                  Shop all {current.name.toLowerCase()}
                </Link>
                <Link
                  to={`/shop/${current.slug}?sort=newest`}
                  className="link-underline mt-3 block w-fit text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft"
                >
                  New arrivals
                </Link>
              </div>
              <ul className="col-span-5 grid grid-cols-2 content-start gap-x-8 gap-y-3">
                {current.children.map((child) => (
                  <li key={child.id}>
                    <Link to={`/shop/${child.slug}`} className="link-underline text-[0.9375rem] text-ink hover:text-burgundy-800">
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
              {current.menu_image ? (
                <Link to={`/shop/${current.slug}`} className="group col-span-4 block overflow-hidden rounded-sm">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={current.menu_image}
                      srcSet={toSrcSet(current.renditions?.menu_image)}
                      sizes="400px"
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-1200 ease-luxe group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-shade/50 to-transparent" />
                    <span className="absolute bottom-4 left-5 font-display text-2xl italic text-cream-50">
                      Discover {current.name}
                    </span>
                  </div>
                </Link>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
