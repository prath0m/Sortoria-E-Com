import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, CreditCard } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { useOrder, useRetryPayment } from '@/api/hooks/orders';
import { BotanicalDivider } from '@/components/brand/Illustrations';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/PageLoader';
import { Seo } from '@/lib/seo';
import { NotFoundPage } from '../pages/NotFoundPage';
import { usePaymentFlow } from '../checkout/usePaymentFlow';
import { OrderActions } from './OrderActions';
import { OrderView } from './OrderView';

function SuccessMark() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 80 80" className="mx-auto h-20 w-20" aria-hidden="true">
      <motion.circle
        cx="40"
        cy="40"
        r="36"
        fill="none"
        stroke="rgb(var(--gold-400))"
        strokeWidth="2"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
      />
      <motion.path
        d="M25 41 L36 52 L56 30"
        fill="none"
        stroke="rgb(var(--burgundy-800))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: reduce ? 0 : 0.7 }}
      />
    </svg>
  );
}

export default function OrderPage() {
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');
  const justPlaced = params.get('placed') === '1';
  const { data: order, isLoading, error } = useOrder(number, token);
  const retry = useRetryPayment(number, token);
  const pay = usePaymentFlow();

  if (isLoading) return <PageLoader />;
  if ((error instanceof ApiError && error.status === 404) || !order) return <NotFoundPage />;

  const awaitingPayment = order.status === 'pending_payment' || order.status === 'payment_failed';
  const firstName = order.shipping_address.full_name.split(' ')[0];

  return (
    <>
      <Seo title={`Order ${order.number}`} noindex />
      <div className="container-page py-10 lg:py-14">
        <header className="mx-auto max-w-2xl text-center">
          {justPlaced && !awaitingPayment ? (
            <>
              <SuccessMark />
              <p className="eyebrow mt-6">Order {order.number}</p>
              <h1 className="mt-2 text-display-xl">Thank you, {firstName}</h1>
              <p className="mt-4 text-ink-soft">
                Your order is in good hands. A confirmation is on its way to <strong className="text-ink">{order.email}</strong>
                {order.estimated_delivery_date
                  ? `, and we expect it to reach you by ${new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(order.estimated_delivery_date))}.`
                  : '.'}
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">Order {order.number}</p>
              <h1 className="mt-2 text-display-lg">{order.status_label}</h1>
            </>
          )}
          <BotanicalDivider className="mt-8" />
        </header>

        {awaitingPayment ? (
          <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-4 rounded-sm border border-gold-500 bg-gold-50 p-6 text-center">
            <AlertCircle className="h-6 w-6 text-gold-800" aria-hidden="true" />
            <p className="text-ink">
              {order.status === 'payment_failed'
                ? "Your payment didn't go through, and no money was taken. Your pieces are still set aside while stock lasts."
                : 'We are holding your pieces while you complete payment.'}
            </p>
            <Button
              icon={<CreditCard className="h-4 w-4" />}
              loading={retry.isPending}
              onClick={async () => {
                try {
                  await pay(await retry.mutateAsync(), { fromCheckout: false });
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : 'Payment could not be started.');
                }
              }}
            >
              Complete payment
            </Button>
          </div>
        ) : null}

        <div className="mt-12">
          <OrderView
            order={order}
            actions={
              <div className="flex flex-col gap-3">
                <OrderActions order={order} token={token} />
                {justPlaced ? (
                  <ButtonLink to="/shop" variant="secondary" block>
                    Continue browsing
                  </ButtonLink>
                ) : null}
              </div>
            }
          />
        </div>
      </div>
    </>
  );
}
