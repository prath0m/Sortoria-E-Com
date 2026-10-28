import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/stores/auth';
import { activeLines, useGuestCart, type CartLine } from '@/stores/cart';
import { useCheckoutPrefs } from '@/stores/checkoutPrefs';
import { api, ApiError } from '../client';
import type { Quote } from '../types';

export const cartKey = (scope: string, params: object) => ['cart', scope, params] as const;

export interface AddInput {
  line: Omit<CartLine, 'quantity' | 'savedForLater'>;
  quantity: number;
}

/**
 * One cart API for the whole storefront. Signed-in shoppers use the server cart; guests keep
 * lines in localStorage and get authoritative totals from POST /cart/quote.
 */
export function useCart(options: { paymentMethod?: string } = {}) {
  const status = useAuth((s) => s.status);
  const signedIn = status === 'authenticated';
  const qc = useQueryClient();
  const { pincode, shippingMethod, guestCoupon, setGuestCoupon } = useCheckoutPrefs();
  const guest = useGuestCart();
  const params = { pincode, shipping_method: shippingMethod, payment_method: options.paymentMethod ?? '' };

  const guestActive = activeLines(guest.lines);
  const guestPayload = guestActive.map((l) => ({ variant_id: l.variantId, quantity: l.quantity }));

  const server = useQuery({
    queryKey: cartKey('server', params),
    queryFn: () => api<Quote>('/cart/', { query: params }),
    enabled: signedIn,
    placeholderData: keepPreviousData,
  });

  const guestQuote = useQuery({
    queryKey: cartKey('guest', { ...params, lines: guestPayload, coupon: guestCoupon }),
    queryFn: () =>
      api<Quote>('/cart/quote/', {
        method: 'POST',
        body: { lines: guestPayload, coupon_code: guestCoupon, ...params },
      }),
    enabled: status === 'anonymous' && guestPayload.length > 0,
    placeholderData: keepPreviousData,
  });

  const setServer = (data: Quote) => {
    qc.setQueryData(cartKey('server', params), data);
    qc.invalidateQueries({ queryKey: ['cart', 'server'], refetchType: 'none' });
  };
  const onError = (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong.');

  const add = useMutation({
    mutationFn: async ({ line, quantity }: AddInput) => {
      if (!signedIn) {
        guest.add(line, quantity);
        return null;
      }
      return api<Quote>('/cart/items/', {
        method: 'POST',
        body: { variant_id: line.variantId, quantity },
        query: params,
      });
    },
    onSuccess: (data) => data && setServer(data),
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, variantId, quantity }: { id: number | null; variantId: number; quantity: number }) => {
      if (!signedIn) {
        guest.setQuantity(variantId, quantity);
        return Promise.resolve(null);
      }
      return api<Quote>(`/cart/items/${id}/`, { method: 'PATCH', body: { quantity }, query: params });
    },
    onSuccess: (data) => data && setServer(data),
    onError,
  });

  const remove = useMutation({
    mutationFn: ({ id, variantId }: { id: number | null; variantId: number }) => {
      if (!signedIn) {
        guest.remove(variantId);
        return Promise.resolve(null);
      }
      return api<Quote>(`/cart/items/${id}/`, { method: 'DELETE', query: params });
    },
    onSuccess: (data) => data && setServer(data),
    onError,
  });

  const setSaved = useMutation({
    mutationFn: ({ id, variantId, saved }: { id: number | null; variantId: number; saved: boolean }) => {
      if (!signedIn) {
        guest.setSaved(variantId, saved);
        return Promise.resolve(null);
      }
      const action = saved ? 'save-for-later' : 'move-to-cart';
      return api<Quote>(`/cart/items/${id}/${action}/`, { method: 'POST', query: params });
    },
    onSuccess: (data) => data && setServer(data),
    onError,
  });

  const applyCoupon = useMutation({
    mutationFn: async (code: string) => {
      if (signedIn) return api<Quote>('/cart/coupon/', { method: 'POST', body: { code }, query: params });
      const quote = await api<Quote>('/cart/quote/', {
        method: 'POST',
        body: { lines: guestPayload, coupon_code: code, ...params },
      });
      if (!quote.coupon?.applied) throw new ApiError(400, { detail: quote.coupon?.message ?? 'That code does not apply.' });
      setGuestCoupon(code.toUpperCase());
      return null;
    },
    onSuccess: (data) => data && setServer(data),
  });

  const removeCoupon = useMutation({
    mutationFn: async () => {
      if (signedIn) return api<Quote>('/cart/coupon/', { method: 'DELETE', query: params });
      setGuestCoupon('');
      return null;
    },
    onSuccess: (data) => data && setServer(data),
    onError,
  });

  const quote = signedIn ? server.data : guestPayload.length ? guestQuote.data : undefined;
  const saved = signedIn
    ? (server.data?.saved_for_later ?? [])
    : guest.lines.filter((l) => l.savedForLater);
  const count = signedIn ? (server.data?.item_count ?? 0) : guestActive.reduce((n, l) => n + l.quantity, 0);

  return {
    signedIn,
    quote,
    savedLines: saved,
    count,
    isLoading: signedIn ? server.isLoading : guestPayload.length > 0 && guestQuote.isLoading,
    isFetching: signedIn ? server.isFetching : guestQuote.isFetching,
    isEmpty: count === 0,
    add,
    update,
    remove,
    setSaved,
    applyCoupon,
    removeCoupon,
  };
}
