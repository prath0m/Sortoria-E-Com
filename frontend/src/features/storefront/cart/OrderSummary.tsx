import type { ReactNode } from 'react';
import type { Quote } from '@/api/types';
import { formatMoney } from '@/lib/money';

function Row({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: 'saving' | 'muted' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className={tone === 'muted' ? 'text-ink-muted' : 'text-ink-soft'}>{label}</dt>
      <dd className={tone === 'saving' ? 'font-medium text-success' : tone === 'muted' ? 'text-ink-muted' : 'text-ink'}>{value}</dd>
    </div>
  );
}

export function OrderSummary({ quote, children, showTaxSplit }: { quote: Quote; children?: ReactNode; showTaxSplit?: boolean }) {
  const mrpSavings = quote.mrp_total_paise - quote.subtotal_paise;
  return (
    <div>
      <dl>
        <Row label={`Subtotal (${quote.item_count} ${quote.item_count === 1 ? 'item' : 'items'})`} value={formatMoney(quote.subtotal_paise)} />
        {quote.bundles_applied.map((b) => (
          <Row key={b.slug} label={`${b.title}${b.sets > 1 ? ` × ${b.sets}` : ''}`} value={`−${formatMoney(b.discount_paise)}`} tone="saving" />
        ))}
        {quote.coupon?.applied ? (
          <Row label={`Code ${quote.coupon.code}`} value={`−${formatMoney(quote.coupon.discount_paise)}`} tone="saving" />
        ) : null}
        <Row
          label="Shipping"
          value={quote.shipping_fee_paise ? formatMoney(quote.shipping_fee_paise) : <span className="text-success">Complimentary</span>}
        />
        {quote.cod_fee_paise ? <Row label="Cash on delivery fee" value={formatMoney(quote.cod_fee_paise)} /> : null}
      </dl>
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-4">
        <span className="font-semibold text-ink">Total</span>
        <span className="font-display text-2xl text-ink">{formatMoney(quote.total_paise)}</span>
      </div>
      <p className="mt-1 text-right text-xs text-ink-muted">
        Includes {formatMoney(quote.tax.total_paise)} GST
        {showTaxSplit
          ? quote.tax.igst_paise
            ? ` (IGST)`
            : ` (CGST ${formatMoney(quote.tax.cgst_paise)} + SGST ${formatMoney(quote.tax.sgst_paise)})`
          : ''}
      </p>
      {quote.savings_paise > 0 ? (
        <p className="mt-3 rounded-xs bg-success/10 px-3 py-2 text-center text-sm text-success">
          You save {formatMoney(quote.savings_paise)} on this order
          {mrpSavings > 0 && quote.savings_paise > mrpSavings ? ' including offers' : ''}.
        </p>
      ) : null}
      {children}
    </div>
  );
}
