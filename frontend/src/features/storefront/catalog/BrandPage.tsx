import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useBrand } from '@/api/hooks/catalog';
import { Reveal } from '@/components/motion/Reveal';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Skeleton } from '@/components/ui/Skeleton';
import { Seo } from '@/lib/seo';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ListingView } from './ListingView';

export default function BrandPage() {
  const { slug = '' } = useParams();
  const { data: brand, error } = useBrand(slug);
  const base = useMemo(() => ({ brand: slug }), [slug]);
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  return (
    <>
      {brand ? <Seo title={brand.name} description={brand.description} path={`/brands/${brand.slug}`} /> : null}
      <header className="container-page pt-6">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Brands' }, { label: brand?.name ?? '…' }]} />
        <Reveal className="mt-8 max-w-2xl">
          <p className="eyebrow">The maker</p>
          {brand ? <h1 className="mt-2 text-display-xl">{brand.name}</h1> : <Skeleton className="mt-2 h-12 w-64" />}
          {brand?.description ? <p className="mt-3 text-ink-soft">{brand.description}</p> : null}
        </Reveal>
      </header>
      <div className="container-page mt-10">
        <ListingView base={base} hideBrands />
      </div>
    </>
  );
}
