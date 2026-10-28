import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProduct } from '@/api/hooks/catalog';
import { Modal } from '@/components/ui/Overlay';
import { Price } from '@/components/ui/Price';
import { Rating } from '@/components/ui/Rating';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { Skeleton } from '@/components/ui/Skeleton';
import { useUI } from '@/stores/ui';
import { ProductPurchase } from '../product/ProductPurchase';
import { findVariant, imagesForSelection, initialSelection, type Selection } from './variants';
import { VariantSelector } from './VariantSelector';

export function QuickView() {
  const slug = useUI((s) => s.quickViewSlug);
  const close = useUI((s) => s.closeQuickView);
  const { data: product, isLoading } = useProduct(slug ?? undefined);
  const [selection, setSelection] = useState<Selection>({});

  useEffect(() => {
    if (product) setSelection(initialSelection(product.variants));
  }, [product]);

  const variant = product ? findVariant(product.variants, product.axes, selection) : undefined;
  const image = product ? imagesForSelection(product.images, selection)[0] : undefined;

  return (
    <Modal open={!!slug} onClose={close} title={product?.name ?? 'Quick view'} hideTitle className="max-w-4xl">
      {isLoading || !product ? (
        <div className="grid gap-6 p-6 md:grid-cols-2">
          <Skeleton className="aspect-[4/5]" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 px-5 pb-6 md:grid-cols-2 md:gap-8 md:px-6">
          <div className="aspect-[4/5] overflow-hidden rounded-sm bg-cream-200">
            {image ? (
              <ResponsiveImage src={image.url} renditions={image.renditions} alt={image.alt} sizes="(min-width: 768px) 420px, 90vw" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-col">
            {product.brand ? <p className="eyebrow">{product.brand.name}</p> : null}
            <h2 className="mt-2 text-display-md">{product.name}</h2>
            <Rating value={product.rating_avg} count={product.rating_count} className="mt-2" />
            <Price
              className="mt-4"
              size="lg"
              price={variant?.price_paise ?? product.price_paise}
              mrp={variant?.mrp_paise ?? product.mrp_paise}
            />
            <p className="mt-4 text-sm text-ink-soft">{product.short_description}</p>
            {product.axes.length ? (
              <div className="mt-6">
                <VariantSelector axes={product.axes} variants={product.variants} selection={selection} onChange={setSelection} />
              </div>
            ) : null}
            <div className="mt-6">
              <ProductPurchase product={product} variant={variant} compact onAdded={close} />
            </div>
            <Link
              to={`/products/${product.slug}`}
              onClick={close}
              className="link-underline mt-6 inline-flex w-fit items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-burgundy-800"
            >
              View full details <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
