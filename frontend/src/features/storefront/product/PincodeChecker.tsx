import { Banknote, MapPin, Truck } from 'lucide-react';
import { useState } from 'react';
import { useDeliveryEstimate } from '@/api/hooks/offers';
import { Spinner } from '@/components/ui/Spinner';
import { formatMoney } from '@/lib/money';
import { useCheckoutPrefs } from '@/stores/checkoutPrefs';
import { formatEta } from '../cart/DeliveryOptions';

export function PincodeChecker({ productSlug }: { productSlug: string }) {
  const { pincode, setPincode } = useCheckoutPrefs();
  const [draft, setDraft] = useState(pincode);
  const { data, isFetching, isError } = useDeliveryEstimate(pincode, productSlug);
  const valid = /^[1-9]\d{5}$/.test(draft);

  return (
    <div className="rounded-sm border border-line p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setPincode(draft);
        }}
        className="flex items-center gap-2"
      >
        <MapPin className="h-4 w-4 shrink-0 text-charcoal-800" aria-hidden="true" />
        <label htmlFor="pdp-pincode" className="sr-only">
          Delivery pincode
        </label>
        <input
          id="pdp-pincode"
          inputMode="numeric"
          maxLength={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter pincode for delivery date"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
        />
        <button type="submit" disabled={!valid} className="text-xs font-semibold text-charcoal-800 disabled:opacity-40">
          Check
        </button>
      </form>
      <div aria-live="polite">
        {isFetching ? (
          <Spinner className="mt-3 h-4 w-4 text-ink-muted" label="Checking delivery" />
        ) : isError ? (
          <p className="mt-3 text-sm text-danger">Please enter a valid 6-digit pincode.</p>
        ) : data && !data.serviceable ? (
          <p className="mt-3 text-sm text-danger">We don't deliver to {data.pincode} yet, but we're growing.</p>
        ) : data ? (
          <ul className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
            <li className="text-ink-muted">
              Delivering to {data.city}, {data.state}
            </li>
            {data.options
              .filter((o) => o.available)
              .map((o) => (
                <li key={o.code} className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span>
                    <strong className="font-medium text-ink">{o.name}</strong>: arrives {formatEta(o.eta_from, o.eta_to)}
                    <span className="text-ink-muted"> · {o.fee_paise ? formatMoney(o.fee_paise) : 'free'}</span>
                  </span>
                </li>
              ))}
            <li className="flex items-center gap-2 text-ink-muted">
              <Banknote className="h-4 w-4" aria-hidden="true" />
              {data.cod_available ? 'Cash on delivery available' : 'Prepaid orders only for this pincode'}
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}
