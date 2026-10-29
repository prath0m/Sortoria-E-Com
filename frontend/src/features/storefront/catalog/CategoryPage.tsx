import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useCategory } from '@/api/hooks/catalog';
import { useNavigation } from '@/api/hooks/store';
import { Reveal } from '@/components/motion/Reveal';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { breadcrumbJsonLd, Seo } from '@/lib/seo';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ListingView } from './ListingView';
import { toSrcSet } from '@/lib/srcset';

export default function CategoryPage() {
  const { slug } = useParams();
  const { data: category, isLoading, error } = useCategory(slug);
  const base = useMemo(() => ({ category: slug ?? '' }), [slug]);

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;

  const crumbs = [
    { label: 'Home', to: '/' },
    ...(category?.breadcrumbs ?? []).map((c, i, all) => ({ label: c.name, to: i < all.length - 1 ? `/shop/${c.slug}` : undefined })),
  ];
  const isDepartment = category && category.breadcrumbs.length === 1;
  const banner = category?.banner_image;

  return (
    <>
      {category ? (
        <Seo
          title={category.seo_title || category.name}
          description={category.seo_description || category.banner_subtext}
          image={banner}
          path={`/shop/${category.slug}`}
          jsonLd={breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            ...category.breadcrumbs.map((c) => ({ name: c.name, path: `/shop/${c.slug}` })),
          ])}
        />
      ) : null}

      {isLoading || !category ? (
        <div className="container-page pt-6">
          <Skeleton className="h-56 w-full md:h-80" />
        </div>
      ) : banner && isDepartment ? (
        <section className="relative isolate overflow-hidden">
          <picture>
            {category.banner_mobile_image ? (
              <source media="(max-width: 767px)" srcSet={toSrcSet(category.renditions?.banner_mobile_image) ?? category.banner_mobile_image} sizes="100vw" />
            ) : null}
            <img src={banner} srcSet={toSrcSet(category.renditions?.banner_image)} sizes="100vw" alt="" {...{ fetchpriority: 'high' }} className="absolute inset-0 -z-10 h-full w-full object-cover" />
          </picture>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-shade/70 via-shade/35 to-transparent" />
          <div className="container-page grain flex min-h-[18rem] flex-col justify-end py-10 md:min-h-[26rem] md:py-14">
            <Breadcrumbs items={crumbs} className="mb-auto text-paper-200 [&_a]:text-paper-100 [&_[aria-current]]:text-paper-50" />
            <Reveal>
              <p className="eyebrow text-iris-200">{category.name}</p>
              <h1 className="mt-3 max-w-2xl text-display-xl text-paper-50">{category.banner_headline || category.name}</h1>
              {category.banner_subtext ? <p className="mt-4 max-w-xl text-paper-100">{category.banner_subtext}</p> : null}
            </Reveal>
          </div>
        </section>
      ) : (
        <header className="container-page pt-6">
          <Breadcrumbs items={crumbs} />
          <Reveal className="mt-8">
            <h1 className="text-display-xl">{category.name}</h1>
            {category.banner_subtext ? <p className="mt-3 max-w-xl text-ink-soft">{category.banner_subtext}</p> : null}
          </Reveal>
        </header>
      )}

      {category?.children.length ? (
        <nav aria-label={`${category.name} categories`} className="container-page mt-8">
          <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {category.children.map((child) => (
              <li key={child.id} className="shrink-0">
                <Link
                  to={`/shop/${child.slug}`}
                  className="inline-flex rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-charcoal-800 hover:text-charcoal-800"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className={cn('container-page', category?.children.length ? 'mt-8' : 'mt-10')}>
        <ListingView base={base} />
      </div>
    </>
  );
}

export function ShopAllPage() {
  const { data: departments = [] } = useNavigation();
  const base = useMemo(() => ({}), []);
  return (
    <>
      <Seo title="Shop everything" path="/shop" />
      <header className="container-page pt-6">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Shop' }]} />
        <Reveal className="mt-8">
          <h1 className="text-display-xl">The whole collection</h1>
          <p className="mt-3 max-w-xl text-ink-soft">Every piece we stock, in one place. Refine by department, maker or detail.</p>
        </Reveal>
        <ul className="scrollbar-none -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {departments.map((d) => (
            <li key={d.id} className="shrink-0">
              <Link to={`/shop/${d.slug}`} className="inline-flex rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-charcoal-800 hover:text-charcoal-800">
                {d.name}
              </Link>
            </li>
          ))}
        </ul>
      </header>
      <div className="container-page mt-8">
        <ListingView base={base} />
      </div>
    </>
  );
}
