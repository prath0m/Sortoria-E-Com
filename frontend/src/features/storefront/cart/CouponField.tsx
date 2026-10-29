import { Tag, X } from 'lucide-react';
import { useState } from 'react';
import type { Quote } from '@/api/types';
import { useCart } from '@/api/hooks/cart';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/lib/money';

export function CouponField({ quote }: { quote: Quote }) {
  const { applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const applied = quote.coupon?.applied ? quote.coupon : null;

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm border border-dashed border-iris-500 bg-iris-50 px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-iris-800" aria-hidden="true" />
          <strong className="tracking-wider">{applied.code}</strong>
          <span className="text-ink-soft">saves {formatMoney(applied.discount_paise)}</span>
        </span>
        <button
          type="button"
          onClick={() => removeCoupon.mutate()}
          aria-label={`Remove code ${applied.code}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim()) return;
        setError('');
        applyCoupon.mutate(code.trim(), {
          onSuccess: () => setCode(''),
          onError: (err) => setError(err instanceof ApiError ? err.message : 'That code could not be applied.'),
        });
      }}
    >
      <label htmlFor="coupon" className="text-sm font-medium text-ink">
        Gift or promo code
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code"
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="h-11 min-w-0 flex-1 rounded-xs border border-line-strong bg-surface-raised px-3 text-sm uppercase tracking-wider focus:border-charcoal-800 focus:outline-none"
        />
        <Button type="submit" variant="secondary" loading={applyCoupon.isPending}>
          Apply
        </Button>
      </div>
      {error ? (
        <p id="coupon-error" role="alert" className="mt-1.5 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
