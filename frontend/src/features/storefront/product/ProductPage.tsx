import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProduct, useProductBatch, useRelatedProducts } from '@/api/hooks/catalog';
import { ApiError } from '@/api/client';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Price } from '@/components/ui/Price';
import { Rating } from '@/components/ui/Rating';
import { Skeleton } from '@/components/ui/Skeleton';
import { track } from '@/lib/analytics';
import { breadcrumbJsonLd, Seo } from '@/lib/seo';
import { useRecentlyViewed } from '@/stores/recentlyViewed';
import { NotFoundPage } from '@/features/storefront/pages/NotFoundPage';
import { ProductBadges } from '../catalog/ProductBadges';
import { ProductRail } from '../catalog/ProductRail';
import { VariantSelector } from '../catalog/VariantSelector';
import { findVariant, imagesForSelection, initialSelection, type Selection } from '../catalog/variants';
import { Gallery } from './Gallery';
import { ProductDetails } from './ProductDetails';
import { ProductPurchase } from './ProductPurchase';
import { ReviewsSection } from './ReviewsSection';
import { PincodeChecker } from './PincodeChecker';
import { ShareMenu } from './ShareMenu';
import { WishlistHeart } from '../wishlist/WishlistHeart';
import { StickyPurchaseBar } from './StickyPurchaseBar';

export default function ProductPage() {
  const { slug } = useParams();
  const { data: product, isLoading, error } = useProduct(slug);
  const related = useRelatedProducts(slug);
  const [selection, setSelection] = useState<Selection>({});
  const purchaseRef = useRef<HTMLDivElement>(null);
  const addRecent = useRecentlyViewed((s) => s.add);
  const recentIds = useRecentlyViewed((s) => s.ids);
  const otherRecent = useMemo(() => recentIds.filter((id) => id !== product?.id).slice(0, 10), [recentIds, product?.id]);
  const recent = useProductBatch(otherRecent);

  useEffect(() => {
    if (!product) return;
    setSelection(initialSelection(product.variants));
    addRecent(product.id);
    track(`/products/${product.slug}`, { product_id: product.id });
  }, [product, addRecent]);

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  if (isLoading || !product) return <ProductPageSkeleton />;

  const variant = findVariant(product.variants, product.axes, selection);
  const images = imagesForSelection(product.images, selection);
  const crumbs = [
    { label: 'Home', to: '/' },
    ...product.breadcrumbs.map((c) => ({ label: c.name, to: `/shop/${c.slug}` })),
    { label: product.name },
  ];
  const price = variant?.price_paise ?? product.price_paise;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.short_description,
      image: product.images.map((i) => new URL(i.url, window.location.origin).toString()),
      sku: variant?.sku,
      brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
      category: product.category.name,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'INR',
        lowPrice: (Math.min(...product.variants.map((v) => v.price_paise)) / 100).toFixed(2),
        highPrice: (Math.max(...product.variants.map((v) => v.price_paise)) / 100).toFixed(2),
        offerCount: product.variants.length,
        availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      },
      aggregateRating: product.rating_count
        ? { '@type': 'AggregateRating', ratingValue: product.rating_avg, reviewCount: product.rating_count }
        : undefined,
    },
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      ...product.breadcrumbs.map((c) => ({ name: c.name, path: `/shop/${c.slug}` })),
      { name: product.name, path: `/products/${product.slug}` },
    ]),
  ];

  return (
    <>
      <Seo
        title={product.seo_title || product.name}
        description={product.seo_description || product.short_description}
        image={product.images[0]?.renditions['1200'] ?? product.images[0]?.url}
        type="product"
        path={`/products/${product.slug}`}
        jsonLd={jsonLd}
      />
      <div className="container-page pt-6 lg:pt-8">
        <Breadcrumbs items={crumbs} className="mb-6" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 xl:gap-20">
          <Gallery images={images} name={product.name} />
          <div className="lg:sticky lg:top-[calc(var(--header-bottom,6rem)+1.5rem)] lg:self-start">
            <ProductBadges product={{ ...product, brand: product.brand?.name ?? null, category: product.category.name }} className="mb-4 flex gap-2" />
            {product.brand ? <p className="eyebrow">{product.brand.name}</p> : null}
            <div className="mt-2 flex items-start justify-between gap-4">
              <h1 className="text-display-lg">{product.name}</h1>
              <WishlistHeart productId={product.id} name={product.name} size="lg" className="shrink-0" />
            </div>
            {product.rating_count ? (
              <a href="#reviews" className="mt-3 inline-block hover:opacity-80">
                <Rating value={product.rating_avg} count={product.rating_count} />
              </a>
            ) : null}
            <Price className="mt-5" size="lg" price={price} mrp={variant?.mrp_paise ?? product.mrp_paise} />
            <p className="mt-1 text-xs text-ink-muted">Inclusive of all taxes</p>
            <p className="mt-6 text-ink-soft">{product.short_description}</p>
            {product.highlights.length ? (
              <ul className="mt-5 space-y-1.5 text-sm text-ink-soft">
                {product.highlights.map((h) => (
                  <li key={h} className="flex gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rotate-45 bg-gold-500" aria-hidden="true" />
                    {h}
                  </li>
                ))}
              </ul>
            ) : null}
            {product.axes.length ? (
              <div className="mt-8">
                <VariantSelector axes={product.axes} variants={product.variants} selection={selection} onChange={setSelection} />
              </div>
            ) : null}
            <div ref={purchaseRef} className="mt-8">
              <ProductPurchase product={product} variant={variant} />
            </div>
            <div className="mt-6">
              <PincodeChecker productSlug={product.slug} />
            </div>
            <div className="mt-8">
              <ShareMenu title={product.name} image={product.images[0]?.url} />
            </div>
            <div className="mt-8">
              <ProductDetails product={product} />
            </div>
          </div>
        </div>
      </div>
      <ReviewsSection slug={product.slug} productName={product.name} />
      <ProductRail title="You may also like" eyebrow="Considered pairings" products={related.data} loading={related.isLoading} />
      {otherRecent.length ? <ProductRail title="Recently viewed" eyebrow="Pick up where you left off" products={recent.data} loading={recent.isLoading} /> : null}
      <StickyPurchaseBar
        watch={purchaseRef}
        name={product.name}
        variant={variant}
        onAdd={() => purchaseRef.current?.querySelector<HTMLButtonElement>('[data-add-to-bag]')?.click()}
      />
    </>
  );
}

function ProductPageSkeleton() {
  return (
    <div className="container-page pt-8" role="status" aria-label="Loading product">
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
        <Skeleton className="aspect-[4/5] w-full" />
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
