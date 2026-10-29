import { Check } from 'lucide-react';
import type { Axis, Variant } from '@/api/types';
import { cn } from '@/lib/cn';
import { selectValue, valueState, type Selection } from './variants';

interface VariantSelectorProps {
  axes: Axis[];
  variants: Variant[];
  selection: Selection;
  onChange: (selection: Selection) => void;
}

export function VariantSelector({ axes, variants, selection, onChange }: VariantSelectorProps) {
  return (
    <div className="space-y-6">
      {axes.map((axis) => {
        const chosen = axis.values.find((v) => v.slug === selection[axis.slug]);
        return (
          <fieldset key={axis.slug}>
            <legend className="mb-3 flex items-baseline gap-2 text-sm">
              <span className="font-semibold uppercase tracking-[0.12em] text-ink">{axis.name}</span>
              {chosen ? <span className="text-ink-soft">{chosen.value}</span> : null}
            </legend>
            <div role="radiogroup" aria-label={axis.name} className="flex flex-wrap gap-2.5">
              {axis.values.map((value) => {
                const state = valueState(variants, axes, selection, axis.slug, value.slug);
                const selected = selection[axis.slug] === value.slug;
                const label = `${value.value}${state === 'out_of_stock' ? ' (sold out)' : ''}`;
                const select = () => onChange(selectValue(variants, axes, selection, axis.slug, value.slug));
                if (axis.kind === 'swatch') {
                  return (
                    <button
                      key={value.slug}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={label}
                      title={label}
                      onClick={select}
                      className={cn(
                        'relative h-10 w-10 rounded-full p-1 ring-1 ring-line-strong transition-shadow duration-250',
                        selected && 'ring-2 ring-burgundy-800',
                        state !== 'available' && 'opacity-50',
                      )}
                    >
                      <span className="block h-full w-full rounded-full ring-1 ring-ink/10" style={{ backgroundColor: value.hex || '#ccc' }} />
                      {selected ? (
                        <Check className="absolute inset-0 m-auto h-4 w-4 text-white mix-blend-difference" aria-hidden="true" />
                      ) : null}
                      {state === 'out_of_stock' ? (
                        <span className="absolute left-1/2 top-1/2 h-px w-9 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-shade/60" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                }
                return (
                  <button
                    key={value.slug}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    onClick={select}
                    className={cn(
                      'min-w-[3.25rem] rounded-xs border px-4 py-2.5 text-sm transition-colors duration-250',
                      selected ? 'border-burgundy-800 bg-burgundy-800 text-cream-50' : 'border-line-strong text-ink hover:border-burgundy-800',
                      state === 'out_of_stock' && !selected && 'text-ink-muted line-through decoration-ink-muted/60',
                      state === 'unavailable' && !selected && 'border-dashed text-ink-muted',
                    )}
                  >
                    {value.value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
