import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { CheckoutResult, OrderDetail, OrderSummaryRow, Paginated, ReturnableItem, ReturnRequest } from '../types';

export function useCheckoutConfig() {
  return useQuery({
    queryKey: ['checkout-config'],
    queryFn: () => api<{ payment_methods: { code: string; name: string; prepaid: boolean }[] }>('/checkout/config/'),
    staleTime: 5 * 60_000,
  });
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<CheckoutResult>('/checkout/', { method: 'POST', body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });
}

export const orderKey = (number: string) => ['order', number] as const;

export function useOrder(number: string | undefined, token?: string | null) {
  return useQuery({
    queryKey: orderKey(number ?? ''),
    queryFn: () => api<OrderDetail>(`/orders/${number}/`, { query: { token: token ?? undefined } }),
    enabled: !!number,
  });
}

export function useRetryPayment(number: string, token?: string | null) {
  return useMutation({
    mutationFn: () => api<CheckoutResult>(`/checkout/${number}/retry-payment/`, { method: 'POST', body: { token } }),
  });
}

export function verifyRazorpay(body: Record<string, string>) {
  return api<OrderDetail>('/payments/razorpay/verify/', { method: 'POST', body });
}

export function reportPaymentFailure(body: { order_number: string; token: string; description: string }) {
  return api<OrderDetail>('/payments/razorpay/failed/', { method: 'POST', body });
}

export function invoiceUrl(number: string, token?: string | null) {
  return `/api/v1/orders/${number}/invoice/${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export function useMyOrders(page: number) {
  return useQuery({
    queryKey: ['orders', page],
    queryFn: () => api<Paginated<OrderSummaryRow>>('/orders/', { query: { page } }),
  });
}

export function useCancelOrder(number: string, token?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api<OrderDetail>(`/orders/${number}/cancel/`, { method: 'POST', body: { reason, token } }),
    onSuccess: (data) => {
      qc.setQueryData(orderKey(number), data);
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useTrackOrder() {
  return useMutation({
    mutationFn: (input: { number: string; contact: string }) => api<OrderDetail>('/orders/track/', { method: 'POST', body: input }),
  });
}

export function useReturnableItems(number: string, token?: string | null) {
  return useQuery({
    queryKey: ['returnable', number],
    queryFn: () =>
      api<{ order_number: string; payment_method: string; items: ReturnableItem[] }>(`/orders/${number}/returnable-items/`, {
        query: { token: token ?? undefined },
      }),
  });
}

export function useOrderReturns(number: string, token?: string | null) {
  return useQuery({
    queryKey: ['order-returns', number],
    queryFn: () => api<ReturnRequest[]>(`/orders/${number}/returns/`, { query: { token: token ?? undefined } }),
  });
}

export function useMyReturns() {
  return useQuery({ queryKey: ['returns'], queryFn: () => api<ReturnRequest[]>('/returns/') });
}

export function useReturn(number: string, token?: string | null) {
  return useQuery({
    queryKey: ['return', number],
    queryFn: () => api<ReturnRequest>(`/returns/${number}/`, { query: { token: token ?? undefined } }),
  });
}

export function useRequestReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api<ReturnRequest>('/returns/', { method: 'POST', body: form }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['order-returns', data.order_number] });
      qc.invalidateQueries({ queryKey: ['returnable', data.order_number] });
    },
  });
}
