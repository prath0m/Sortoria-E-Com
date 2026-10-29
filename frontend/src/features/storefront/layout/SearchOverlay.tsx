import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useSuggestions } from '@/api/hooks/catalog';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { useDebounced, useFocusTrap, useScrollLock } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';
import { useUI } from '@/stores/ui';
import { ease } from '@/design/motion';

const POPULAR = ['Headphones', 'Linen', 'Sneakers', 'Cast iron', 'Yoga mat', 'Gold hoops'];

interface Option {
  id: string;
  label: string;
  href: string;
}

export function SearchOverlay() {
  const open = useUI((s) => s.searchOpen);
  const setOpen = useUI((s) => s.setSearchOpen);
  return createPortal(
    <AnimatePresence>{open ? <SearchPanel onClose={() => setOpen(false)} /> : null}</AnimatePresence>,
    document.body,
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounced = useDebounced(q, 200);
  const { data, isFetching } = useSuggestions(debounced);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  useFocusTrap(panelRef, true, onClose);
  useScrollLock(true);

  const options: Option[] = useMemo(() => {
    if (!data || debounced.trim().length < 2) return [];
    return [
      ...data.products.map((p) => ({ id: `p-${p.id}`, label: p.name, href: `/products/${p.slug}` })),
      ...data.categories.map((c) => ({ id: `c-${c.slug}`, label: c.name, href: `/shop/${c.slug}` })),
      ...data.brands.map((b) => ({ id: `b-${b.slug}`, label: b.name, href: `/brands/${b.slug}` })),
    ];
  }, [data, debounced]);

  useEffect(() => setActiveIndex(-1), [debounced]);

  const go = (href: string) => {
    onClose();
    navigate(href);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && options[activeIndex]) return go(options[activeIndex].href);
    if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!options.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
    }
  };

  const optionProps = (index: number) => ({
    id: `${listId}-${index}`,
    role: 'option' as const,
    'aria-selected': activeIndex === index,
    onMouseEnter: () => setActiveIndex(index),
    onClick: () => go(options[index].href),
  });

  const hasQuery = debounced.trim().length >= 2;
  const empty = hasQuery && data && !isFetching && options.length === 0;
  const productCount = data?.products.length ?? 0;
  const categoryCount = data?.categories.length ?? 0;

  return (
    <div className="fixed inset-0 z-modal">
      <motion.div
        className="absolute inset-0 bg-shade/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        data-lenis-prevent
        initial={{ y: '-100%' }}
        animate={{ y: 0 }}
        exit={{ y: '-100%' }}
        transition={{ duration: 0.5, ease: ease.luxe }}
        className="relative max-h-[88vh] overflow-y-auto bg-surface-raised shadow-lift"
      >
        <div className="container-page py-6 md:py-10">
          <form onSubmit={submit} role="search" className="flex items-center gap-3 border-b border-burgundy-800/40 pb-3">
            <Search className="h-6 w-6 shrink-0 text-burgundy-800" aria-hidden="true" />
            <input
              data-autofocus
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search products, brands and departments"
              aria-label="Search Sartoria"
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
              className="min-w-0 flex-1 bg-transparent font-display text-2xl text-ink placeholder:text-ink-muted/60 focus:outline-none md:text-4xl"
              autoComplete="off"
              enterKeyHint="search"
            />
            {isFetching ? <Spinner className="h-5 w-5 text-ink-muted" label="Searching" /> : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5"
            >
              <X className="h-5 w-5" />
            </button>
          </form>

          <div id={listId} role="listbox" aria-label="Suggestions" className="mt-8">
            {!hasQuery ? (
              <div>
                <p className="eyebrow mb-4">Popular right now</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => go(`/search?q=${encodeURIComponent(term)}`)}
                      className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-burgundy-800 hover:text-burgundy-800"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            ) : empty ? (
              <p className="py-6 text-ink-soft">
                Nothing matches “{debounced}” just yet. Try a broader word, or browse a department.
              </p>
            ) : (
              <div className="grid gap-10 md:grid-cols-[1fr_16rem]">
                <div>
                  {productCount ? <p className="eyebrow mb-4">Products</p> : null}
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {data?.products.map((p, i) => (
                      <li
                        key={p.id}
                        {...optionProps(i)}
                        className={cn(
                          'flex cursor-pointer items-center gap-4 rounded-sm p-2 transition-colors',
                          activeIndex === i && 'bg-cream-200',
                        )}
                      >
                        <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xs bg-cream-200">
                          {p.images[0] ? (
                            <ResponsiveImage
                              src={p.images[0].url}
                              renditions={p.images[0].renditions}
                              alt=""
                              sizes="64px"
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-ink-muted">{p.brand}</p>
                          <p className="truncate font-medium text-ink">{p.name}</p>
                          <p className="text-sm text-ink-soft">{formatMoney(p.price_paise)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {q.trim() ? (
                    <button
                      type="button"
                      onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)}
                      className="link-underline mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-burgundy-800"
                    >
                      See all results for “{q.trim()}” <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="space-y-8">
                  {categoryCount ? (
                    <div>
                      <p className="eyebrow mb-3">Departments</p>
                      <ul className="space-y-1">
                        {data?.categories.map((c, i) => {
                          const index = productCount + i;
                          return (
                            <li
                              key={c.slug}
                              {...optionProps(index)}
                              className={cn('cursor-pointer rounded-xs px-2 py-1.5', activeIndex === index && 'bg-cream-200')}
                            >
                              {c.name}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                  {data?.brands.length ? (
                    <div>
                      <p className="eyebrow mb-3">Brands</p>
                      <ul className="space-y-1">
                        {data.brands.map((b, i) => {
                          const index = productCount + categoryCount + i;
                          return (
                            <li
                              key={b.slug}
                              {...optionProps(index)}
                              className={cn('cursor-pointer rounded-xs px-2 py-1.5', activeIndex === index && 'bg-cream-200')}
                            >
                              {b.name}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
