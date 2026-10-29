import { Link } from 'react-router-dom';
import type { ProductCard } from '@/api/types';
import { Countdown } from '@/components/motion/Countdown';
import { Reveal } from '@/components/motion/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { Price } from '@/components/ui/Price';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';

/** A single daily deal, staged editorially with its countdown. */
export function DealSpotlight({ deal }: { deal: { title: string; subtitle: string; ends_at: string; products: ProductCard[] } }) {
  const product = deal.products[0];
  if (!product) return null;
  const image = product.images[0];
  return (
    <section className="container-page py-12 lg:py-16" aria-label="Deal of the day">
      <div className="grid overflow-hidden rounded-sm border border-line bg-surface-raised md:grid-cols-2">
        <Link to={`/products/${product.slug}`} className="block aspect-[4/3] bg-paper-200 md:aspect-auto">
          {image ? <ResponsiveImage src={image.url} renditions={image.renditions} alt={image.alt} sizes="(min-width: 768px) 50vw, 100vw" className="h-full w-full object-cover" /> : null}
        </Link>
        <Reveal className="flex flex-col justify-center p-8 md:p-14">
          <p className="eyebrow text-charcoal-700">Deal of the day</p>
          <h2 className="mt-3 text-display-lg">{product.name}</h2>
          <p className="mt-3 text-ink-soft">{deal.subtitle}</p>
          <Price className="mt-6" size="lg" price={product.price_paise} mrp={product.mrp_paise} />
          <p className="mb-3 mt-8 text-xs font-semibold text-ink-muted">Ends in</p>
          <Countdown to={deal.ends_at} />
          <ButtonLink to={`/products/${product.slug}`} size="lg" className="mt-10 self-start">
            Take a closer look
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}
