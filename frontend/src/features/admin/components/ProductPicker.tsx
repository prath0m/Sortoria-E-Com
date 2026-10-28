import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/api/client';
import type { Paginated } from '@/api/types';
import { useDebounced } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';

export interface ProductRef {
  id: number;
  name: string;
  min_price_paise: number;
  thumb: string | null;
}

/** Search-as-you-type picker for adding products to sales, bundles and homepage sections. */
export function ProductPicker({ exclude, onPick, label = 'Add a product' }: { exclude: number[]; onPick: (p: ProductRef) => void; label?: string }) {
  const [term, setTerm] = useState('');
  const search = useDebounced(term, 250);
  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'products', 'picker', search],
    queryFn: () => api<Paginated<ProductRef>>('/admin/products/', { query: { search, page_size: 8, status: 'active' } }),
    enabled: search.length >= 2,
  });
  const results = (data?.results ?? []).filter((p) => !exclude.includes(p.id));
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-ink">
        {label}
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setTerm('')}
          placeholder="Type at least two letters of a name or SKU"
          className="mt-1.5 h-11 w-full rounded-xs border border-line bg-surface px-3 text-sm font-normal focus:border-accent focus:outline-none"
        />
      </label>
      {term.trim().length >= 2 && search.length >= 2 ? (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-sm border border-line bg-surface-raised shadow-lift" role="listbox" aria-label="Matching products" aria-busy={isFetching}>
          {results.length === 0 ? <li className="px-3 py-3 text-sm text-ink-muted">{isFetching || search !== term ? 'Searching…' : 'No matching products'}</li> : null}
          {results.map((p) => (
            <li key={p.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onPick(p);
                  setTerm('');
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-ink/5"
              >
                <span className="h-9 w-8 shrink-0 overflow-hidden rounded-xs bg-ink/5">{p.thumb ? <img src={p.thumb} alt="" className="h-full w-full object-cover" /> : null}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                <span className="tabular-nums text-ink-muted">{formatMoney(p.min_price_paise)}</span>
                <Plus className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ProductChip({ product, onRemove, children }: { product: ProductRef; onRemove: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xs border border-line bg-surface p-2">
      <span className="h-10 w-9 shrink-0 overflow-hidden rounded-xs bg-ink/5">{product.thumb ? <img src={product.thumb} alt="" className="h-full w-full object-cover" /> : null}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{product.name}</p>
        <p className="text-xs tabular-nums text-ink-muted">{formatMoney(product.min_price_paise)}</p>
      </div>
      {children}
      <button type="button" onClick={onRemove} aria-label={`Remove ${product.name}`} className="p-1 text-ink-muted hover:text-danger">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
