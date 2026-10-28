import { Link } from 'react-router-dom';
import type { ProductDetail } from '@/api/types';
import { AccordionItem } from '@/components/ui/Accordion';
import { useStoreSettings } from '@/api/hooks/store';

const POLICY_COPY = {
  returnable: (days: number) => `Changed your mind? Return it within ${days} days of delivery for a full refund.`,
  replacement_only: (days: number) =>
    `If it arrives damaged or develops a fault, we’ll replace it within ${days} days of delivery.`,
  non_returnable: () => 'For hygiene reasons this item can’t be returned once delivered, unless it arrives damaged.',
};

export function ProductDetails({ product }: { product: ProductDetail }) {
  const { data: store } = useStoreSettings();
  const policy = POLICY_COPY[product.return_policy.policy](product.return_policy.window_days);
  return (
    <div className="border-t border-line">
      <AccordionItem title="Description" defaultOpen>
        {/* Product descriptions are sanitised server-side (nh3) before they are stored. */}
        <div className="prose-sartoria" dangerouslySetInnerHTML={{ __html: product.description }} />
        {product.facts.length ? (
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            {product.facts.map((f) => (
              <div key={f.name} className="contents">
                <dt className="text-ink-muted">{f.name}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {product.care_info ? (
          <p className="mt-4 text-sm">
            <span className="font-semibold text-ink">Care: </span>
            {product.care_info}
          </p>
        ) : null}
      </AccordionItem>
      {product.specs.length ? (
        <AccordionItem title="Specifications">
          <div className="space-y-6">
            {product.specs.map((group) => (
              <table key={group.group} className="w-full text-sm">
                <caption className="mb-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{group.group}</caption>
                <tbody>
                  {group.items.map((row) => (
                    <tr key={row.key} className="border-b border-line/70 last:border-0">
                      <th scope="row" className="w-2/5 py-2 pr-4 text-left font-normal text-ink-muted">{row.key}</th>
                      <td className="py-2 text-ink">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </AccordionItem>
      ) : null}
      {product.warranty_info || product.box_contents ? (
        <AccordionItem title="Warranty & in the box">
          {product.warranty_info ? <p><span className="font-semibold text-ink">Warranty: </span>{product.warranty_info}</p> : null}
          {product.box_contents ? <p className="mt-2"><span className="font-semibold text-ink">In the box: </span>{product.box_contents}</p> : null}
        </AccordionItem>
      ) : null}
      <AccordionItem title="Shipping & returns">
        <p>
          Orders leave {store?.city ? `our ${store.city} studio` : 'our studio'} within one working day, with Standard
          and Express delivery available. Check your pincode above for an exact delivery date.{' '}
          {product.product_type === 'bulky' ? 'Large items are delivered and placed by our white-glove partners.' : ''}
        </p>
        <p className="mt-3">{policy}</p>
        <p className="mt-3">
          <Link to="/pages/shipping-policy" className="link-underline text-burgundy-800">Shipping policy</Link>
          {' · '}
          <Link to="/pages/returns-policy" className="link-underline text-burgundy-800">Returns policy</Link>
          {store?.support_phone ? ` · Questions? Call ${store.support_phone}` : ''}
        </p>
      </AccordionItem>
    </div>
  );
}
