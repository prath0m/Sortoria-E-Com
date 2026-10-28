import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { CheckoutResult, OrderDetail } from '../types';

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
