import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCart } from '@/api/hooks/cart';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney } from '@/lib/money';
import { useGuestCart } from '@/stores/cart';
import { CartLineItem } from './CartLineItem';
import { FreeShippingProgress } from './FreeShippingProgress';

export function MiniCartDrawer() {
  const open = useGuestCart((s) => s.drawerOpen);
  const setOpen = useGuestCart((s) => s.setDrawerOpen);
  const { quote, isLoading, isEmpty, count } = useCart();
  const { pathname } = useLocation();
  const close = () => setOpen(false);

  useEffect(() => close(), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Drawer
      open={open}
      onClose={close}
      title={`Your bag${count ? ` (${count})` : ''}`}
      footer={
        quote && !isEmpty ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-soft">Subtotal</span>
              <span className="font-display text-xl">{formatMoney(quote.subtotal_paise - quote.bundle_discount_paise - (quote.coupon?.discount_paise ?? 0))}</span>
            </div>
            <p className="text-xs text-ink-muted">Shipping and GST are calculated at checkout.</p>
            <ButtonLink to="/checkout" block size="lg" onClick={close}>
              Checkout
            </ButtonLink>
            <ButtonLink to="/cart" block variant="secondary" onClick={close}>
              View bag
            </ButtonLink>
          </div>
        ) : null
      }
    >
      {isEmpty ? (
        <EmptyState
          illustration="bag"
          title="Your bag is waiting to be filled"
          description="Considered pieces, chosen for how well they're made. Start with something you'll keep."
          action={<Button onClick={close}>Continue browsing</Button>}
        />
      ) : isLoading || !quote ? (
        <div className="space-y-4 p-5">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="px-5">
          <div className="pt-4">
            <FreeShippingProgress quote={quote} />
          </div>
          <ul className="divide-y divide-line">
            {quote.lines.map((line) => (
              <CartLineItem key={line.variant_id} line={line} compact onNavigate={close} />
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
