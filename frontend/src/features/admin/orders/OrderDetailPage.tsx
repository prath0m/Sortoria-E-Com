import { useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, downloadFile, useAdminItem } from '@/api/hooks/adminCrud';
import type { OrderAddress } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney } from '@/lib/money';
import { useAuth } from '@/stores/auth';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { StatusBadge } from '../components/StatusBadge';
import { dateTime, PAYMENT_LABEL, shortDate, type AdminOrder } from './types';

function Address({ a }: { a: OrderAddress }) {
  return (
    <address className="text-sm not-italic leading-relaxed text-ink-soft">
      <span className="font-medium text-ink">{a.full_name}</span>
      <br />
      {a.line1}
      {a.line2 ? <>, {a.line2}</> : null}
      {a.landmark ? <><br />Near {a.landmark}</> : null}
      <br />
      {a.city}, {a.state} {a.pincode}
      <br />
      {a.phone}
    </address>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${strong ? 'border-t border-line pt-2 font-semibold text-ink' : muted ? 'text-ink-muted' : 'text-ink-soft'}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function TransitionDialog({ order, target, onClose }: { order: AdminOrder; target: { status: string; label: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState({ courier_name: order.courier_name, tracking_number: order.tracking_number, tracking_url: order.tracking_url });
  const [saving, setSaving] = useState(false);
  const shipping = target.status === 'shipped';
  const cancelling = target.status === 'cancelled';

  const submit = async () => {
    if (shipping && !tracking.tracking_number.trim()) {
      toast.error('Add a tracking number so the customer can follow the parcel.');
      return;
    }
    setSaving(true);
    try {
      const updated = await adminApi.post<AdminOrder>(`orders/${order.number}/transition/`, { status: target.status, note, ...(shipping ? tracking : {}) });
      qc.setQueryData(['admin', 'orders', 'item', order.number], updated);
      qc.invalidateQueries({ queryKey: ['admin', 'orders', 'list'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      toast.success(`Marked as ${target.label.toLowerCase()}. The customer has been emailed.`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={cancelling ? `Cancel ${order.number}?` : `Mark as ${target.label.toLowerCase()}`}>
      <div className="space-y-4 p-5 sm:p-6">
        {cancelling ? (
          <p className="text-sm text-ink-soft">
            Stock is returned to inventory{order.payment_status === 'paid' ? ' and the online payment is refunded in full' : ''}. The customer is emailed.
          </p>
        ) : null}
        {shipping ? (
          <>
            <TextField label="Courier" value={tracking.courier_name} onChange={(e) => setTracking({ ...tracking, courier_name: e.target.value })} />
            <TextField label="Tracking number" value={tracking.tracking_number} onChange={(e) => setTracking({ ...tracking, tracking_number: e.target.value })} />
            <TextField label="Tracking link" optional type="url" value={tracking.tracking_url} onChange={(e) => setTracking({ ...tracking, tracking_url: e.target.value })} />
          </>
        ) : null}
        <TextArea label={cancelling ? 'Reason' : 'Note'} optional rows={2} value={note} maxLength={300} hint="Shown on the order timeline." onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button variant={cancelling ? 'danger' : 'primary'} loading={saving} onClick={submit}>
            {cancelling ? 'Cancel order' : 'Confirm'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Fulfilment({ order, canManage }: { order: AdminOrder; canManage: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ courier_name: '', tracking_number: '', tracking_url: '', estimated_delivery_date: '', internal_note: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm({
      courier_name: order.courier_name,
      tracking_number: order.tracking_number,
      tracking_url: order.tracking_url,
      estimated_delivery_date: order.estimated_delivery_date ?? '',
      internal_note: order.internal_note,
    });
  }, [order]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminApi.update<AdminOrder>('orders', order.number, { ...form, estimated_delivery_date: form.estimated_delivery_date || null });
      qc.setQueryData(['admin', 'orders', 'item', order.number], updated);
      toast.success('Saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Fulfilment" description="Tracking details appear on the customer's order page and emails.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Courier" disabled={!canManage} value={form.courier_name} onChange={(e) => setForm({ ...form, courier_name: e.target.value })} />
        <TextField label="Tracking number" disabled={!canManage} value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} />
        <TextField label="Tracking link" optional disabled={!canManage} value={form.tracking_url} onChange={(e) => setForm({ ...form, tracking_url: e.target.value })} />
        <TextField label="Estimated delivery" type="date" optional disabled={!canManage} value={form.estimated_delivery_date} onChange={(e) => setForm({ ...form, estimated_delivery_date: e.target.value })} />
      </div>
      <TextArea label="Internal note" optional rows={3} disabled={!canManage} hint="Only staff can see this." value={form.internal_note} onChange={(e) => setForm({ ...form, internal_note: e.target.value })} />
      {canManage ? (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" loading={saving} onClick={save}>Save details</Button>
        </div>
      ) : null}
    </Section>
  );
}

export default function OrderDetailPage() {
  const { number } = useParams();
  const { data: order, isLoading, isError, refetch } = useAdminItem<AdminOrder>('orders', number);
  const canManage = !!useAuth((s) => s.user?.capabilities.includes('orders.manage'));
  const canSeeCustomers = !!useAuth((s) => s.user?.capabilities.includes('customers.view'));
  const [target, setTarget] = useState<{ status: string; label: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  if (isError) return <ErrorState title="We couldn't load this order." onRetry={() => refetch()} />;
  if (isLoading || !order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const invoice = async () => {
    setDownloading(true);
    try {
      await downloadFile(`/admin/orders/${order.number}/invoice/`, `Invoice-${order.number}.pdf`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download the invoice.');
    } finally {
      setDownloading(false);
    }
  };

  const discount = order.item_discount_paise + order.bundle_discount_paise + order.coupon_discount_paise;
  const forward = order.allowed_transitions.filter((t) => t.status !== 'cancelled');
  const canCancel = order.allowed_transitions.some((t) => t.status === 'cancelled');

  return (
    <>
      <PageHeader
        title={order.number}
        eyebrow="Order"
        back={{ to: '/admin-panel/orders', label: 'All orders' }}
        actions={
          <>
            {order.has_invoice ? (
              <Button variant="ghost" size="sm" loading={downloading} icon={<Download className="h-3.5 w-3.5" />} onClick={invoice}>
                Invoice
              </Button>
            ) : null}
            {canManage && canCancel ? (
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => setTarget({ status: 'cancelled', label: 'Cancelled' })}>
                Cancel order
              </Button>
            ) : null}
            {canManage
              ? forward.map((t, i) => (
                  <Button key={t.status} size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => setTarget(t)}>
                    Mark {t.label.toLowerCase()}
                  </Button>
                ))
              : null}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <StatusBadge status={order.status} label={order.status_label} />
          <StatusBadge status={order.payment_status} label={`${PAYMENT_LABEL[order.payment_method] ?? order.payment_method} · ${order.payment_status.replace('_', ' ')}`} />
          <span>Placed {dateTime(order.placed_at ?? order.created_at)}</span>
          {order.invoice_number ? <span>· Invoice {order.invoice_number}</span> : null}
        </div>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <Section title={`Items (${order.items.reduce((n, i) => n + i.quantity, 0)})`}>
            <ul className="divide-y divide-line/60">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xs bg-ink/5">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : null}</div>
                  <div className="min-w-0 flex-1">
                    <a href={`/products/${item.product_slug}`} target="_blank" rel="noreferrer" className="font-medium text-ink hover:text-accent">
                      {item.product_name}
                    </a>
                    <p className="text-xs text-ink-muted">
                      {[item.variant_label, item.sku].filter(Boolean).join(' · ')} · GST {item.tax_rate}%
                    </p>
                    {item.returned_quantity ? <p className="mt-0.5 text-xs font-semibold text-warning">{item.returned_quantity} returned</p> : null}
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p className="text-ink-soft">
                      {item.quantity} × {formatMoney(item.unit_price_paise)}
                    </p>
                    {item.line_discount_paise ? <p className="text-xs text-success">−{formatMoney(item.line_discount_paise)}</p> : null}
                    <p className="font-medium text-ink">{formatMoney(item.line_total_paise)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line pt-4">
              <Row label="Subtotal" value={formatMoney(order.subtotal_paise)} />
              {discount ? <Row label={order.coupon_code ? `Discounts (incl. ${order.coupon_code})` : 'Discounts'} value={`−${formatMoney(discount)}`} /> : null}
              <Row label={`Shipping · ${order.shipping_method}`} value={order.shipping_fee_paise ? formatMoney(order.shipping_fee_paise) : 'Free'} />
              {order.cod_fee_paise ? <Row label="Cash on delivery fee" value={formatMoney(order.cod_fee_paise)} /> : null}
              <Row strong label="Total" value={formatMoney(order.grand_total_paise)} />
              <Row muted label={order.igst_paise ? 'Includes IGST' : 'Includes CGST + SGST'} value={formatMoney(order.tax_total_paise)} />
            </dl>
          </Section>

          <Fulfilment order={order} canManage={canManage} />

          <Section title="Payments">
            {order.payments.length === 0 ? <p className="text-sm text-ink-muted">No payment attempts recorded.</p> : null}
            <ul className="space-y-3">
              {order.payments.map((p, i) => (
                <li key={i} className="rounded-xs border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink">
                      {PAYMENT_LABEL[p.provider] ?? p.provider}
                      {p.method ? ` · ${p.method}` : ''}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{formatMoney(p.amount_paise)}</span>
                      <StatusBadge status={p.status} />
                    </span>
                  </div>
                  <p className="mt-1 break-all font-mono text-xs text-ink-muted">{[p.provider_order_id, p.provider_payment_id].filter(Boolean).join(' · ') || '—'}</p>
                  <p className="text-xs text-ink-muted">{dateTime(p.created_at)}</p>
                  {p.refunds.map((r, j) => (
                    <p key={j} className="mt-2 flex justify-between border-t border-line/60 pt-2 text-xs">
                      <span>Refund · {r.reason || 'Return'} {r.reference ? `· ${r.reference}` : ''}</span>
                      <span className="flex items-center gap-2 tabular-nums">−{formatMoney(r.amount_paise)} <StatusBadge status={r.status} /></span>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="min-w-0 space-y-5">
          <Section title="Customer">
            <div className="text-sm">
              <p className="font-medium text-ink">{order.shipping_address.full_name}</p>
              <p className="text-ink-soft">{order.email}</p>
              <p className="text-ink-soft">{order.phone}</p>
              <p className="mt-2 text-xs text-ink-muted">
                {order.customer_id ? `${order.customer_order_count} successful ${order.customer_order_count === 1 ? 'order' : 'orders'}` : 'Guest checkout'}
              </p>
              {order.customer_id && canSeeCustomers ? (
                <Link to={`/admin-panel/customers/${order.customer_id}`} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">
                  View customer
                </Link>
              ) : null}
            </div>
            {order.customer_note ? (
              <div className="rounded-xs bg-accent-soft p-3 text-sm">
                <p className="text-xs font-semibold text-ink-muted">Customer note</p>
                <p className="mt-1 text-ink">{order.customer_note}</p>
              </div>
            ) : null}
          </Section>
          <Section title="Ship to">
            <Address a={order.shipping_address} />
            {order.estimated_delivery_date ? <p className="text-xs text-ink-muted">Expected by {shortDate(order.estimated_delivery_date)}</p> : null}
            {order.tracking_url ? (
              <a href={order.tracking_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                Track {order.tracking_number} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : null}
          </Section>
          {JSON.stringify(order.billing_address) !== JSON.stringify(order.shipping_address) ? (
            <Section title="Bill to">
              <Address a={order.billing_address} />
            </Section>
          ) : null}
          {order.returns.length ? (
            <Section title="Returns">
              <ul className="space-y-2">
                {order.returns.map((r) => (
                  <li key={r.number} className="flex items-center justify-between text-sm">
                    <Link to={`/admin-panel/returns/${r.number}`} className="font-medium text-ink hover:text-accent">{r.number}</Link>
                    <StatusBadge status={r.status} label={r.status_label} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <Section title="Timeline">
            <ol className="relative space-y-4 border-l border-line pl-4">
              {[...order.events].reverse().map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[1.3rem] top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-surface-raised" aria-hidden="true" />
                  <p className="text-sm font-medium text-ink">{e.label}</p>
                  {e.note ? <p className="text-xs text-ink-soft">{e.note}</p> : null}
                  <p className="text-xs text-ink-muted">{dateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
      {target ? <TransitionDialog order={order} target={target} onClose={() => setTarget(null)} /> : null}
    </>
  );
}
