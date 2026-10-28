import type { RazorpayPayload } from '@/api/types';

const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: { error: { description: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null;
        reject(new Error("We couldn't load the secure payment window. Please check your connection."));
      };
      document.body.appendChild(script);
    });
  }
  return loading;
}

/** Open Razorpay Checkout. Resolves with the signed result, or `null` if the shopper closes it. */
export async function payWithRazorpay(
  payment: RazorpayPayload,
  { storeName, description, onFailed }: { storeName: string; description: string; onFailed: (reason: string) => void },
): Promise<RazorpaySuccess | null> {
  await loadRazorpay();
  return new Promise((resolve) => {
    const instance = new window.Razorpay!({
      key: payment.key_id,
      order_id: payment.razorpay_order_id,
      amount: payment.amount,
      currency: payment.currency,
      name: storeName,
      description,
      image: `${window.location.origin}/icon-512.png`,
      prefill: payment.prefill,
      theme: { color: '#590907' },
      handler: (response: RazorpaySuccess) => resolve(response),
      modal: { ondismiss: () => resolve(null), confirm_close: true },
    });
    instance.on('payment.failed', (response) => onFailed(response.error.description));
    instance.open();
  });
}
