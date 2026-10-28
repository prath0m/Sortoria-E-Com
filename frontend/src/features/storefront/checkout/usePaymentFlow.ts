import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useStoreSettings } from '@/api/hooks/store';
import { orderKey, reportPaymentFailure, verifyRazorpay } from '@/api/hooks/orders';
import { ApiError } from '@/api/client';
import type { CheckoutResult } from '@/api/types';
import { payWithRazorpay } from '@/lib/razorpay';
import { useGuestCart } from '@/stores/cart';

/** After an order exists: collect payment if needed, then land on the order page. */
export function usePaymentFlow() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: store } = useStoreSettings();
  const clearGuestCart = useGuestCart((s) => s.clear);

  return async ({ order, payment }: CheckoutResult, { fromCheckout }: { fromCheckout: boolean }) => {
    const orderPage = `/order/${order.number}?token=${encodeURIComponent(order.access_token)}`;
    const finish = (placed: boolean) => {
      navigate(`${orderPage}${placed && fromCheckout ? '&placed=1' : ''}`, { replace: fromCheckout });
      qc.invalidateQueries({ queryKey: orderKey(order.number) });
      // Empty the bag only after we've left checkout.
      window.setTimeout(() => {
        if (placed) clearGuestCart();
        qc.invalidateQueries({ queryKey: ['cart'] });
      }, 0);
    };
    if (!payment) return finish(true);

    try {
      const result = await payWithRazorpay(payment, {
        storeName: store?.name ?? 'Sartoria',
        description: `Order ${order.number}`,
        onFailed: (reason) => {
          reportPaymentFailure({ order_number: order.number, token: order.access_token, description: reason }).catch(() => undefined);
        },
      });
      if (!result) {
        toast("Payment wasn't completed", { description: 'Your order is saved. You can finish paying from the order page.' });
        return finish(false);
      }
      const verified = await verifyRazorpay({ order_number: order.number, token: order.access_token, ...result });
      qc.setQueryData(orderKey(order.number), verified);
      finish(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
      finish(false);
    }
  };
}
