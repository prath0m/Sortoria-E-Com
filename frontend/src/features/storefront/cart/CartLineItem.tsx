import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { QuoteLine } from '@/api/types';
import { useCart } from '@/api/hooks/cart';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';

export function CartLineItem({ line, compact, saved, onNavigate }: { line: QuoteLine; compact?: boolean; saved?: boolean; onNavigate?: () => void }) {
  const { update, remove, setSaved } = useCart();
  const ref = { id: line.id, variantId: line.variant_id };
  return (
    <li className={cn('flex gap-4', compact ? 'py-4' : 'py-6')}>
      <Link to={`/products/${line.slug}`} onClick={onNavigate} className={cn('shrink-0 overflow-hidden rounded-xs bg-paper-200', compact ? 'h-24 w-20' : 'h-32 w-24 sm:h-40 sm:w-32')}>
        {line.image ? (
          <ResponsiveImage src={line.image.url} renditions={line.image.renditions} alt={line.image.alt} sizes="128px" className="h-full w-full object-cover" />
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {line.brand ? <p className="text-[0.8125rem] font-semibold text-ink-muted">{line.brand}</p> : null}
            <Link to={`/products/${line.slug}`} onClick={onNavigate} className="line-clamp-2 font-medium text-ink hover:text-charcoal-800">
              {line.name}
            </Link>
            {line.variant_label ? <p className="mt-0.5 text-sm text-ink-muted">{line.variant_label}</p> : null}
            {line.flash_sale ? <p className="mt-1 text-xs font-semibold text-charcoal-700">{line.flash_sale.title} price</p> : null}
          </div>
          <div className="text-right">
            <p className="font-semibold text-ink">{formatMoney(line.line_total_paise)}</p>
            {line.mrp_paise > line.unit_price_paise ? (
              <p className="text-xs text-ink-muted line-through">{formatMoney(line.mrp_paise * line.quantity)}</p>
            ) : null}
          </div>
        </div>
        {line.issue ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-danger" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" /> {line.issue}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-3">
          {!saved ? (
            <QuantityStepper
              size="sm"
              value={line.quantity}
              max={Math.max(line.max_quantity, 1)}
              onChange={(quantity) => update.mutate({ ...ref, quantity })}
              label={`Quantity of ${line.name}`}
            />
          ) : null}
          <button type="button" className="inline-flex min-h-11 items-center text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline" onClick={() => setSaved.mutate({ ...ref, saved: !saved })}>
            {saved ? 'Move to bag' : 'Save for later'}
          </button>
          <button type="button" className="inline-flex min-h-11 items-center text-sm text-ink-muted underline-offset-4 hover:text-danger hover:underline" onClick={() => remove.mutate(ref)}>
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
