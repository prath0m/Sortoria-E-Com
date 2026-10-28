import { useParams } from 'react-router-dom';
import { useSale } from '@/api/hooks/offers';
import { ApiError } from '@/api/client';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Skeleton } from '@/components/ui/Skeleton';
import { Seo } from '@/lib/seo';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SaleSection } from './SaleSection';

export default function SalePage() {
  const { slug } = useParams();
  const { data, isLoading, error } = useSale(slug);
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  return (
    <div className="container-page py-8">
      {data ? <Seo title={data.title} description={data.subtitle} path={`/offers/sale/${data.slug}`} /> : null}
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Offers', to: '/offers' }, { label: data?.title ?? '…' }]} className="mb-6" />
      {isLoading || !data ? <Skeleton className="h-[32rem]" /> : <SaleSection sale={data} />}
    </div>
  );
}
