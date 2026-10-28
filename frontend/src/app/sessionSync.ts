import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { onLogin } from '@/stores/auth';
import { useGuestCart } from '@/stores/cart';
import { useCheckoutPrefs } from '@/stores/checkoutPrefs';
import { useGuestWishlist } from '@/stores/wishlist';

/** After sign-in, fold the guest bag and wishlist into the account, then clear the local copies. */
export function installSessionSync(queryClient: QueryClient) {
  return onLogin(async () => {
    const lines = useGuestCart.getState().lines;
    const wishlist = useGuestWishlist.getState().ids;
    const coupon = useCheckoutPrefs.getState().guestCoupon;
    try {
      if (lines.length) {
        await api('/cart/merge/', {
          method: 'POST',
          body: {
            lines: lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity, saved_for_later: l.savedForLater })),
          },
        });
        useGuestCart.getState().clear();
      }
      if (coupon) {
        await api('/cart/coupon/', { method: 'POST', body: { code: coupon } }).catch(() => undefined);
        useCheckoutPrefs.getState().setGuestCoupon('');
      }
      if (wishlist.length) {
        await api('/wishlist/merge/', { method: 'POST', body: { product_ids: wishlist } });
        useGuestWishlist.getState().clear();
      }
    } finally {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    }
  });
}
