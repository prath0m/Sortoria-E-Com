import { cn } from '@/lib/cn';
import { discountPercent, formatMoney } from '@/lib/money';

interface PriceProps {
  price: number;
  mrp?: number | null;
  maxPrice?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showDiscount?: boolean;
}

export function Price({ price, mrp, maxPrice, size = 'md', className, showDiscount = true }: PriceProps) {
  const off = discountPercent(price, mrp);
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' };
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={cn('font-semibold text-ink', sizes[size])}>
        {maxPrice && maxPrice > price ? <span className="font-normal text-ink-muted">From </span> : null}
        {formatMoney(price)}
      </span>
      {off > 0 && mrp ? (
        <>
          <span className={cn('text-ink-muted line-through', size === 'lg' ? 'text-base' : 'text-[0.8125rem]')}>
            <span className="sr-only">Original price </span>
            {formatMoney(mrp)}
          </span>
          {showDiscount ? (
            <span className={cn('font-semibold text-charcoal-700', size === 'lg' ? 'text-base' : 'text-[0.8125rem]')}>
              {off}% off
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
