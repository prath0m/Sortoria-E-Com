import { useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useReturn } from '@/api/hooks/orders';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney } from '@/lib/money';
import { Seo } from '@/lib/seo';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ReturnTimeline } from './ReturnTimeline';

export default function ReturnDetailPage() {
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');
  const { data: ret, isLoading, error } = useReturn(number, token);
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  const orderLink = ret ? `/order/${ret.order_number}${token ? `?token=${encodeURIComponent(token)}` : ''}` : '/';
  return (
    <div className="container-page max-w-4xl py-10 lg:py-14">
      <Seo title={`Return ${number}`} noindex />
      {isLoading || !ret ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: `Order ${ret.order_number}`, to: orderLink }, { label: ret.number }]} />
          <p className="eyebrow mt-6">Return {ret.number}</p>
          <h1 className="mt-2 text-display-lg">{ret.status_label}</h1>
          <div className="mt-10 rounded-sm border border-line bg-surface-raised p-6">
            <ReturnTimeline ret={ret} />
          </div>
          {ret.admin_note ? <p className="mt-6 border-l-2 border-danger bg-danger/5 p-4 text-sm text-ink-soft">{ret.admin_note}</p> : null}
          {ret.pickup_date && ret.status === 'pickup_scheduled' ? (
            <p className="mt-6 text-ink-soft">
              Pickup on <strong className="text-ink">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ret.pickup_date))}</strong>. Please keep the parcel packed with its tags.
            </p>
          ) : null}
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <section>
              <h2 className="eyebrow mb-3">Pieces</h2>
              <ul className="space-y-3">
                {ret.items.map((item) => (
                  <li key={item.order_item_id} className="flex items-center gap-3 text-sm">
                    {item.image_url ? <img src={item.image_url} alt="" className="h-16 w-14 rounded-xs object-cover" /> : null}
                    <span>
                      {item.product_name}
                      <span className="block text-ink-muted">
                        {item.variant_label ? `${item.variant_label} · ` : ''}Qty {item.quantity}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="text-sm text-ink-soft">
              <h2 className="eyebrow mb-3">Details</h2>
              <p>Reason: {ret.reason_label}</p>
              <p className="mt-1">Resolution: {ret.resolution === 'refund' ? `Refund of ${formatMoney(ret.refund_amount_paise)}` : 'Replacement'}</p>
              {ret.comments ? <p className="mt-3 italic">“{ret.comments}”</p> : null}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
