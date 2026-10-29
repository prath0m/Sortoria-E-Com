import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/api/client';
import { qk } from '@/api/queryKeys';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextArea, TextField } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { INDIAN_STATES } from '@/lib/states';
import { ErrorState } from '../components/ErrorState';
import { ImageInput } from '../components/ImageInput';
import { filesForm, type FileChange } from '../components/files';
import { MoneyInput } from '../components/inputs';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';

type Settings = Record<string, string | number | boolean | null>;
const IMAGE_FIELDS = ['logo', 'logo_monogram', 'favicon', 'og_default_image'] as const;
type ImageField = (typeof IMAGE_FIELDS)[number];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<Settings>('/admin/settings/') });
  const [draft, setDraft] = useState<Settings | null>(null);
  const [files, setFiles] = useState<Record<ImageField, FileChange>>({ logo: null, logo_monogram: null, favicon: null, og_default_image: null });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !draft) return <Skeleton className="h-[40rem]" />;

  const text = (name: string) => String(draft[name] ?? '');
  const set = (name: string, value: Settings[string]) => setDraft((d) => (d ? { ...d, [name]: value } : d));
  const field = (name: string, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <TextField label={label} value={text(name)} error={errors[name]?.[0]} onChange={(e) => set(name, e.target.value)} {...extra} />
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(data) || Object.values(files).some((f) => f !== null);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const body = Object.fromEntries(Object.entries(draft).filter(([k]) => !IMAGE_FIELDS.includes(k as ImageField) && k !== 'state_code'));
    try {
      let saved = await api<Settings>('/admin/settings/', { method: 'PATCH', body });
      const form = filesForm(files);
      if (form) saved = await api<Settings>('/admin/settings/', { method: 'PATCH', body: form });
      qc.setQueryData(['admin', 'settings'], saved);
      // The public settings response is HTTP-cached for a minute; update this tab's copy directly.
      qc.setQueryData(qk.settings, (current: object | undefined) => (current ? { ...current, ...saved } : current));
      setFiles({ logo: null, logo_monogram: null, favicon: null, og_default_image: null });
      toast.success('Settings saved. The storefront updates within a minute.');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors);
        toast.error('Please fix the highlighted fields.');
      } else toast.error(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const image = (name: ImageField, label: string, hint: string, aspect: string) => (
    <ImageInput label={label} hint={hint} aspect={aspect} fit="contain" clearable current={draft[name] as string | null} file={files[name]} onChange={(f) => setFiles((x) => ({ ...x, [name]: f }))} />
  );

  return (
    <>
      <PageHeader title="Store settings" eyebrow="Store" actions={<Button onClick={save} loading={saving} disabled={!dirty}>Save settings</Button>} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Brand" description="Uploaded logos replace the built-in Sartoria wordmark everywhere: header, emails and invoices.">
          {field('name', 'Store name')}
          {field('tagline', 'Tagline', { optional: true })}
          <div className="grid grid-cols-2 gap-4">
            {image('logo', 'Wordmark', 'PNG with transparency, at least 600px wide.', 'aspect-[3/1]')}
            {image('logo_monogram', 'Monogram', 'Square mark for small spaces.', 'aspect-[3/1]')}
            {image('favicon', 'Browser icon', 'Square, 256px.', 'aspect-[3/1]')}
            {image('og_default_image', 'Sharing image', 'Shown when links are shared, 1200×630.', 'aspect-[3/1]')}
          </div>
        </Section>
        <Section title="Contact" description="Shown in the footer, on the contact page and in every email.">
          {field('contact_email', 'Email', { type: 'email' })}
          <div className="grid gap-4 sm:grid-cols-2">
            {field('support_phone', 'Phone', { optional: true })}
            {field('whatsapp', 'WhatsApp', { optional: true })}
          </div>
          {field('support_hours', 'Hours', { optional: true, hint: 'e.g. Mon–Sat, 10am–7pm IST' })}
        </Section>
        <Section title="Business address and tax" description="Printed on invoices. The state decides whether GST is split as CGST + SGST or charged as IGST.">
          {field('legal_name', 'Legal name', { optional: true })}
          {field('gstin', 'GSTIN', { optional: true, maxLength: 15 })}
          {field('address_line1', 'Address')}
          {field('address_line2', 'Address line 2', { optional: true })}
          <div className="grid gap-4 sm:grid-cols-3">
            {field('city', 'City')}
            <SelectField label="State" placeholder="Choose" value={text('state')} error={errors.state?.[0]} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} onChange={(e) => set('state', e.target.value)} />
            {field('pincode', 'Pincode', { inputMode: 'numeric', maxLength: 6 })}
          </div>
        </Section>
        <Section title="Orders and payments">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Return window (days)" type="number" min={0} value={text('return_window_days')} hint="Default; categories can override." onChange={(e) => set('return_window_days', Number(e.target.value))} />
            <TextField label="Low-stock alert at" type="number" min={0} value={text('low_stock_threshold_default')} hint="Units left, unless a variant sets its own." onChange={(e) => set('low_stock_threshold_default', Number(e.target.value))} />
            <TextField label="Same-day dispatch cut-off" type="number" min={0} max={23} value={text('dispatch_cutoff_hour')} error={errors.dispatch_cutoff_hour?.[0]} hint="Hour in IST, 0–23. Later orders ship the next working day." onChange={(e) => set('dispatch_cutoff_hour', Number(e.target.value))} />
          </div>
          <Checkbox label="Offer cash on delivery" checked={!!draft.cod_enabled} onChange={(e) => set('cod_enabled', e.target.checked)} />
          {draft.cod_enabled ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyInput label="Cash on delivery fee" value={draft.cod_fee_paise as number} onChange={(v) => set('cod_fee_paise', v ?? 0)} />
              <MoneyInput label="Largest COD order" value={draft.cod_max_order_paise as number} onChange={(v) => set('cod_max_order_paise', v ?? 0)} />
            </div>
          ) : null}
        </Section>
        <Section title="Storefront">
          <Checkbox label="Show the announcement bar" checked={!!draft.announcement_enabled} onChange={(e) => set('announcement_enabled', e.target.checked)} />
          {field('announcement_text', 'Announcement', { optional: true, maxLength: 200, hint: 'One short line, e.g. “Free shipping over ₹1,999”.' })}
          <TextArea label="Footer note" optional rows={3} value={text('footer_blurb')} onChange={(e) => set('footer_blurb', e.target.value)} />
          <Checkbox label="Infinite scroll on phones" description="Otherwise product lists use page numbers everywhere." checked={!!draft.infinite_scroll_mobile} onChange={(e) => set('infinite_scroll_mobile', e.target.checked)} />
        </Section>
        <Section title="Search engines and social">
          {field('meta_title_suffix', 'Title suffix', { optional: true, hint: 'Added after page titles, e.g. “ · Sartoria”.' })}
          <TextArea label="Default description" optional rows={2} maxLength={300} value={text('meta_description')} onChange={(e) => set('meta_description', e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            {field('instagram_url', 'Instagram', { optional: true, type: 'url', error: errors.instagram_url?.[0] })}
            {field('facebook_url', 'Facebook', { optional: true, type: 'url', error: errors.facebook_url?.[0] })}
            {field('pinterest_url', 'Pinterest', { optional: true, type: 'url', error: errors.pinterest_url?.[0] })}
            {field('youtube_url', 'YouTube', { optional: true, type: 'url', error: errors.youtube_url?.[0] })}
            {field('x_url', 'X', { optional: true, type: 'url', error: errors.x_url?.[0] })}
          </div>
        </Section>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={save} loading={saving} disabled={!dirty}>Save settings</Button>
      </div>
    </>
  );
}
