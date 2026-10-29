import { MapPin } from 'lucide-react';
import { useState } from 'react';
import type { Quote } from '@/api/types';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { useCheckoutPrefs } from '@/stores/checkoutPrefs';

export function formatEta(from: string | null, to: string | null) {
  if (!from || !to) return '';
  const fmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return from === to ? fmt.format(new Date(from)) : `${fmt.format(new Date(from))} – ${fmt.format(new Date(to))}`;
}

/** Pincode entry plus Standard/Express choice; both feed back into the quote. */
export function DeliveryOptions({ quote }: { quote: Quote }) {
  const { pincode, setPincode, setShippingMethod } = useCheckoutPrefs();
  const [draft, setDraft] = useState(pincode);
  const valid = /^[1-9]\d{5}$/.test(draft);
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setPincode(draft);
        }}
      >
        <label htmlFor="cart-pincode" className="text-sm font-medium text-ink">
          Deliver to
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              id="cart-pincode"
              inputMode="numeric"
              maxLength={6}
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
              placeholder="Pincode"
              className="h-11 w-full rounded-xs border border-line-strong bg-surface-raised pl-9 pr-3 text-sm focus:border-charcoal-800 focus:outline-none"
            />
          </div>
          <button type="submit" disabled={!valid} className="inline-flex min-h-11 items-center px-3 text-xs font-semibold text-charcoal-800 disabled:opacity-40">
            Check
          </button>
        </div>
        {quote.serviceable === false ? (
          <p className="mt-1.5 text-[0.8125rem] text-danger" role="alert">
            We don't deliver to {quote.pincode} yet. Try another pincode.
          </p>
        ) : quote.destination ? (
          <p className="mt-1.5 text-[0.8125rem] text-ink-muted">
            Delivering to {quote.destination.city}, {quote.destination.state}
          </p>
        ) : null}
      </form>
      <fieldset>
        <legend className="sr-only">Delivery speed</legend>
        <div className="space-y-2">
          {quote.shipping_options.map((option) => {
            const selected = quote.shipping_method === option.code;
            return (
              <label
                key={option.code}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xs border p-3 transition-colors',
                  selected ? 'border-charcoal-800 bg-charcoal-50/40' : 'border-line',
                  !option.available && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="radio"
                  name="shipping"
                  className="mt-1 accent-[rgb(var(--charcoal-800))]"
                  checked={selected}
                  disabled={!option.available}
                  onChange={() => setShippingMethod(option.code)}
                />
                <span className="flex-1 text-sm">
                  <span className="flex justify-between gap-2 font-medium text-ink">
                    {option.name}
                    <span>{option.fee_paise ? formatMoney(option.fee_paise) : 'Free'}</span>
                  </span>
                  <span className="block text-ink-muted">
                    {option.available
                      ? option.eta_from
                        ? `Arrives ${formatEta(option.eta_from, option.eta_to)}`
                        : option.description
                      : option.unavailable_reason}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
