import { Helmet } from 'react-helmet-async';
import { useStoreSettings } from '@/api/hooks/store';

interface SeoProps {
  title?: string;
  description?: string;
  image?: string | null;
  type?: 'website' | 'product' | 'article';
  path?: string;
  noindex?: boolean;
  jsonLd?: object | object[];
}

const absolute = (url?: string | null) => (url ? new URL(url, window.location.origin).toString() : undefined);

export function Seo({ title, description, image, type = 'website', path, noindex, jsonLd }: SeoProps) {
  const { data: store } = useStoreSettings();
  const name = store?.name ?? 'Sartoria';
  const fullTitle = title ? `${title} — ${store?.meta_title_suffix || name}` : `${name} — ${store?.tagline ?? ''}`.trim();
  const desc = description || store?.meta_description || '';
  const url = absolute(path ?? window.location.pathname);
  const img = absolute(image ?? store?.og_default_image ?? '/icon-512.png');
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {desc ? <meta name="description" content={desc} /> : null}
      {url ? <link rel="canonical" href={url} /> : null}
      {noindex ? <meta name="robots" content="noindex,follow" /> : null}
      <meta property="og:site_name" content={name} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      {desc ? <meta property="og:description" content={desc} /> : null}
      {url ? <meta property="og:url" content={url} /> : null}
      {img ? <meta property="og:image" content={img} /> : null}
      <meta name="twitter:card" content="summary_large_image" />
      {blocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: new URL(item.path, window.location.origin).toString(),
    })),
  };
}
