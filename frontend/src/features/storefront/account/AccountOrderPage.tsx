import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useOrder } from '@/api/hooks/orders';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { NotFoundPage } from '../pages/NotFoundPage';
import { OrderActions } from '../orders/OrderActions';
import { OrderView } from '../orders/OrderView';
import { statusTone } from './OrdersPage';

export default function AccountOrderPage() {
  const { number = '' } = useParams();
  const { data: order, isLoading, error } = useOrder(number);
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  if (isLoading || !order) return <Skeleton className="h-96" />;
  return (
    <div>
      <Link to="/account/orders" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All orders
      </Link>
      <div className="mb-8 mt-4 flex flex-wrap items-center gap-3">
        <h2 className="text-display-md">{order.number}</h2>
        <Badge tone={statusTone(order.status)}>{order.status_label}</Badge>
      </div>
      <OrderView order={order} actions={<OrderActions order={order} />} />
    </div>
  );
}
