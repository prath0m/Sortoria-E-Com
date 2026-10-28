import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMyReturns } from '@/api/hooks/orders';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ReturnsPage() {
  const { data, isLoading } = useMyReturns();
  if (isLoading) return <Skeleton className="h-48" />;
  if (!data?.length) {
    return (
      <EmptyState
        illustration="box"
        title="No returns"
        description="If something isn't right, you can request a return or replacement from any delivered order."
      />
    );
  }
  return (
    <section aria-labelledby="returns-heading">
      <h2 id="returns-heading" className="text-display-sm">Returns</h2>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {data.map((r) => (
          <li key={r.number}>
            <Link to={`/returns/${r.number}`} className="group flex items-center gap-4 py-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.number}</p>
                <p className="text-sm text-ink-muted">
                  Order {r.order_number} · {r.items.map((i) => i.product_name).join(', ')}
                </p>
              </div>
              <Badge tone={r.status === 'refunded' || r.status === 'replaced' ? 'success' : r.status === 'rejected' ? 'muted' : 'outline'}>
                {r.status_label}
              </Badge>
              <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
