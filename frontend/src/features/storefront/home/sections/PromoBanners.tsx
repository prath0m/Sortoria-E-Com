import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Banner } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useGsap } from '../useScrollTrigger';
import { toSrcSet } from '@/lib/srcset';

function BannerCard({ banner, large }: { banner: Banner; large?: boolean }) {
  return (
    <Link to={banner.cta_url || '/shop'} className={cn('group relative block overflow-hidden rounded-sm bg-shade', large ? 'h-[26rem] md:h-[34rem]' : 'h-[22rem] md:h-[26rem]')}>
      <picture className="absolute inset-[-12%_0] block" data-parallax>
        {banner.mobile_image ? <source media="(max-width: 767px)" srcSet={toSrcSet(banner.renditions?.mobile_image) ?? banner.mobile_image} sizes="100vw" /> : null}
        <img src={banner.image} srcSet={toSrcSet(banner.renditions?.image)} sizes={large ? '(min-width: 768px) 66vw, 100vw' : '(min-width: 768px) 33vw, 100vw'} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-1200 ease-luxe group-hover:scale-[1.03]" />
      </picture>
      <span className="absolute inset-0 bg-gradient-to-t from-shade/80 via-shade/25 to-transparent" />
      {banner.badge_text ? (
        <Badge tone="sale" className="absolute left-6 top-6">
          {banner.badge_text}
        </Badge>
      ) : null}
      <span className={cn('absolute inset-x-6 bottom-6 md:inset-x-10 md:bottom-10', large && 'max-w-xl')}>
        {banner.eyebrow ? <span className="eyebrow block text-iris-200">{banner.eyebrow}</span> : null}
        <span className={cn('mt-2 block font-display text-paper-50', large ? 'text-display-xl' : 'text-display-md')}>{banner.title}</span>
        {banner.subtitle ? <span className="mt-3 block max-w-md text-paper-100">{banner.subtitle}</span> : null}
        {banner.cta_label ? <span className={cn(buttonClasses({ variant: 'inverse', size: 'md' }), 'mt-6')}>{banner.cta_label}</span> : null}
      </span>
    </Link>
  );
}

/** First banner runs full width; the rest pair up. Images drift with a subtle parallax on scroll. */
export function PromoBanners({ banners }: { banners: Banner[] }) {
  const ref = useRef<HTMLElement>(null);
  useGsap(ref, ({ gsap }) => {
    gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
      gsap.fromTo(el, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: el.parentElement, scrub: true } });
    });
  }, [banners.length]);
  const [first, ...rest] = banners;
  return (
    <section ref={ref} className="container-page space-y-5 py-12 lg:py-16" aria-label="Featured stories">
      <BannerCard banner={first} large />
      {rest.length ? (
        <div className="grid gap-5 md:grid-cols-2">
          {rest.map((b) => (
            <BannerCard key={b.id} banner={b} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
