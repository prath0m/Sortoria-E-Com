import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { PageHeader } from '../components/PageHeader';
import { dateTime } from '../orders/types';
import { StateBadge } from '../offers/state';
import { Collection, RowText, Thumb, type FieldSpec } from './Collection';

const SECTION_TYPES = [
  { value: 'hero', label: 'Hero slider' },
  { value: 'featured_categories', label: 'Featured categories' },
  { value: 'trending', label: 'Trending now' },
  { value: 'new_arrivals', label: 'New arrivals' },
  { value: 'best_sellers', label: 'Best sellers' },
  { value: 'featured_products', label: 'Hand-picked products' },
  { value: 'flash_sale', label: 'Flash sale' },
  { value: 'daily_deals', label: 'Daily deals' },
  { value: 'bundles', label: 'Bundles' },
  { value: 'promo_banners', label: 'Promo banners' },
  { value: 'trust_badges', label: 'Trust badges' },
  { value: 'counters', label: 'Counters' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'newsletter', label: 'Newsletter sign-up' },
  { value: 'editorial', label: 'Editorial story' },
];
const PRODUCT_TYPES = ['trending', 'new_arrivals', 'best_sellers', 'featured_products'];
const typeLabel = (t: unknown) => SECTION_TYPES.find((s) => s.value === t)?.label ?? String(t);

const heading: FieldSpec[] = [
  { name: 'eyebrow', label: 'Eyebrow', type: 'text', optional: true, hint: 'Small label above the title.' },
  { name: 'title', label: 'Title', type: 'text', optional: true },
  { name: 'subtitle', label: 'Subtitle', type: 'text', optional: true },
];
const cta: FieldSpec[] = [
  { name: 'cta_label', label: 'Link label', type: 'text', optional: true },
  { name: 'cta_url', label: 'Link', type: 'text', optional: true, hint: 'A store path like /shop/audio or /offers.' },
];

function sectionFields(draft: Record<string, unknown>): FieldSpec[] {
  const type = String(draft.type);
  const fields: FieldSpec[] = [...heading];
  if (PRODUCT_TYPES.includes(type)) fields.push({ name: 'limit', label: 'How many products', type: 'number', min: 1, max: 24 });
  if (type === 'featured_products') fields.push({ name: 'products', label: 'Products', type: 'products', hint: 'Shown in the order added.' });
  if (type === 'featured_categories') fields.push({ name: 'categories', label: 'Categories', type: 'categories', hint: 'Hold Ctrl or Cmd to choose several. Each needs a tile image.' });
  if (type === 'editorial') {
    fields.push({ name: 'body', label: 'Story', type: 'textarea', rows: 5 });
    fields.push({ name: 'image', label: 'Image', type: 'image', aspect: 'aspect-[4/3]', clearable: true });
  }
  if (!['hero', 'trust_badges', 'counters', 'newsletter'].includes(type)) fields.push(...cta);
  fields.push({ name: 'is_active', label: 'Show on the homepage', type: 'checkbox' });
  return fields;
}

const scheduled: FieldSpec[] = [
  { name: 'starts_at', label: 'Show from', type: 'datetime', optional: true, hint: 'Blank shows straight away.' },
  { name: 'ends_at', label: 'Show until', type: 'datetime', optional: true },
  { name: 'is_active', label: 'Active', type: 'checkbox' },
];

const TABS = [
  { id: 'sections', label: 'Homepage' },
  { id: 'hero', label: 'Hero slides' },
  { id: 'banners', label: 'Promo banners' },
  { id: 'badges', label: 'Trust badges' },
  { id: 'counters', label: 'Counters' },
  { id: 'testimonials', label: 'Testimonials' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function NewSection({ onPick }: { onPick: (type: string) => void }) {
  return (
    <select aria-label="Add a section" value="" onChange={(e) => e.target.value && onPick(e.target.value)} className="h-9 rounded-xs border border-primary bg-primary px-3 text-xs font-semibold text-primary-on">
      <option value="">Add section…</option>
      {SECTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
  );
}

export default function ContentPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'sections') as Tab;
  const [creatingSection, setCreatingSection] = useState<Record<string, unknown> | null>(null);
  const placement = params.get('placement') ?? 'home';

  return (
    <>
      <PageHeader title="Homepage & content" eyebrow="Content">
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Everything on the homepage comes from here. Drag to reorder, switch off to hide, and changes show within a couple of minutes.</p>
      </PageHeader>
      <div role="tablist" aria-label="Content type" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setParams({ tab: t.id }, { replace: true })} className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm', tab === t.id ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sections' ? (
        <Collection
          resource="cms/sections"
          noun="section"
          fields={sectionFields}
          blank={() => ({})}
          newButton={<NewSection onPick={(type) => setCreatingSection({ type, limit: 8, is_active: true, products: [], categories: [], products_detail: [] })} />}
          creating={creatingSection}
          onCreatingDone={() => setCreatingSection(null)}
          emptyText="The homepage is empty. Add a hero slider to begin."
          renderRow={(s) => (
            <>
              <span className="w-36 shrink-0 text-xs font-semibold text-ink-muted">{typeLabel(s.type)}</span>
              <RowText title={String(s.title || '—')} sub={s.subtitle ? String(s.subtitle) : undefined} />
            </>
          )}
        />
      ) : null}

      {tab === 'hero' ? (
        <Collection
          resource="cms/hero-slides"
          noun="slide"
          emptyText="No slides yet. One strong image with a short line works best."
          blank={() => ({ headline: '', text_theme: 'light', text_align: 'left', is_active: true })}
          fields={[
            { name: 'image', label: 'Image', type: 'image', aspect: 'aspect-[16/9]', hint: 'At least 2400px wide. Keep the subject away from the text side.' },
            { name: 'mobile_image', label: 'Phone image', type: 'image', aspect: 'aspect-[3/4]', clearable: true, hint: 'Optional portrait crop.' },
            { name: 'image_alt', label: 'Image description', type: 'text', optional: true, hint: 'For screen readers.' },
            { name: 'eyebrow', label: 'Eyebrow', type: 'text', optional: true, maxLength: 60 },
            { name: 'headline', label: 'Headline', type: 'text', maxLength: 120 },
            { name: 'subtext', label: 'Supporting line', type: 'textarea', optional: true, rows: 2, maxLength: 240 },
            { name: 'cta_label', label: 'Button label', type: 'text', optional: true },
            { name: 'cta_url', label: 'Button link', type: 'text', optional: true },
            { name: 'secondary_cta_label', label: 'Second button label', type: 'text', optional: true },
            { name: 'secondary_cta_url', label: 'Second button link', type: 'text', optional: true },
            { name: 'text_theme', label: 'Text colour', type: 'select', options: [{ value: 'light', label: 'Light text (dark photos)' }, { value: 'dark', label: 'Dark text (light photos)' }] },
            { name: 'text_align', label: 'Text position', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }] },
            ...scheduled,
          ]}
          renderRow={(s) => (
            <>
              <Thumb src={s.image} wide />
              <RowText title={String(s.headline)} sub={s.starts_at || s.ends_at ? `${s.starts_at ? dateTime(String(s.starts_at)) : 'Now'} – ${s.ends_at ? dateTime(String(s.ends_at)) : 'open'}` : String(s.eyebrow ?? '')} />
              <StateBadge state={String(s.state)} />
            </>
          )}
        />
      ) : null}

      {tab === 'banners' ? (
        <>
          <div className="mb-3 flex gap-2" role="group" aria-label="Placement">
            {[{ v: 'home', l: 'Homepage' }, { v: 'offers', l: 'Offers page' }, { v: 'cart', l: 'Bag' }].map((p) => (
              <button key={p.v} type="button" aria-pressed={placement === p.v} onClick={() => setParams({ tab: 'banners', placement: p.v }, { replace: true })} className={cn('rounded-full border px-3 py-1 text-xs', placement === p.v ? 'border-primary bg-primary text-primary-on' : 'border-line text-ink-soft')}>
                {p.l}
              </button>
            ))}
          </div>
          <Collection
            key={placement}
            resource="cms/banners"
            noun="banner"
            filter={(b) => b.placement === placement}
            emptyText="No banners here yet."
            blank={() => ({ placement, title: '', is_active: true })}
            fields={[
              { name: 'image', label: 'Image', type: 'image', aspect: 'aspect-[16/9]' },
              { name: 'mobile_image', label: 'Phone image', type: 'image', aspect: 'aspect-[4/5]', clearable: true },
              { name: 'eyebrow', label: 'Eyebrow', type: 'text', optional: true },
              { name: 'title', label: 'Title', type: 'text' },
              { name: 'subtitle', label: 'Subtitle', type: 'text', optional: true },
              { name: 'badge_text', label: 'Badge', type: 'text', optional: true, hint: 'e.g. “Up to 40% off”.' },
              ...cta,
              ...scheduled,
            ]}
            renderRow={(b) => (
              <>
                <Thumb src={b.image} wide />
                <RowText title={String(b.title)} sub={String(b.subtitle ?? '')} />
                <StateBadge state={String(b.state)} />
              </>
            )}
          />
        </>
      ) : null}

      {tab === 'badges' ? (
        <Collection
          resource="cms/trust-badges"
          noun="badge"
          emptyText="No badges yet. Three or four promises is plenty."
          blank={() => ({ icon: 'truck', title: '', text: '', is_active: true })}
          fields={[
            { name: 'icon', label: 'Icon', type: 'select', options: [{ value: 'truck', label: 'Delivery truck' }, { value: 'return', label: 'Returns' }, { value: 'shield', label: 'Secure payment' }, { value: 'chat', label: 'Support' }, { value: 'gift', label: 'Gift wrapping' }, { value: 'leaf', label: 'Sustainability' }, { value: 'award', label: 'Quality' }] },
            { name: 'title', label: 'Title', type: 'text', maxLength: 60 },
            { name: 'text', label: 'Text', type: 'text', optional: true, maxLength: 160 },
            { name: 'is_active', label: 'Show', type: 'checkbox' },
          ]}
          renderRow={(b) => <RowText title={String(b.title)} sub={String(b.text ?? '')} />}
        />
      ) : null}

      {tab === 'counters' ? (
        <Collection
          resource="cms/counters"
          noun="counter"
          emptyText="No counters yet."
          blank={() => ({ value: 0, prefix: '', suffix: '', label: '', is_active: true })}
          fields={[
            { name: 'value', label: 'Number', type: 'number', min: 0 },
            { name: 'prefix', label: 'Before the number', type: 'text', optional: true, maxLength: 6 },
            { name: 'suffix', label: 'After the number', type: 'text', optional: true, maxLength: 12, hint: 'e.g. +, %, k' },
            { name: 'label', label: 'Label', type: 'text', maxLength: 60 },
            { name: 'is_active', label: 'Show', type: 'checkbox' },
          ]}
          renderRow={(c) => <RowText title={`${c.prefix ?? ''}${Number(c.value).toLocaleString('en-IN')}${c.suffix ?? ''}`} sub={String(c.label)} />}
        />
      ) : null}

      {tab === 'testimonials' ? (
        <Collection
          resource="cms/testimonials"
          noun="testimonial"
          emptyText="No testimonials yet. Real words from real patrons, lightly trimmed."
          blank={() => ({ name: '', location: '', quote: '', rating: 5, is_active: true })}
          fields={[
            { name: 'quote', label: 'Quote', type: 'textarea', rows: 4, maxLength: 600 },
            { name: 'name', label: 'Name', type: 'text' },
            { name: 'location', label: 'City', type: 'text', optional: true },
            { name: 'rating', label: 'Rating', type: 'number', min: 1, max: 5 },
            { name: 'avatar', label: 'Photo', type: 'image', aspect: 'aspect-square', clearable: true },
            { name: 'is_active', label: 'Show', type: 'checkbox' },
          ]}
          renderRow={(t) => (
            <>
              <Thumb src={t.avatar} />
              <RowText title={`“${String(t.quote)}”`} sub={`${t.name}${t.location ? `, ${t.location}` : ''} · ${t.rating}★`} />
            </>
          )}
        />
      ) : null}
    </>
  );
}
