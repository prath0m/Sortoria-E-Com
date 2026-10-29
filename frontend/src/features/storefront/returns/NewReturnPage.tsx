import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { useRequestReturn, useReturnableItems } from '@/api/hooks/orders';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { PhotoPicker } from '@/components/ui/PhotoPicker';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Skeleton } from '@/components/ui/Skeleton';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { cn } from '@/lib/cn';
import { Seo } from '@/lib/seo';

const REASONS = [
  { value: 'wrong_size', label: "Doesn't fit" },
  { value: 'damaged', label: 'Arrived damaged' },
  { value: 'defective', label: 'Faulty or not working' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'other', label: 'Something else' },
];
const FAULT = new Set(['damaged', 'defective', 'not_as_described']);

export default function NewReturnPage() {
  const [params] = useSearchParams();
  const orderNumber = params.get('order') ?? '';
  const token = params.get('token');
  const { data, isLoading } = useReturnableItems(orderNumber, token);
  const submit = useRequestReturn();
  const navigate = useNavigate();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [upi, setUpi] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');

  const items = data?.items ?? [];
  const chosen = Object.entries(quantities).filter(([, q]) => q > 0);
  const fault = FAULT.has(reason);
  const replacementOnly = chosen.some(([id]) => items.find((i) => i.order_item_id === Number(id))?.policy === 'replacement_only');
  const needsUpi = data?.payment_method === 'cod' && !replacementOnly;
  const anyEligible = items.some((i) => i.eligible);

  return (
    <div className="container-page max-w-3xl py-10 lg:py-14">
      <Seo title="Request a return" noindex />
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: `Order ${orderNumber}`, to: `/order/${orderNumber}${token ? `?token=${encodeURIComponent(token)}` : ''}` }, { label: 'Return' }]} />
      <h1 className="mt-6 text-display-lg">Return or replace</h1>
      <p className="mt-3 text-ink-soft">Choose the pieces, tell us why, and we'll arrange a free pickup once your request is approved.</p>

      {isLoading ? (
        <Skeleton className="mt-8 h-64" />
      ) : !anyEligible ? (
        <p className="mt-8 rounded-sm border border-line bg-surface-raised p-6 text-ink-soft">
          {items[0]?.note || 'Nothing on this order can be returned right now.'}
        </p>
      ) : (
        <form
          className="mt-8 space-y-8"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            if (!chosen.length) return setError('Choose at least one piece to return.');
            if (!reason) return setError('Tell us why you are returning it.');
            if (fault && !photos.length) return setError('Please add a photo so we can see the problem.');
            const form = new FormData();
            form.append('order_number', orderNumber);
            if (token) form.append('token', token);
            form.append('items', JSON.stringify(chosen.map(([id, q]) => ({ order_item_id: Number(id), quantity: q }))));
            form.append('reason', reason);
            form.append('comments', comments);
            if (needsUpi) form.append('refund_upi_id', upi);
            photos.forEach((p) => form.append('photos', p));
            try {
              const created = await submit.mutateAsync(form);
              toast.success(`Return ${created.number} requested`, { description: "We'll review it within one working day." });
              navigate(`/returns/${created.number}${token ? `?token=${encodeURIComponent(token)}` : ''}`);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'We could not submit your request.');
            }
          }}
        >
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ink">Which pieces?</legend>
            <ul className="divide-y divide-line border-y border-line">
              {items.map((item) => (
                <li key={item.order_item_id} className={cn('flex items-center gap-4 py-4', !item.eligible && 'opacity-60')}>
                  {item.image_url ? <img src={item.image_url} alt="" className="h-20 w-16 rounded-xs object-cover" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-ink-muted">{item.variant_label}</p>
                    {item.note ? <p className="text-xs text-ink-muted">{item.note}</p> : null}
                    {item.policy === 'replacement_only' && item.eligible ? (
                      <p className="text-xs text-charcoal-700">Eligible for a replacement within {item.window_days} days.</p>
                    ) : null}
                  </div>
                  {item.eligible ? (
                    <QuantityStepper
                      size="sm"
                      min={0}
                      max={item.returnable_quantity}
                      value={quantities[item.order_item_id] ?? 0}
                      onChange={(q) => setQuantities((prev) => ({ ...prev, [item.order_item_id]: q }))}
                      label={`Quantity of ${item.product_name} to return`}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </fieldset>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ink">What happened?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-xs border p-3 text-sm', reason === r.value ? 'border-charcoal-800 bg-charcoal-50/40' : 'border-line')}
                >
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-[rgb(var(--charcoal-800))]" />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <TextArea label="Tell us more" optional rows={3} maxLength={1000} value={comments} onChange={(e) => setComments(e.target.value)} />
          <PhotoPicker files={photos} onChange={setPhotos} max={5} label={fault ? 'Photos (required)' : 'Photos'} hint="Clear photos help us resolve things quickly." />
          {needsUpi ? (
            <TextField
              label="UPI ID for your refund"
              placeholder="name@bank"
              hint="Your order was paid in cash, so we'll send the refund to this UPI ID."
              value={upi}
              onChange={(e) => setUpi(e.target.value.trim())}
            />
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" loading={submit.isPending}>
            Submit request
          </Button>
        </form>
      )}
    </div>
  );
}
