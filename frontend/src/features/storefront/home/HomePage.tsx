import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProducts } from '@/api/hooks/catalog';
import { useNavigation, useStoreSettings } from '@/api/hooks/store';
import { BotanicalDivider, OrganicShape } from '@/components/brand/Illustrations';
import { Reveal } from '@/components/motion/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Seo } from '@/lib/seo';
import { ProductRail } from '../catalog/ProductRail';

const featured = new URLSearchParams('featured=1&page_size=12');
const newest = new URLSearchParams('sort=newest&page_size=12');

export default function HomePage() {
  const { data: store } = useStoreSettings();
  const { data: departments, isLoading } = useNavigation();
  const featuredQuery = useProducts(featured);
  const newestQuery = useProducts(newest);

  return (
    <>
      <Seo path="/" />
      <section className="grain relative overflow-hidden bg-cream-200/60">
        <OrganicShape className="absolute -right-24 -top-24 h-[30rem] w-[30rem]" tone="gold" />
        <OrganicShape className="absolute -bottom-40 -left-32 h-[26rem] w-[26rem]" />
        <div className="container-page relative z-[2] py-20 text-center md:py-28">
          <Reveal>
            <p className="eyebrow">{store?.name ?? 'Sartoria'}</p>
            <h1 className="mx-auto mt-4 max-w-3xl text-display-2xl">
              Fewer things, <em className="font-display italic text-burgundy-700">better made</em>
            </h1>
            {store?.tagline ? <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">{store.tagline}</p> : null}
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <ButtonLink to="/shop" size="lg">
                Explore the collection
              </ButtonLink>
              <ButtonLink to="/shop?sort=newest" size="lg" variant="secondary">
                New arrivals
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container-page py-16 lg:py-20" aria-labelledby="departments-heading">
        <Reveal className="mb-10 text-center">
          <p className="eyebrow">Departments</p>
          <h2 id="departments-heading" className="mt-2 text-display-lg">Shop by department</h2>
          <BotanicalDivider className="mt-5" />
        </Reveal>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 lg:gap-6">
          {isLoading
            ? Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-[4/5]" />)
            : departments?.map((d, i) => (
                <Reveal as="li" key={d.id} delay={(i % 5) * 0.06}>
                  <Link to={`/shop/${d.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-sm bg-cream-200">
                    {d.image ? (
                      <img src={d.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-1200 ease-luxe group-hover:scale-105" />
                    ) : null}
                    <span className="absolute inset-0 bg-gradient-to-t from-ink/65 via-ink/10 to-transparent" />
                    <span className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2 font-display text-xl text-cream-50 md:text-2xl">
                      {d.name}
                      <ArrowRight className="mb-1 h-4 w-4 shrink-0 -translate-x-2 opacity-0 transition-all duration-400 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
                    </span>
                  </Link>
                </Reveal>
              ))}
        </ul>
      </section>

      <ProductRail
        eyebrow="Chosen by our buyers"
        title="The edit"
        products={featuredQuery.data?.results}
        loading={featuredQuery.isLoading}
        action={<Link to="/shop?sort=popular" className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-burgundy-800 link-underline sm:inline">View all</Link>}
      />
      <ProductRail
        eyebrow="Just in"
        title="New arrivals"
        products={newestQuery.data?.results}
        loading={newestQuery.isLoading}
        action={<Link to="/shop?sort=newest" className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-burgundy-800 link-underline sm:inline">View all</Link>}
      />
    </>
  );
}
