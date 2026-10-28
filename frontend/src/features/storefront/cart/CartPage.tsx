import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '@/api/hooks/cart';
import { Reveal } from '@/components/motion/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Seo } from '@/lib/seo';
import { DeliveryOptions } from './DeliveryOptions';
import { CartLineItem } from './CartLineItem';
import { CouponField } from './CouponField';
import { FreeShippingProgress } from './FreeShippingProgress';
import { OrderSummary } from './OrderSummary';
import type { QuoteLine } from '@/api/types';
import type { CartLine } from '@/stores/cart';

/** Guest "saved for later" lines live only in the browser; shape them like server lines. */
function asQuoteLine(l: CartLine | QuoteLine): QuoteLine {
  if ('variant_id' in l) return l;
  return {
    id: null,
    variant_id: l.variantId,
    product_id: l.productId,
    slug: l.slug,
    name: l.name,
    brand: l.brand,
    sku: '',
    variant_label: l.variantLabel,
    options: [],
    image: l.image ? { url: l.image, renditions: {}, alt: l.name } : null,
    quantity: l.quantity,
    max_quantity: l.maxQuantity,
    unit_price_paise: l.pricePaise,
    mrp_paise: l.mrpPaise,
    line_total_paise: l.pricePaise * l.quantity,
    discount_paise: 0,
    flash_sale: null,
    is_bulky: false,
    issue: '',
  };
}

export default function CartPage() {
  const { quote, savedLines, isLoading, isEmpty } = useCart();
  const saved = savedLines.map(asQuoteLine);
  return (
    <>
      <Seo title="Your bag" noindex />
      <div className="container-page py-10 lg:py-14">
        <Reveal>
          <h1 className="text-display-lg">Your bag</h1>
        </Reveal>
        {isEmpty && !saved.length ? (
          <EmptyState
            illustration="bag"
            title="Your bag is waiting to be filled"
            description="When something catches your eye, it'll wait for you here."
            action={<ButtonLink to="/shop">Explore the collection</ButtonLink>}
          />
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
            <div>
              {isEmpty ? (
                <p className="rounded-sm border border-line bg-surface-raised p-6 text-ink-soft">
                  Your bag is empty, but you have pieces saved for later below.
                </p>
              ) : isLoading || !quote ? (
                <div className="space-y-4">
                  <Skeleton className="h-36" />
                  <Skeleton className="h-36" />
                </div>
              ) : (
                <>
                  <FreeShippingProgress quote={quote} />
                  <ul className="divide-y divide-line border-b border-line">
                    {quote.lines.map((line) => (
                      <CartLineItem key={line.variant_id} line={line} />
                    ))}
                  </ul>
                </>
              )}
              {saved.length ? (
                <section className="mt-12" aria-labelledby="saved-heading">
                  <h2 id="saved-heading" className="text-display-sm">
                    Saved for later ({saved.length})
                  </h2>
                  <ul className="divide-y divide-line">
                    {saved.map((line) => (
                      <CartLineItem key={line.variant_id} line={line} saved />
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
            {quote && !isEmpty ? (
              <aside className="lg:sticky lg:top-[calc(var(--header-bottom,6rem)+1.5rem)] lg:self-start">
                <div className="space-y-6 rounded-sm border border-line bg-surface-raised p-6 shadow-soft">
                  <h2 className="text-display-sm">Summary</h2>
                  <DeliveryOptions quote={quote} />
                  <CouponField quote={quote} />
                  <OrderSummary quote={quote} />
                  <ButtonLink to="/checkout" block size="lg" aria-disabled={quote.has_issues} className={quote.has_issues ? 'pointer-events-none opacity-50' : ''}>
                    <Lock className="h-4 w-4" aria-hidden="true" /> Checkout securely
                  </ButtonLink>
                  {quote.has_issues ? (
                    <p className="text-center text-sm text-danger">Please update the items marked above to continue.</p>
                  ) : null}
                  <p className="text-center text-xs text-ink-muted">
                    <Link to="/shop" className="link-underline">Continue shopping</Link>
                  </p>
                </div>
              </aside>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
