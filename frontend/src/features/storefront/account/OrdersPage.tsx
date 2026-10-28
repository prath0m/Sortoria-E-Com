import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyOrders } from '@/api/hooks/orders';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney } from '@/lib/money';

const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function statusTone(status: string) {
  if (status === 'delivered') return 'success' as const;
  if (status === 'cancelled' || status === 'payment_failed') return 'muted' as const;
  return 'outline' as const;
}

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyOrders(page);
  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.results.length) {
    return (
      <EmptyState
        illustration="box"
        title="No orders yet"
        description="When you place an order, you'll find it here with tracking, invoices and returns."
        action={<ButtonLink to="/shop">Start browsing</ButtonLink>}
      />
    );
  }
  return (
    <section aria-labelledby="orders-heading">
      <h2 id="orders-heading" className="text-display-sm">Orders</h2>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {data.results.map((order) => (
          <li key={order.number}>
            <Link to={`/account/orders/${order.number}`} className="group flex items-center gap-4 py-5">
              <div className="flex -space-x-4">
                {order.preview_images.slice(0, 3).map((src) => (
                  <img key={src} src={src} alt="" loading="lazy" className="h-16 w-14 rounded-xs object-cover ring-2 ring-surface" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{order.number}</p>
                <p className="text-sm text-ink-muted">
                  {date.format(new Date(order.placed_at ?? order.created_at))} · {order.item_count} {order.item_count === 1 ? 'item' : 'items'} ·{' '}
                  {formatMoney(order.grand_total_paise)}
                </p>
              </div>
              <Badge tone={statusTone(order.status)}>{order.status_label}</Badge>
              <ChevronRight className="h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <Pagination className="mt-8" page={data.page} totalPages={data.total_pages} onChange={setPage} />
    </section>
  );
}
