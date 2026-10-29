import { useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { usePage } from '@/api/hooks/cms';
import { Reveal } from '@/components/motion/Reveal';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Skeleton } from '@/components/ui/Skeleton';
import { Seo } from '@/lib/seo';
import { NotFoundPage } from './NotFoundPage';

export default function CmsPage() {
  const { slug } = useParams();
  const { data: page, isLoading, error } = usePage(slug);
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  return (
    <article className="container-page max-w-3xl py-10 lg:py-16">
      {page ? <Seo title={page.seo_title || page.title} description={page.seo_description || page.summary} path={`/pages/${page.slug}`} type="article" /> : null}
      {isLoading || !page ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: page.title }]} />
          <Reveal className="mt-8 text-center">
            <h1 className="text-display-xl">{page.title}</h1>
            {page.summary ? <p className="mx-auto mt-4 max-w-xl text-lg text-ink-soft">{page.summary}</p> : null}
          </Reveal>
          {/* Page bodies are sanitised server-side (nh3) on save. */}
          <div className="prose-sartoria mx-auto mt-10" dangerouslySetInnerHTML={{ __html: page.body }} />
          <p className="mt-12 text-center text-xs text-ink-muted">
            Last updated {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(page.updated_at))}
          </p>
        </>
      )}
    </article>
  );
}
