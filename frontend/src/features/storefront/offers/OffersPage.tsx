import { useBundles, useDailyDeals, useFlashSales } from '@/api/hooks/offers';
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
