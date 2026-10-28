import type { OrderDetail, OrderStatus } from '@/api/types';

export interface OrderRow {
  number: string;
  customer: string;
  email: string;
  phone: string;
  status: OrderStatus;
  status_label: string;
  payment_method: 'cod' | 'razorpay' | string;
  payment_status: string;
  grand_total_paise: number;
  item_count: number;
  shipping_method: string;
  created_at: string;
  placed_at: string | null;
}

export interface AdminOrder extends OrderDetail {
  internal_note: string;
  invoice_number: string;
  allowed_transitions: { status: OrderStatus; label: string }[];
  payments: {
    provider: string;
    provider_order_id: string;
    provider_payment_id: string;
    amount_paise: number;
    status: string;
    method: string;
    created_at: string;
    refunds: { amount_paise: number; status: string; reason: string; reference: string; created_at: string }[];
  }[];
  returns: { number: string; status: string; status_label: string }[];
  customer_id: number | null;
  customer_order_count: number;
  reservation_expires_at: string | null;
}

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'payment_failed', label: 'Payment failed' },
  { value: 'placed', label: 'Placed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const PAYMENT_LABEL: Record<string, string> = { cod: 'Cash on delivery', razorpay: 'Online' };

export const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
