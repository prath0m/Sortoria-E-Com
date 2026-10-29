import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFacets, useInfiniteProducts, useProducts } from '@/api/hooks/catalog';
import { useStoreSettings } from '@/api/hooks/store';
import type { Facets } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { BottomSheet } from '@/components/ui/Overlay';
import { Pagination } from '@/components/ui/Pagination';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { activeFilterCount, clearFilters, listValues, setValue, toggleValue } from '@/lib/filters';
import { useIsDesktop } from '@/lib/hooks';
import { FilterPanel } from './FilterPanel';
import { ProductGrid } from './ProductGrid';

const SORTS = [
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'discount', label: 'Biggest savings' },
];

interface ListingViewProps {
  /** Fixed params for this page (e.g. category or brand); merged with the URL's own. */
  base: Record<string, string>;
  hideBrands?: boolean;
  aside?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
}

function chipsFor(params: URLSearchParams, facets: Facets | undefined) {
  const chips: { key: string; label: string; next: URLSearchParams }[] = [];
  for (const slug of listValues(params, 'brand')) {
    const name = facets?.brands.find((b) => b.slug === slug)?.name ?? slug;
    chips.push({ key: `brand-${slug}`, label: name, next: toggleValue(params, 'brand', slug) });
  }
  for (const [key] of params) {
    if (!key.startsWith('attr.')) continue;
    const attr = facets?.attributes.find((a) => `attr.${a.slug}` === key);
    for (const slug of listValues(params, key)) {
      const value = attr?.values.find((v) => v.slug === slug)?.value ?? slug;
      chips.push({ key: `${key}-${slug}`, label: value, next: toggleValue(params, key, slug) });
    }
  }
  const min = params.get('price_min');
  const max = params.get('price_max');
  if (min || max) {
    chips.push({
      key: 'price',
      label: min && max ? `₹${min} – ₹${max}` : min ? `From ₹${min}` : `Up to ₹${max}`,
      next: setValue(setValue(params, 'price_min', null), 'price_max', null),
    });
  }
  if (params.get('rating_min')) chips.push({ key: 'rating', label: `${params.get('rating_min')}★ & up`, next: setValue(params, 'rating_min', null) });
  if (params.get('discount_min')) chips.push({ key: 'discount', label: `${params.get('discount_min')}%+ off`, next: setValue(params, 'discount_min', null) });
  if (params.get('in_stock')) chips.push({ key: 'stock', label: 'In stock', next: setValue(params, 'in_stock', null) });
  return chips;
}

export function ListingView({ base, hideBrands, aside, emptyTitle, emptyDescription }: ListingViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const desktop = useIsDesktop();
  const { data: store } = useStoreSettings();
  const [sheetOpen, setSheetOpen] = useState(false);
  const infinite = !desktop && (store?.infinite_scroll_mobile ?? true);
  const view = searchParams.get('view') === 'list' ? 'list' : 'grid';

  const query = useMemo(() => {
    const q = new URLSearchParams(searchParams);
    q.delete('view');
    for (const [k, v] of Object.entries(base)) q.set(k, v);
    return q;
  }, [searchParams, base]);

  const paged = useProducts(query, !infinite);
  const endless = useInfiniteProducts(query, infinite);
  const facets = useFacets(query);

  const update = (next: URLSearchParams) => {
    setSearchParams(next, { preventScrollReset: true });
  };

  const products = infinite ? endless.data?.pages.flatMap((p) => p.results) : paged.data?.results;
  const total = infinite ? endless.data?.pages[0]?.count : paged.data?.count;
  const loading = infinite ? endless.isLoading : paged.isLoading;
  const refreshing = !infinite && paged.isPlaceholderData;
  const filters = activeFilterCount(searchParams);
  const chips = chipsFor(searchParams, facets.data);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!infinite || !sentinel.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && endless.hasNextPage && !endless.isFetchingNextPage) endless.fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [infinite, endless]);

  const panel = <FilterPanel facets={facets.data} params={searchParams} onChange={update} hideBrands={hideBrands} />;

  return (
    <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] xl:gap-14">
      <aside className="hidden lg:block" aria-label="Filters">
        {aside}
        <div className="sticky top-[calc(var(--header-bottom,6rem)+1rem)] max-h-[calc(100vh-var(--header-bottom,6rem)-2rem)] overflow-y-auto pr-2" data-lenis-prevent>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-sans text-xs font-semibold text-ink">Refine</h2>
            {filters ? (
              <button type="button" onClick={() => update(clearFilters(searchParams))} className="text-xs text-charcoal-800 link-underline">
                Clear all
              </button>
            ) : null}
          </div>
          {panel}
        </div>
      </aside>

      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p className="text-sm text-ink-muted" aria-live="polite">
            {total !== undefined ? `${total} ${total === 1 ? 'piece' : 'pieces'}` : ' '}
            {refreshing ? <Spinner className="ml-2 inline h-3.5 w-3.5" /> : null}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="lg:hidden"
              icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              onClick={() => setSheetOpen(true)}
            >
              Filter{filters ? ` (${filters})` : ''}
            </Button>
            <label className="sr-only" htmlFor="sort">
              Sort by
            </label>
            <select
              id="sort"
              value={searchParams.get('sort') ?? (searchParams.get('q') ? 'relevance' : 'popular')}
              onChange={(e) => update(setValue(searchParams, 'sort', e.target.value))}
              className="h-9 rounded-xs border border-line-strong bg-surface-raised px-3 text-sm focus:border-charcoal-800 focus:outline-none"
            >
              {searchParams.get('q') ? <option value="relevance">Best match</option> : null}
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="hidden items-center rounded-xs border border-line-strong sm:flex" role="group" aria-label="Layout">
              {(['grid', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  aria-label={mode === 'grid' ? 'Grid view' : 'List view'}
                  onClick={() => update(setValue(searchParams, 'view', mode === 'grid' ? null : 'list'))}
                  className={cn('inline-flex h-9 w-9 items-center justify-center', view === mode ? 'bg-charcoal-800 text-paper-50' : 'text-ink-soft')}
                >
                  {mode === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {chips.length ? (
          <ul className="mb-6 flex flex-wrap items-center gap-2" aria-label="Active filters">
            {chips.map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  onClick={() => update(chip.next)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-paper-200 px-3 py-1.5 text-xs text-ink transition-colors hover:bg-paper-300"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  {chip.label} <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => update(clearFilters(searchParams))} className="px-2 text-xs font-semibold text-charcoal-800 link-underline">
                Clear all
              </button>
            </li>
          </ul>
        ) : null}

        {loading ? (
          <ProductGridSkeleton />
        ) : products?.length ? (
          <div className={cn('transition-opacity duration-250', refreshing && 'opacity-60')}>
            <ProductGrid products={products} view={desktop || view === 'list' ? view : 'grid'} />
          </div>
        ) : (
          <EmptyState
            illustration="search"
            title={emptyTitle ?? 'Nothing quite fits'}
            description={emptyDescription ?? 'No pieces match these filters. Loosen one or two and we’ll show you more.'}
            action={
              filters ? (
                <Button variant="secondary" onClick={() => update(clearFilters(searchParams))}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}

        {infinite ? (
          <div ref={sentinel} className="flex justify-center py-10">
            {endless.isFetchingNextPage ? <Spinner label="Loading more" /> : null}
          </div>
        ) : paged.data ? (
          <Pagination
            className="mt-14"
            page={paged.data.page}
            totalPages={paged.data.total_pages}
            onChange={(p) => {
              update(setValue(searchParams, 'page', p === 1 ? null : p));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : null}
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Refine"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => update(clearFilters(searchParams))} disabled={!filters}>
              Clear
            </Button>
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              Show {total ?? ''} {total === 1 ? 'piece' : 'pieces'}
            </Button>
          </div>
        }
      >
        <div className="px-5 pb-4">{panel}</div>
      </BottomSheet>
    </div>
  );
}
