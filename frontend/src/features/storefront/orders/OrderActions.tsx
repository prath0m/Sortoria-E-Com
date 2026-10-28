import { RotateCcw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { useCancelOrder, useOrderReturns } from '@/api/hooks/orders';
import type { OrderDetail } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SelectField, TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Overlay';

const REASONS = ['Ordered by mistake', 'Ordered the wrong size or colour', 'Found a better price', 'Delivery is too slow', 'Something else'];

export function OrderActions({ order, token }: { order: OrderDetail; token?: string | null }) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState('');
  const cancel = useCancelOrder(order.number, token ?? order.access_token);
  const returns = useOrderReturns(order.number, token ?? order.access_token);
  const query = `order=${order.number}&token=${encodeURIComponent(order.access_token)}`;

  return (
    <div className="space-y-4">
      {order.status === 'delivered' ? (
        <ButtonLink to={`/returns/new?${query}`} variant="secondary" block>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Return or replace an item
        </ButtonLink>
      ) : null}
      {order.can_cancel ? (
        <Button variant="ghost" block icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelling(true)}>
          Cancel order
        </Button>
      ) : null}
      {returns.data?.length ? (
        <section id="returns" className="rounded-sm border border-line bg-surface-raised p-5">
          <h2 className="eyebrow mb-3">Returns</h2>
          <ul className="space-y-2 text-sm">
            {returns.data.map((r) => (
              <li key={r.number} className="flex items-center justify-between gap-3">
                <Link to={`/returns/${r.number}?token=${encodeURIComponent(order.access_token)}`} className="text-burgundy-800 link-underline">
                  {r.number}
                </Link>
                <Badge tone={r.status === 'rejected' ? 'muted' : r.status === 'refunded' || r.status === 'replaced' ? 'success' : 'outline'}>
                  {r.status_label}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Modal open={cancelling} onClose={() => setCancelling(false)} title="Cancel this order?">
        <form
          className="space-y-5 p-5 sm:p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await cancel.mutateAsync(detail ? `${reason}: ${detail}` : reason);
              toast.success('Your order has been cancelled', {
                description: order.payment_status === 'paid' ? 'Your refund is on its way to your original payment method.' : undefined,
              });
              setCancelling(false);
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'We could not cancel this order.');
            }
          }}
        >
          <p className="text-sm text-ink-soft">
            We'll release your pieces straight away.
            {order.payment_status === 'paid' ? ' Your payment will be refunded within 5–7 working days.' : ''}
          </p>
          <SelectField label="Reason" options={REASONS.map((r) => ({ value: r, label: r }))} value={reason} onChange={(e) => setReason(e.target.value)} />
          <TextArea label="Anything else?" optional rows={3} maxLength={200} value={detail} onChange={(e) => setDetail(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" loading={cancel.isPending}>
              Cancel order
            </Button>
            <Button variant="ghost" onClick={() => setCancelling(false)}>
              Keep my order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
