import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Reveal } from '@/components/motion/Reveal';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Seo } from '@/lib/seo';
import { ListingView } from './ListingView';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const base = useMemo(() => ({}), []);
  return (
    <>
      <Seo title={q ? `Search: ${q}` : 'Search'} noindex />
      <header className="container-page pt-6">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Search' }]} />
        <Reveal className="mt-8">
          <p className="eyebrow">Search results</p>
          <h1 className="mt-2 text-display-xl">{q ? `“${q}”` : 'Everything'}</h1>
        </Reveal>
      </header>
      <div className="container-page mt-10">
        <ListingView
          base={base}
          emptyTitle={q ? `Nothing for “${q}” yet` : 'Nothing found'}
          emptyDescription="Check the spelling, try a broader word, or explore a department from the menu."
        />
      </div>
    </>
  );
}
