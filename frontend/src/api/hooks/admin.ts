import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Kpi {
  value: number;
  previous: number | null;
  change: number | null;
}

export interface Dashboard {
  range: { label: string; start: string; end: string; granularity: 'hour' | 'day' | 'month' };
  kpis: Record<'revenue' | 'orders' | 'aov' | 'customers' | 'conversion' | 'pending_orders' | 'low_stock', Kpi>;
  visits: number;
  revenue_series: { bucket: string; revenue: number; orders: number }[];
  previous_revenue_series: { bucket: string; revenue: number; orders: number }[];
  orders_by_status: { label: string; count: number }[];
  top_products: { product_id: number; name: string; revenue: number; units: number }[];
  sales_by_category: { category: string; revenue: number }[];
  customer_split: { bucket: string; new: number; returning: number }[];
  recent_orders: { number: string; customer: string; email: string; total: number; status: string; status_label: string; created_at: string }[];
  low_stock: { variant_id: number; product_id: number; product: string; label: string; sku: string; stock: number; threshold: number }[];
}

export type RangeQuery = { range: string; from?: string; to?: string };

export function useDashboard(query: RangeQuery) {
  return useQuery({
    queryKey: ['admin', 'dashboard', query],
    queryFn: () => api<Dashboard>('/admin/analytics/dashboard/', { query }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export interface AdminNotification {
  id: number;
  kind: string;
  title: string;
  link: string;
  created_at: string;
  read: boolean;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () => api<{ unread: number; results: AdminNotification[] }>('/admin/notifications/'),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids?: number[]; all?: boolean }) => api<void>('/admin/notifications/', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notifications'] }),
  });
}

export interface SearchResults {
  orders: { number: string; email: string; status: string; total: number }[];
  products: { id: number; name: string; slug: string }[];
  customers: { id: number; name: string; email: string }[];
}

export function useAdminSearch(q: string) {
  return useQuery({
    queryKey: ['admin', 'search', q],
    queryFn: ({ signal }) => api<SearchResults>('/admin/search/', { query: { q }, signal }),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
}
