import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ProductCard as Product } from '@/api/types';
import { Price } from '@/components/ui/Price';
import { Rating } from '@/components/ui/Rating';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { cn } from '@/lib/cn';
import { useUI } from '@/stores/ui';
import { ProductBadges } from './ProductBadges';
import { WishlistHeart } from '../wishlist/WishlistHeart';

interface ProductCardProps {
  product: Product;
  view?: 'grid' | 'list';
  priority?: boolean;
  sizes?: string;
}

export function ProductCard({ product, view = 'grid', priority, sizes }: ProductCardProps) {
  const openQuickView = useUI((s) => s.openQuickView);
  const [first, second] = product.images;
  const href = `/products/${product.slug}`;
  const imageSizes = sizes ?? (view === 'list' ? '(min-width: 768px) 240px, 40vw' : '(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw');

  const media = (
    <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-cream-200">
      {first ? (
        <ResponsiveImage
          src={first.url}
          renditions={first.renditions}
          alt={first.alt}
          sizes={imageSizes}
          priority={priority}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-1200 ease-luxe group-hover:scale-[1.04]"
        />
      ) : null}
      {second ? (
        <ResponsiveImage
          src={second.url}
          renditions={second.renditions}
          alt=""
          aria-hidden="true"
          sizes={imageSizes}
          className="absolute inset-0 h-full w-full object-cover !opacity-0 transition-opacity duration-700 ease-luxe group-hover:!opacity-100"
        />
      ) : null}
      <ProductBadges product={product} className="absolute left-3 top-3 flex flex-col items-start gap-1.5" />
      <WishlistHeart productId={product.id} name={product.name} className="absolute right-3 top-3 z-[2]" />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          openQuickView(product.slug);
        }}
        className="absolute inset-x-3 bottom-3 z-[2] hidden translate-y-3 items-center justify-center gap-2 rounded-xs bg-surface-raised/95 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink opacity-0 shadow-soft backdrop-blur transition-all duration-400 ease-luxe hover:bg-surface-raised focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 md:flex"
        aria-label={`Quick view ${product.name}`}
      >
        <Eye className="h-4 w-4" aria-hidden="true" /> Quick view
      </button>
    </div>
  );

  const details = (
    <div className={cn('min-w-0', view === 'grid' ? 'mt-4 space-y-1' : 'space-y-2')}>
      {product.brand ? <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">{product.brand}</p> : null}
      <h3 className={cn('font-sans font-medium text-ink', view === 'grid' ? 'line-clamp-2 text-[0.9375rem]' : 'text-lg')}>
        <Link to={href} className="after:absolute after:inset-0">
          {product.name}
        </Link>
      </h3>
      {view === 'list' && product.short_description ? (
        <p className="line-clamp-2 max-w-prose text-sm text-ink-soft">{product.short_description}</p>
      ) : null}
      <Price price={product.price_paise} mrp={product.mrp_paise} maxPrice={product.max_price_paise} size="sm" />
      <Rating value={product.rating_avg} count={product.rating_count} />
      {product.swatches.length > 1 ? (
        <ul className="flex items-center gap-1.5 pt-1" aria-label={`${product.swatches.length} colours`}>
          {product.swatches.map((s) => (
            <li key={s.slug} title={s.value} className="h-3 w-3 rounded-full ring-1 ring-line-strong ring-offset-1 ring-offset-surface" style={{ backgroundColor: s.hex }} />
          ))}
        </ul>
      ) : null}
    </div>
  );

  return (
    <motion.article
      className={cn('group relative', view === 'list' && 'grid grid-cols-[minmax(0,10rem)_1fr] gap-5 sm:grid-cols-[14rem_1fr] sm:gap-8')}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {media}
      {details}
    </motion.article>
  );
}
