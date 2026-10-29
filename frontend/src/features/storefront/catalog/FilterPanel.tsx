import { Check, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Facets } from '@/api/types';
import { AccordionItem } from '@/components/ui/Accordion';
import { cn } from '@/lib/cn';
import { listValues, setValue, toggleValue } from '@/lib/filters';

interface FilterPanelProps {
  facets: Facets | undefined;
  params: URLSearchParams;
  onChange: (next: URLSearchParams) => void;
  /** Hide the brand facet on brand pages. */
  hideBrands?: boolean;
}

function CheckRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: React.ReactNode;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        disabled={!count && !checked}
        className="flex w-full items-center gap-3 py-1.5 text-left text-sm text-ink disabled:opacity-40"
      >
        <span
          className={cn(
            'flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-xs border transition-colors',
            checked ? 'border-charcoal-800 bg-charcoal-800 text-paper-50' : 'border-line-strong',
          )}
          aria-hidden="true"
        >
          {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
        <span className="flex-1">{label}</span>
        <span className="text-xs text-ink-muted">{count}</span>
      </button>
    </li>
  );
}

function PriceFilter({ facets, params, onChange }: Required<Pick<FilterPanelProps, 'params' | 'onChange'>> & { facets: Facets }) {
  const [min, setMin] = useState(params.get('price_min') ?? '');
  const [max, setMax] = useState(params.get('price_max') ?? '');
  useEffect(() => {
    setMin(params.get('price_min') ?? '');
    setMax(params.get('price_max') ?? '');
  }, [params]);
  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    onChange(setValue(setValue(params, 'price_min', min.replace(/\D/g, '')), 'price_max', max.replace(/\D/g, '')));
  };
  return (
    <form onSubmit={apply} className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="flex-1">
          <span className="sr-only">Minimum price in rupees</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">₹</span>
            <input
              inputMode="numeric"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              placeholder={String(facets.price.min)}
              className="h-10 w-full rounded-xs border border-line-strong bg-surface-raised pl-7 pr-2 text-sm focus:border-charcoal-800 focus:outline-none"
            />
          </span>
        </label>
        <span className="text-ink-muted" aria-hidden="true">–</span>
        <label className="flex-1">
          <span className="sr-only">Maximum price in rupees</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">₹</span>
            <input
              inputMode="numeric"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              placeholder={String(facets.price.max)}
              className="h-10 w-full rounded-xs border border-line-strong bg-surface-raised pl-7 pr-2 text-sm focus:border-charcoal-800 focus:outline-none"
            />
          </span>
        </label>
      </div>
      <button type="submit" className="text-xs font-semibold text-charcoal-800 link-underline">
        Apply price
      </button>
    </form>
  );
}

export function FilterPanel({ facets, params, onChange, hideBrands }: FilterPanelProps) {
  if (!facets) return null;
  const brands = listValues(params, 'brand');
  return (
    <div className="border-t border-line">
      <AccordionItem title="Price" defaultOpen>
        <PriceFilter facets={facets} params={params} onChange={onChange} />
      </AccordionItem>

      {!hideBrands && facets.brands.length > 1 ? (
        <AccordionItem title="Brand" defaultOpen>
          <ul className="max-h-64 overflow-y-auto pr-1" data-lenis-prevent>
            {facets.brands.map((b) => (
              <CheckRow
                key={b.slug}
                label={b.name}
                count={b.count}
                checked={brands.includes(b.slug)}
                onToggle={() => onChange(toggleValue(params, 'brand', b.slug))}
              />
            ))}
          </ul>
        </AccordionItem>
      ) : null}

      {facets.attributes.map((attr) => {
        const key = `attr.${attr.slug}`;
        const selected = listValues(params, key);
        return (
          <AccordionItem key={attr.slug} title={attr.name} defaultOpen={selected.length > 0 || attr.kind === 'swatch'}>
            {attr.kind === 'swatch' ? (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-x-2 gap-y-3 p-1">
                {attr.values.map((v) => {
                  const checked = selected.includes(v.slug);
                  return (
                    <li key={v.slug}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        aria-label={`${v.value} (${v.count})`}
                        title={`${v.value} (${v.count})`}
                        onClick={() => onChange(toggleValue(params, key, v.slug))}
                        className="flex flex-col items-center gap-1.5 text-[0.6875rem] text-ink-soft"
                      >
                        <span
                          className={cn(
                            'h-8 w-8 rounded-full ring-1 ring-ink/15 ring-offset-2 ring-offset-surface transition-shadow',
                            checked && 'ring-2 ring-charcoal-800',
                          )}
                          style={{ backgroundColor: v.hex }}
                        />
                        <span className="w-full truncate text-center">{v.value}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul>
                {attr.values.map((v) => (
                  <CheckRow
                    key={v.slug}
                    label={v.value}
                    count={v.count}
                    checked={selected.includes(v.slug)}
                    onToggle={() => onChange(toggleValue(params, key, v.slug))}
                  />
                ))}
              </ul>
            )}
          </AccordionItem>
        );
      })}

      <AccordionItem title="Customer rating">
        <ul>
          {facets.ratings.map((r) => (
            <CheckRow
              key={r.min}
              label={
                <span className="inline-flex items-center gap-1">
                  {r.min}
                  <Star className="h-3.5 w-3.5 text-iris-500" fill="currentColor" strokeWidth={0} aria-hidden="true" /> &amp; above
                </span>
              }
              count={r.count}
              checked={r.selected}
              onToggle={() => onChange(setValue(params, 'rating_min', r.selected ? null : r.min))}
            />
          ))}
        </ul>
      </AccordionItem>

      <AccordionItem title="Discount">
        <ul>
          {facets.discounts.map((d) => (
            <CheckRow
              key={d.min}
              label={`${d.min}% off or more`}
              count={d.count}
              checked={d.selected}
              onToggle={() => onChange(setValue(params, 'discount_min', d.selected ? null : d.min))}
            />
          ))}
        </ul>
      </AccordionItem>

      <AccordionItem title="Availability">
        <ul>
          <CheckRow
            label="In stock only"
            count={facets.availability.in_stock}
            checked={facets.availability.selected}
            onToggle={() => onChange(setValue(params, 'in_stock', facets.availability.selected ? null : 1))}
          />
        </ul>
      </AccordionItem>
    </div>
  );
}
