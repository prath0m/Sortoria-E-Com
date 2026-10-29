import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { invoiceUrl } from '@/api/hooks/orders';
import type { OrderDetail } from '@/api/types';
import { formatMoney } from '@/lib/money';
import { OrderTimeline } from './OrderTimeline';

function Row({ label, value, saving }: { label: string; value: string; saving?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={saving ? 'text-success' : 'text-ink'}>{value}</dd>
    </div>
  );
}

function paymentLine(order: OrderDetail) {
  const labels: Record<string, string> = {
    pending: order.payment_method === 'cod' ? 'Cash on delivery · due on arrival' : 'Awaiting payment',
    paid: order.payment_method === 'cod' ? 'Cash on delivery · paid' : 'Paid online',
    failed: 'Payment failed',
    refunded: 'Refunded in full',
    partially_refunded: 'Partly refunded',
  };
  return labels[order.payment_status] ?? order.payment_status;
}

/** Shared order body for the confirmation page and the account order page. */
export function OrderView({ order, actions }: { order: OrderDetail; actions?: React.ReactNode }) {
  const a = order.shipping_address;
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
      <div className="space-y-10">
        <section aria-labelledby="items-heading">
          <h2 id="items-heading" className="text-display-sm">
            {order.item_count} {order.item_count === 1 ? 'piece' : 'pieces'}
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-4">
                <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xs bg-paper-200">
                  {item.image_url ? <img src={item.image_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={`/products/${item.product_slug}`} className="font-medium hover:text-charcoal-800">
                    {item.product_name}
                  </Link>
                  <p className="text-sm text-ink-muted">
                    {item.variant_label ? `${item.variant_label} · ` : ''}Qty {item.quantity}
                  </p>
                  {item.returned_quantity ? <p className="text-xs text-ink-muted">{item.returned_quantity} returned</p> : null}
                </div>
                <p className="text-sm font-medium">{formatMoney(item.line_total_paise)}</p>
              </li>
            ))}
          </ul>
        </section>
        <div className="grid gap-8 sm:grid-cols-2">
          <section>
            <h2 className="eyebrow mb-2">Delivering to</h2>
            <address className="text-sm not-italic leading-relaxed text-ink-soft">
              <span className="text-ink">{a.full_name}</span>
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              +91 {a.phone}
            </address>
          </section>
          <section>
            <h2 className="eyebrow mb-2">Payment</h2>
            <p className="text-sm text-ink-soft">{paymentLine(order)}</p>
            {order.tracking_number ? (
              <>
                <h2 className="eyebrow mb-2 mt-5">Tracking</h2>
                <p className="text-sm text-ink-soft">
                  {order.courier_name} · {order.tracking_number}
                  {order.tracking_url ? (
                    <>
                      {' '}
                      <a href={order.tracking_url} target="_blank" rel="noreferrer noopener" className="text-charcoal-800 link-underline">
                        Track with courier
                      </a>
                    </>
                  ) : null}
                </p>
              </>
            ) : null}
          </section>
        </div>
      </div>
      <aside className="space-y-8">
        <section className="rounded-sm border border-line bg-surface-raised p-6">
          <h2 className="eyebrow mb-5">Progress</h2>
          <OrderTimeline order={order} />
        </section>
        <section className="rounded-sm border border-line bg-surface-raised p-6">
          <dl>
            <Row label="Subtotal" value={formatMoney(order.subtotal_paise)} />
            {order.bundle_discount_paise ? <Row label="Bundle savings" value={`−${formatMoney(order.bundle_discount_paise)}`} saving /> : null}
            {order.coupon_discount_paise ? <Row label={`Code ${order.coupon_code}`} value={`−${formatMoney(order.coupon_discount_paise)}`} saving /> : null}
            <Row label="Shipping" value={order.shipping_fee_paise ? formatMoney(order.shipping_fee_paise) : 'Complimentary'} />
            {order.cod_fee_paise ? <Row label="Cash on delivery fee" value={formatMoney(order.cod_fee_paise)} /> : null}
          </dl>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-display text-2xl">{formatMoney(order.grand_total_paise)}</span>
          </div>
          <p className="mt-1 text-right text-xs text-ink-muted">Includes {formatMoney(order.tax_total_paise)} GST</p>
          {order.has_invoice ? (
            <a
              href={invoiceUrl(order.number, order.access_token)}
              className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-charcoal-800 link-underline"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Download invoice
            </a>
          ) : null}
        </section>
        {actions}
      </aside>
    </div>
  );
}
