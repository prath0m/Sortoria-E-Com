import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminItem } from '@/api/hooks/adminCrud';
import type { OrderAddress, ReturnRequest } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney } from '@/lib/money';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { StatusBadge } from '../components/StatusBadge';
import { dateTime, shortDate } from '../orders/types';

interface AdminReturn extends ReturnRequest {
  refund_upi_id: string;
  payment_method: string;
  customer: { name: string; email: string; phone: string; address: OrderAddress };
  allowed_transitions: { status: string; label: string }[];
}

const CONFIRM_COPY: Record<string, string> = {
  approved: 'The customer is told their return is approved and a pickup will be arranged.',
  pickup_scheduled: 'The customer is emailed the pickup date.',
  received: 'The items are added back to stock.',
  refunded: 'The refund is sent now.',
  replaced: 'Ship the replacement as a new order; this closes the return.',
  rejected: 'The customer sees your note, so explain why.',
};

function TransitionDialog({ ret, target, onClose }: { ret: AdminReturn; target: { status: string; label: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [pickup, setPickup] = useState(tomorrow);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const rejecting = target.status === 'rejected';

  const submit = async () => {
    if (rejecting && !note.trim()) {
      toast.error('Add a short reason for the customer.');
      return;
    }
    setSaving(true);
    try {
      const updated = await adminApi.post<AdminReturn>(`returns/${ret.number}/transition/`, {
        status: target.status,
        note,
        ...(target.status === 'pickup_scheduled' ? { pickup_date: pickup } : {}),
      });
      qc.setQueryData(['admin', 'returns', 'item', ret.number], updated);
      qc.invalidateQueries({ queryKey: ['admin', 'returns', 'list'] });
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success(`Return ${target.label.toLowerCase()}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the return.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={target.status === 'refunded' ? `Refund ${formatMoney(ret.refund_amount_paise)}?` : `Mark as ${target.label.toLowerCase()}`}>
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-sm text-ink-soft">
          {CONFIRM_COPY[target.status]}
          {target.status === 'refunded' && ret.payment_method === 'cod' ? ` Send it to ${ret.refund_upi_id} by UPI, then record it here.` : ''}
        </p>
        {target.status === 'pickup_scheduled' ? <TextField label="Pickup date" type="date" min={tomorrow} value={pickup} onChange={(e) => setPickup(e.target.value)} /> : null}
        <TextArea label={rejecting ? 'Reason for the customer' : 'Note'} optional={!rejecting} rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button variant={rejecting ? 'danger' : 'primary'} loading={saving} onClick={submit}>{rejecting ? 'Reject return' : 'Confirm'}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function ReturnDetailPage() {
  const { number } = useParams();
  const { data: ret, isLoading, isError, refetch } = useAdminItem<AdminReturn>('returns', number);
  const [target, setTarget] = useState<{ status: string; label: string } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  if (isError) return <ErrorState title="We couldn't load this return." onRetry={() => refetch()} />;
  if (isLoading || !ret) return <Skeleton className="h-96" />;

  const forward = ret.allowed_transitions.filter((t) => t.status !== 'rejected');
  const canReject = ret.allowed_transitions.some((t) => t.status === 'rejected');

  return (
    <>
      <PageHeader
        title={ret.number}
        eyebrow="Return"
        back={{ to: '/admin/returns', label: 'All returns' }}
        actions={
          <>
            {canReject ? <Button size="sm" variant="ghost" className="text-danger" onClick={() => setTarget({ status: 'rejected', label: 'Rejected' })}>Reject</Button> : null}
            {forward.map((t, i) => (
              <Button key={t.status} size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => setTarget(t)}>
                {t.status === 'refunded' ? 'Issue refund' : t.status === 'replaced' ? 'Mark replaced' : `Mark ${t.label.toLowerCase()}`}
              </Button>
            ))}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <StatusBadge status={ret.status} label={ret.status_label} />
          <span>
            For order{' '}
            <Link to={`/admin/orders/${ret.order_number}`} className="font-medium text-accent hover:underline">{ret.order_number}</Link>
          </span>
          <span>· Requested {dateTime(ret.created_at)}</span>
        </div>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <Section title="Items">
            <ul className="divide-y divide-line/60">
              {ret.items.map((item) => (
                <li key={item.order_item_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xs bg-ink/5">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : null}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{item.product_name}</p>
                    <p className="text-xs text-ink-muted">{item.variant_label}</p>
                  </div>
                  <span className="text-sm tabular-nums text-ink-soft">× {item.quantity}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="What the customer said">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted">Reason</dt>
                <dd className="text-ink">{ret.reason_label}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Wants</dt>
                <dd className="text-ink">{ret.resolution === 'refund' ? `A refund of ${formatMoney(ret.refund_amount_paise)}` : 'A replacement'}</dd>
              </div>
            </dl>
            {ret.comments ? <blockquote className="border-l-2 border-accent pl-3 text-sm italic text-ink-soft">{ret.comments}</blockquote> : null}
            {ret.photos.length ? (
              <div className="flex flex-wrap gap-2">
                {ret.photos.map((src, i) => (
                  <button key={src} type="button" onClick={() => setPhoto(src)} aria-label={`Open photo ${i + 1}`} className="h-24 w-24 overflow-hidden rounded-xs border border-line">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </Section>
          {ret.admin_note ? (
            <Section title="Staff note">
              <p className="text-sm text-ink-soft">{ret.admin_note}</p>
            </Section>
          ) : null}
        </div>
        <div className="min-w-0 space-y-5">
          <Section title="Customer">
            <div className="text-sm">
              <p className="font-medium text-ink">{ret.customer.name}</p>
              <p className="text-ink-soft">{ret.customer.email}</p>
              <p className="text-ink-soft">{ret.customer.phone}</p>
            </div>
            <address className="text-sm not-italic text-ink-soft">
              <span className="text-xs text-ink-muted">Pickup from</span>
              <br />
              {ret.customer.address.line1}
              {ret.customer.address.line2 ? `, ${ret.customer.address.line2}` : ''}
              <br />
              {ret.customer.address.city}, {ret.customer.address.state} {ret.customer.address.pincode}
            </address>
            {ret.pickup_date ? <p className="text-sm text-ink">Pickup on {shortDate(ret.pickup_date)}</p> : null}
          </Section>
          {ret.resolution === 'refund' ? (
            <Section title="Refund">
              <p className="text-sm text-ink-soft">
                {formatMoney(ret.refund_amount_paise)} {ret.payment_method === 'cod' ? `by UPI to ${ret.refund_upi_id || 'an ID the customer has not given'}` : 'to the original payment method'}
              </p>
            </Section>
          ) : null}
          <Section title="Timeline">
            <ol className="relative space-y-4 border-l border-line pl-4">
              {[...ret.events].reverse().map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[1.3rem] top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-surface-raised" aria-hidden="true" />
                  <p className="text-sm font-medium text-ink">{e.label}</p>
                  <p className="text-xs text-ink-muted">{dateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
      {target ? <TransitionDialog ret={ret} target={target} onClose={() => setTarget(null)} /> : null}
      <Modal open={!!photo} onClose={() => setPhoto(null)} title="Customer photo" className="max-w-3xl">
        {photo ? <img src={photo} alt="Supplied by the customer with their return request" className="max-h-[80vh] w-full object-contain" /> : null}
      </Modal>
    </>
  );
}
