import { useParams } from 'react-router-dom';
import { useBundle } from '@/api/hooks/offers';
import { ApiError } from '@/api/client';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Skeleton } from '@/components/ui/Skeleton';
import { Seo } from '@/lib/seo';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProductGrid } from '../catalog/ProductGrid';
import { BundleCard } from './BundleCard';

export default function BundlePage() {
  const { slug } = useParams();
  const { data, isLoading, error } = useBundle(slug);
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  return (
    <div className="container-page py-8">
      {data ? <Seo title={data.title} description={data.description} path={`/offers/bundles/${data.slug}`} /> : null}
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Offers', to: '/offers' }, { label: data?.title ?? '…' }]} className="mb-6" />
      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[24rem_1fr]">
          <div className="lg:sticky lg:top-[calc(var(--header-bottom,6rem)+1.5rem)] lg:self-start">
            <BundleCard bundle={data} />
          </div>
          <div>
            <h2 className="mb-6 text-display-sm">In this set</h2>
            <ProductGrid products={data.items.map((i) => i.product)} />
          </div>
        </div>
      )}
    </div>
  );
}
