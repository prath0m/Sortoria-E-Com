import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Collection, RowText } from './Collection';

export default function PagesPage() {
  return (
    <>
      <PageHeader title="Pages" eyebrow="Content">
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Policies and stories: About, Shipping, Returns, Privacy and Terms. Pages marked for the footer appear there in this order.</p>
      </PageHeader>
      <Collection
        resource="cms/pages"
        noun="page"
        emptyText="No pages yet. Start with your shipping and returns policies."
        blank={() => ({ title: '', slug: '', summary: '', body: '', seo_title: '', seo_description: '', show_in_footer: true, is_active: true })}
        fields={[
          { name: 'title', label: 'Title', type: 'text' },
          { name: 'slug', label: 'URL slug', type: 'text', optional: true, hint: 'Leave blank to generate. Lives at /pages/<slug>.' },
          { name: 'summary', label: 'Summary', type: 'textarea', rows: 2, optional: true, maxLength: 300 },
          { name: 'body', label: 'Body', type: 'textarea', rows: 14, hint: 'Basic HTML: headings (h2, h3), paragraphs, lists, bold, italics and links. Anything else is removed.' },
          { name: 'seo_title', label: 'Meta title', type: 'text', optional: true, maxLength: 120 },
          { name: 'seo_description', label: 'Meta description', type: 'textarea', rows: 2, optional: true, maxLength: 300 },
          { name: 'show_in_footer', label: 'Link from the footer', type: 'checkbox' },
          { name: 'is_active', label: 'Published', type: 'checkbox' },
        ]}
        renderRow={(p) => (
          <>
            <RowText title={String(p.title)} sub={`/pages/${p.slug}`} />
            {p.show_in_footer ? <StatusBadge status="confirmed" label="Footer" /> : null}
          </>
        )}
      />
    </>
  );
}
