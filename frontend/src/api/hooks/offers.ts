import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { BundleOffer, DeliveryEstimate, Sale } from '../types';

export function useFlashSales() {
  return useQuery({ queryKey: ['offers', 'flash'], queryFn: () => api<Sale[]>('/offers/flash-sales/'), staleTime: 60_000 });
}

export function useDailyDeals() {
  return useQuery({ queryKey: ['offers', 'deals'], queryFn: () => api<Sale[]>('/offers/deals/'), staleTime: 60_000 });
}

export function useBundles() {
  return useQuery({ queryKey: ['offers', 'bundles'], queryFn: () => api<BundleOffer[]>('/offers/bundles/'), staleTime: 60_000 });
}

export function useBundle(slug: string | undefined) {
  return useQuery({
    queryKey: ['offers', 'bundle', slug],
    queryFn: () => api<BundleOffer>(`/offers/bundles/${slug}/`),
    enabled: !!slug,
  });
}

export function useSale(slug: string | undefined) {
  return useQuery({
    queryKey: ['offers', 'sale', slug],
    queryFn: () => api<Sale>(`/offers/flash-sales/${slug}/`),
    enabled: !!slug,
  });
}

export function useDeliveryEstimate(pincode: string, productSlug?: string) {
  return useQuery({
    queryKey: ['delivery', pincode, productSlug],
    queryFn: () => api<DeliveryEstimate>('/shipping/estimate/', { query: { pincode, product: productSlug } }),
    enabled: /^[1-9]\d{5}$/.test(pincode),
    staleTime: 10 * 60_000,
  });
}
