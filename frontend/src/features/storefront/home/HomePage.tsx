import { Link } from 'react-router-dom';
import { useHome } from '@/api/hooks/cms';
import type { HomeSectionData } from '@/api/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { Seo } from '@/lib/seo';
import { useStoreSettings } from '@/api/hooks/store';
import { ProductRail } from '../catalog/ProductRail';
import { BundleCard } from '../offers/BundleCard';
import { SaleSection } from '../offers/SaleSection';
import { CategoryShowcase } from './sections/CategoryShowcase';
import { Counters } from './sections/Counters';
import { DealSpotlight } from './sections/DealSpotlight';
import { Editorial } from './sections/Editorial';
import { HeroSlider } from './sections/HeroSlider';
import { NewsletterSection } from './sections/Newsletter';
import { PromoBanners } from './sections/PromoBanners';
import { SectionHeading } from './sections/SectionHeading';
import { Testimonials } from './sections/Testimonials';
import { TrustBadges } from './sections/TrustBadges';

function Section({ section }: { section: HomeSectionData }) {
  const cta = section.cta_label ? { label: section.cta_label, url: section.cta_url } : undefined;
  switch (section.type) {
    case 'hero':
      return <HeroSlider slides={section.data} />;
    case 'trust_badges':
      return <TrustBadges badges={section.data} />;
    case 'featured_categories':
      return <CategoryShowcase eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} categories={section.data} />;
    case 'trending':
    case 'new_arrivals':
    case 'best_sellers':
    case 'featured_products':
      return (
        <ProductRail
          eyebrow={section.eyebrow}
          title={section.title}
          products={section.data}
          action={
            cta ? (
              <Link to={cta.url} className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-burgundy-800 link-underline sm:inline">
                {cta.label}
              </Link>
            ) : undefined
          }
        />
      );
    case 'flash_sale':
      return (
        <div className="container-page py-12 lg:py-16">
          <SaleSection
            sale={{ id: section.id, kind: 'flash', title: section.data.title, slug: section.data.slug, subtitle: section.data.subtitle, banner_image: null, starts_at: '', ends_at: section.data.ends_at, is_live: true, products: section.data.products }}
            limit={4}
          />
        </div>
      );
    case 'daily_deals':
      return <DealSpotlight deal={section.data} />;
    case 'bundles':
      return (
        <section className="container-page py-12 lg:py-16">
          <SectionHeading eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} cta={{ label: 'All offers', url: '/offers' }} />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {section.data.map((b) => (
              <BundleCard key={b.slug} bundle={b} />
            ))}
          </div>
        </section>
      );
    case 'promo_banners':
      return <PromoBanners banners={section.data} />;
    case 'counters':
      return <Counters counters={section.data} />;
    case 'testimonials':
      return <Testimonials eyebrow={section.eyebrow} title={section.title} items={section.data} />;
    case 'editorial':
      return <Editorial eyebrow={section.eyebrow} title={section.title} body={section.body} image={section.image} renditions={section.renditions} cta={cta} />;
    case 'newsletter':
      return <NewsletterSection eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} />;
    default:
      return null;
  }
}

export default function HomePage() {
  const { data: sections, isLoading } = useHome();
  const { data: store } = useStoreSettings();
  return (
    <>
      <Seo
        path="/"
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'Organization', name: store?.name ?? 'Sartoria', url: window.location.origin, logo: `${window.location.origin}/icon-512.png` },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: store?.name ?? 'Sartoria',
            url: window.location.origin,
            potentialAction: { '@type': 'SearchAction', target: `${window.location.origin}/search?q={query}`, 'query-input': 'required name=query' },
          },
        ]}
      />
      {isLoading || !sections ? (
        <div role="status" aria-label="Loading">
          <Skeleton className="h-[78svh] w-full rounded-none md:h-[88vh]" />
        </div>
      ) : (
        sections.map((section) => <Section key={section.id} section={section} />)
      )}
    </>
  );
}
