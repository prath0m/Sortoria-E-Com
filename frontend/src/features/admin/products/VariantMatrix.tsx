import { Trash2, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { AdminVariant, CatalogOptions } from './types';

const rupees = (paise: number | null) => (paise ? String(paise / 100) : '');
const paise = (value: string) => (value.trim() === '' ? null : Math.round(Number(value) * 100));

function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap((combo) => list.map((item) => [...combo, item])), [[]]);
}

/** Pick the attributes a product varies by, tick values, and generate every combination. */
export function VariantMatrix({
  variants,
  onChange,
  options,
  skuBase,
  errors,
}: {
  variants: AdminVariant[];
  onChange: (v: AdminVariant[]) => void;
  options: CatalogOptions;
  skuBase: string;
  errors?: string;
}) {
  const axesAttrs = options.attributes.filter((a) => a.is_variant_axis);
  const valueToAttr = useMemo(() => {
    const map = new Map<number, { attr: number; value: string; hex: string }>();
    options.attributes.forEach((a) => a.values.forEach((v) => map.set(v.id, { attr: a.id, value: v.value, hex: v.hex })));
    return map;
  }, [options]);

  const usedAxes = useMemo(() => {
    const ids = new Set<number>();
    variants.forEach((v) => v.option_values.forEach((o) => ids.add(valueToAttr.get(o)?.attr ?? 0)));
    ids.delete(0);
    return ids;
  }, [variants, valueToAttr]);

  const [axes, setAxes] = useState<Set<number>>(usedAxes);
  const [picked, setPicked] = useState<Record<number, Set<number>>>(() => {
    const init: Record<number, Set<number>> = {};
    variants.forEach((v) =>
      v.option_values.forEach((o) => {
        const attr = valueToAttr.get(o)?.attr;
        if (attr) (init[attr] ??= new Set()).add(o);
      }),
    );
    return init;
  });

  const comboCount = [...axes].reduce((n, a) => n * Math.max(picked[a]?.size ?? 0, 1), 1);

  const generate = () => {
    const chosen = [...axes].filter((a) => picked[a]?.size);
    if (!chosen.length) {
      onChange(variants.length ? [{ ...variants[0], option_values: [] }] : []);
      return;
    }
    const combos = cartesian(chosen.map((a) => [...picked[a]]));
    const key = (ids: number[]) => [...ids].sort((x, y) => x - y).join('-');
    const existing = new Map(variants.map((v) => [key(v.option_values), v]));
    const template = variants[0];
    onChange(
      combos.map((combo, i) => {
        const found = existing.get(key(combo));
        if (found) return found;
        const suffix = combo.map((id) => valueToAttr.get(id)?.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()).join('-');
        return {
          sku: `${skuBase}-${suffix}`.slice(0, 64),
          option_values: combo,
          price_paise: template?.price_paise ?? 0,
          compare_at_paise: template?.compare_at_paise ?? null,
          stock: 0,
          low_stock_threshold: null,
          weight_g: template?.weight_g ?? 500,
          is_active: true,
          position: i,
        };
      }),
    );
  };

  const update = (index: number, patch: Partial<AdminVariant>) => onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  const applyAll = (field: 'price_paise' | 'compare_at_paise', value: number | null) => onChange(variants.map((v) => ({ ...v, [field]: value })));
  const [bulkPrice, setBulkPrice] = useState('');

  const input = 'h-9 w-full rounded-xs border border-line bg-surface px-2 text-sm tabular-nums focus:border-accent focus:outline-none';

  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-line p-4">
        <h3 className="font-sans text-sm font-semibold text-ink">Options</h3>
        <p className="mt-0.5 text-xs text-ink-muted">Choose what this product varies by, tick the values you sell, then generate the combinations. Existing rows are kept.</p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Variant attributes">
          {axesAttrs.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={axes.has(a.id)}
              onClick={() => setAxes((prev) => { const next = new Set(prev); if (next.has(a.id)) next.delete(a.id); else next.add(a.id); return next; })}
              className={cn('rounded-full border px-3 py-1 text-xs', axes.has(a.id) ? 'border-primary bg-primary text-primary-on' : 'border-line text-ink-soft hover:border-line-strong')}
            >
              {a.name}
            </button>
          ))}
        </div>
        {[...axes].map((attrId) => {
          const attr = axesAttrs.find((a) => a.id === attrId);
          if (!attr) return null;
          return (
            <fieldset key={attrId} className="mt-4">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">{attr.name}</legend>
              <div className="flex flex-wrap gap-1.5">
                {attr.values.map((v) => {
                  const on = picked[attrId]?.has(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={!!on}
                      onClick={() => setPicked((prev) => { const set = new Set(prev[attrId]); if (set.has(v.id)) set.delete(v.id); else set.add(v.id); return { ...prev, [attrId]: set }; })}
                      className={cn('inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-1 text-xs', on ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-soft')}
                    >
                      {v.hex ? <span className="h-3 w-3 rounded-full ring-1 ring-ink/20" style={{ background: v.hex }} aria-hidden="true" /> : null}
                      {v.value}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
        <Button size="sm" variant="secondary" className="mt-5" icon={<Wand2 className="h-3.5 w-3.5" />} onClick={generate}>
          Generate {comboCount} {comboCount === 1 ? 'variant' : 'variants'}
        </Button>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <h3 className="font-sans text-sm font-semibold text-ink">{variants.length} {variants.length === 1 ? 'variant' : 'variants'}</h3>
          {variants.length > 1 ? (
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-muted" htmlFor="bulk-price">Set every price to ₹</label>
              <input id="bulk-price" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} inputMode="decimal" className={cn(input, 'w-28')} />
              <Button size="sm" variant="ghost" onClick={() => bulkPrice && applyAll('price_paise', paise(bulkPrice) ?? 0)}>Apply</Button>
            </div>
          ) : null}
        </div>
        {errors ? <p role="alert" className="mb-2 text-sm text-danger">{errors}</p> : null}
        <div className="overflow-x-auto rounded-sm border border-line">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-ink-muted">
                <th className="px-3 py-2">Option</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Price ₹</th>
                <th className="px-3 py-2">MRP ₹</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">Low at</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={v.id ?? `new-${i}`} className={cn('border-b border-line/60 last:border-0', !v.is_active && 'opacity-60')}>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap items-center gap-1">
                      {v.option_values.length
                        ? v.option_values.map((o) => {
                            const meta = valueToAttr.get(o);
                            return (
                              <span key={o} className="inline-flex items-center gap-1 rounded-xs bg-ink/5 px-1.5 py-0.5 text-xs">
                                {meta?.hex ? <span className="h-2.5 w-2.5 rounded-full ring-1 ring-ink/20" style={{ background: meta.hex }} aria-hidden="true" /> : null}
                                {meta?.value}
                              </span>
                            );
                          })
                        : <span className="text-xs text-ink-muted">Single variant</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2"><input aria-label={`SKU for row ${i + 1}`} className={input} value={v.sku} onChange={(e) => update(i, { sku: e.target.value.toUpperCase() })} /></td>
                  <td className="px-3 py-2"><input aria-label={`Price for row ${i + 1}`} inputMode="decimal" className={input} value={rupees(v.price_paise)} onChange={(e) => update(i, { price_paise: paise(e.target.value) ?? 0 })} /></td>
                  <td className="px-3 py-2"><input aria-label={`MRP for row ${i + 1}`} inputMode="decimal" className={input} value={rupees(v.compare_at_paise)} onChange={(e) => update(i, { compare_at_paise: paise(e.target.value) })} /></td>
                  <td className="px-3 py-2"><input aria-label={`Stock for row ${i + 1}`} type="number" min={0} className={cn(input, 'w-20')} value={v.stock} onChange={(e) => update(i, { stock: Math.max(0, Number(e.target.value)) })} /></td>
                  <td className="px-3 py-2"><input aria-label={`Low-stock threshold for row ${i + 1}`} type="number" min={0} placeholder="Default" className={cn(input, 'w-20')} value={v.low_stock_threshold ?? ''} onChange={(e) => update(i, { low_stock_threshold: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                  <td className="px-3 py-2"><input aria-label={`Active row ${i + 1}`} type="checkbox" checked={v.is_active} onChange={(e) => update(i, { is_active: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--primary))]" /></td>
                  <td className="px-3 py-2">
                    <button type="button" aria-label={`Remove row ${i + 1}`} disabled={variants.length === 1} onClick={() => onChange(variants.filter((_, j) => j !== i))} className="text-ink-muted hover:text-danger disabled:opacity-30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-muted">Stock changes here are recorded as manual adjustments. Variants with past orders are hidden rather than deleted.</p>
      </section>
    </div>
  );
}
