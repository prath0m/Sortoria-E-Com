import { useBanners } from '@/api/hooks/cms';
import { useBundles, useDailyDeals, useFlashSales } from '@/api/hooks/offers';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { BotanicalDivider } from '@/components/brand/Illustrations';
import { Reveal } from '@/components/motion/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Seo } from '@/lib/seo';
import { BundleCard } from './BundleCard';
import { SaleSection } from './SaleSection';

export default function OffersPage() {
  const flash = useFlashSales();
  const deals = useDailyDeals();
  const bundles = useBundles();
  const { data: banners } = useBanners('offers');
  const loading = flash.isLoading || deals.isLoading || bundles.isLoading;
  const nothing = !loading && !flash.data?.length && !deals.data?.length && !bundles.data?.length;

  return (
    <>
      <Seo title="Offers" description="Flash sales, daily deals and sets that cost less together." path="/offers" />
      <div className="container-page py-10 lg:py-14">
        <Reveal className="text-center">
          <p className="eyebrow">Offers</p>
          <h1 className="mt-2 text-display-xl">Rare markdowns, well chosen</h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            We don't run endless sales. When we do lower a price, it's on something worth owning.
          </p>
          <BotanicalDivider className="mt-6" />
        </Reveal>
        {loading ? (
          <div className="mt-12 space-y-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-64" />
          </div>
        ) : nothing ? (
          <EmptyState
            illustration="box"
            title="No offers running right now"
            description="Our next edit is being prepared. In the meantime, the full collection awaits."
            action={<ButtonLink to="/shop">Browse the collection</ButtonLink>}
          />
        ) : (
          <div className="mt-12 space-y-16">
            {banners?.map((b) => (
              <Link key={b.id} to={b.cta_url || '/shop'} className="group relative block h-56 overflow-hidden rounded-md md:h-72">
                <img src={b.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-1200 ease-luxe group-hover:scale-[1.03]" />
                <span className="absolute inset-0 bg-gradient-to-r from-ink/80 to-ink/10" />
                <span className="absolute inset-y-0 left-6 flex max-w-lg flex-col justify-center md:left-12">
                  {b.badge_text ? <Badge tone="sale" className="mb-3 self-start">{b.badge_text}</Badge> : null}
                  <span className="font-display text-display-md text-cream-50">{b.title}</span>
                  {b.subtitle ? <span className="mt-2 text-cream-100">{b.subtitle}</span> : null}
                </span>
              </Link>
            ))}
            {flash.data?.map((sale) => <SaleSection key={sale.id} sale={sale} limit={8} />)}
            {deals.data?.map((sale) => <SaleSection key={sale.id} sale={sale} />)}
            {bundles.data?.length ? (
              <section aria-labelledby="bundles-heading">
                <Reveal className="mb-8">
                  <p className="eyebrow">Better together</p>
                  <h2 id="bundles-heading" className="mt-2 text-display-lg">Sets &amp; bundles</h2>
                </Reveal>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {bundles.data.map((b) => (
                    <BundleCard key={b.slug} bundle={b} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
