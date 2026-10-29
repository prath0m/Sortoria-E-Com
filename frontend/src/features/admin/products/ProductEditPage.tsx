import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminItem } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextArea, TextField } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAuth } from '@/stores/auth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { flattenErrors } from '../components/errors';
import { TabPanel, Tabs } from '../components/Tabs';
import { ImageManager } from './ImageManager';
import { emptyProduct, type AdminProduct } from './types';
import { categoryOptions, useCatalogOptions } from './useCatalogOptions';
import { VariantMatrix } from './VariantMatrix';

type Tab = 'details' | 'variants' | 'images' | 'specs' | 'seo';
type Errors = Record<string, string[] | unknown>;

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 170);
const first = (errors: Errors, key: string) => (Array.isArray(errors[key]) && typeof (errors[key] as unknown[])[0] === 'string' ? String((errors[key] as string[])[0]) : undefined);
const TAB_FIELDS: Record<Tab, string[]> = {
  details: ['name', 'slug', 'brand', 'category', 'extra_categories', 'short_description', 'description', 'highlights', 'tax_rate', 'hsn_code', 'product_type', 'attribute_values'],
  variants: ['variants'],
  images: [],
  specs: ['specs'],
  seo: ['seo_title', 'seo_description'],
};

export default function ProductEditPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: loaded, isLoading, isError, refetch } = useAdminItem<AdminProduct>('products', id);
  const { data: options } = useCatalogOptions();
  const canDelete = useAuth((s) => s.user?.capabilities.includes('catalog.delete'));
  const [form, setForm] = useState<AdminProduct | null>(isNew ? emptyProduct() : null);
  const [tab, setTab] = useState<Tab>('details');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    if (loaded && !dirty) setForm(loaded);
  }, [loaded, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof AdminProduct>(key: K, value: AdminProduct[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setDirty(true);
  };

  const usedValueIds = useMemo(() => form?.variants.flatMap((v) => v.option_values) ?? [], [form?.variants]);
  // Descriptive attributes (material, fit…) live on the product; variant axes are set per variant.
  const descriptive = useMemo(
    () => (options?.attributes ?? []).filter((a) => !a.is_variant_axis || a.values.some((v) => form?.attribute_values.includes(v.id))),
    [options, form?.attribute_values],
  );

  if (isError) return <ErrorState title="We couldn't load this product." onRetry={() => refetch()} />;
  if (!form || !options || (isLoading && !isNew)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    setErrors({});
    const body = { ...form, slug: form.slug || slugify(form.name), images: undefined };
    try {
      const saved = isNew ? await adminApi.create<AdminProduct>('products', body) : await adminApi.update<AdminProduct>('products', id!, body, 'PUT');
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      setDirty(false);
      setForm(saved);
      toast.success(isNew ? 'Product created. Add some images next.' : 'Product saved');
      if (isNew) {
        navigate(`/admin-panel/products/${saved.id}`, { replace: true });
        setTab('images');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.data && typeof err.data === 'object') {
        const data = err.data as Errors;
        setErrors(data);
        const bad = (Object.keys(TAB_FIELDS) as Tab[]).find((t) => TAB_FIELDS[t].some((f) => f in data));
        if (bad) setTab(bad);
        toast.error('Please fix the highlighted fields.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Could not save the product.');
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await adminApi.remove('products', id!);
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Product deleted');
      navigate('/admin-panel/products');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the product.');
      setConfirmDelete(false);
    }
  };

  const tabHasError = (t: Tab) => TAB_FIELDS[t].some((f) => f in errors);
  const variantErrors = errors.variants ? flattenErrors(errors.variants, 'Row').join(' · ') : undefined;
  const specErrors = errors.specs ? flattenErrors(errors.specs, 'Row').join(' · ') : undefined;

  return (
    <>
      <PageHeader
        title={isNew ? 'New product' : form.name || 'Untitled product'}
        eyebrow="Catalogue"
        back={{ to: '/admin-panel/products', label: 'All products' }}
        actions={
          <>
            {!isNew && form.slug ? (
              <a href={`/products/${form.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 text-sm text-ink-muted hover:text-ink">
                View in store <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
            {!isNew && canDelete ? (
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : null}
            <Button onClick={save} loading={saving} disabled={!dirty && !isNew}>
              {isNew ? 'Create product' : 'Save changes'}
            </Button>
          </>
        }
      >
        {!isNew ? (
          <p className="mt-1 text-sm text-ink-muted">
            {form.sales_count ?? 0} sold · {Number(form.rating_avg ?? 0).toFixed(1)} from {form.rating_count ?? 0} reviews
          </p>
        ) : null}
      </PageHeader>

      <Tabs<Tab>
        label="Product sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'details', label: 'Details', error: tabHasError('details') },
          { id: 'variants', label: 'Variants', badge: form.variants.length, error: tabHasError('variants') },
          { id: 'images', label: 'Images', badge: form.images?.length ?? 0 },
          { id: 'specs', label: 'Specifications', badge: form.specs.length, error: tabHasError('specs') },
          { id: 'seo', label: 'SEO', error: tabHasError('seo') },
        ]}
      />

      <TabPanel id="details" active={tab === 'details'}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            <Section title="Basics">
              <TextField
                label="Name"
                value={form.name}
                error={first(errors, 'name')}
                onChange={(e) => {
                  set('name', e.target.value);
                  if (!slugTouched) set('slug', slugify(e.target.value));
                }}
              />
              <TextField
                label="URL slug"
                value={form.slug}
                error={first(errors, 'slug')}
                hint={`/products/${form.slug || slugify(form.name) || '…'}`}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', slugify(e.target.value));
                }}
              />
              <TextArea label="Short description" rows={2} maxLength={300} value={form.short_description} error={first(errors, 'short_description')} hint={`${form.short_description.length}/300. Shown under the title and in search results.`} onChange={(e) => set('short_description', e.target.value)} />
              <TextArea label="Description" rows={8} value={form.description} error={first(errors, 'description')} hint="Basic HTML is allowed: paragraphs, bold, italics, lists and links. Anything else is removed." onChange={(e) => set('description', e.target.value)} />
            </Section>
            <Section title="Highlights" description="Three to five short points shown beside the gallery." actions={<Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => set('highlights', [...form.highlights, ''])}>Add</Button>}>
              {form.highlights.length === 0 ? <p className="text-sm text-ink-muted">No highlights yet.</p> : null}
              {form.highlights.map((h, i) => (
                <div key={i} className="flex items-end gap-2">
                  <TextField label={`Highlight ${i + 1}`} hideLabel wrapperClassName="flex-1" value={h} onChange={(e) => set('highlights', form.highlights.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button type="button" aria-label={`Remove highlight ${i + 1}`} onClick={() => set('highlights', form.highlights.filter((_, j) => j !== i))} className="mb-3 text-ink-muted hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </Section>
            <Section title="Care, warranty and box">
              <TextArea label="Care" rows={3} optional value={form.care_info} onChange={(e) => set('care_info', e.target.value)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Warranty" optional value={form.warranty_info} onChange={(e) => set('warranty_info', e.target.value)} />
                <TextField label="In the box" optional value={form.box_contents} onChange={(e) => set('box_contents', e.target.value)} />
              </div>
            </Section>
          </div>
          <div className="min-w-0 space-y-5">
            <Section title="Visibility">
              <Checkbox label="Active" description="Visible in the store when it has stock or is set to show when sold out." checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              <Checkbox label="Featured" description="Eligible for featured sections on the homepage." checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />
            </Section>
            <Section title="Organisation">
              <SelectField label="Category" placeholder="Choose a category" value={form.category ? String(form.category) : ''} error={first(errors, 'category')} options={categoryOptions(options)} onChange={(e) => set('category', e.target.value ? Number(e.target.value) : null)} />
              <SelectField label="Brand" placeholder="No brand" value={form.brand ? String(form.brand) : ''} options={options.brands.map((b) => ({ value: String(b.id), label: b.name }))} onChange={(e) => set('brand', e.target.value ? Number(e.target.value) : null)} />
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink">Also appears in</legend>
                <select
                  multiple
                  aria-label="Additional categories"
                  value={form.extra_categories.map(String)}
                  onChange={(e) => set('extra_categories', Array.from(e.target.selectedOptions, (o) => Number(o.value)))}
                  className="h-32 w-full rounded-xs border border-line bg-surface px-2 py-1 text-sm"
                >
                  {categoryOptions(options).filter((o) => o.value !== String(form.category)).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-ink-muted">Hold Ctrl or Cmd to choose several.</p>
              </fieldset>
            </Section>
            <Section title="Tax and shipping">
              <SelectField label="GST rate" value={String(form.tax_rate)} options={options.tax_rates.map((r) => ({ value: String(r), label: `${r}%` }))} onChange={(e) => set('tax_rate', Number(e.target.value))} hint="Prices include GST." />
              <TextField label="HSN code" optional value={form.hsn_code} error={first(errors, 'hsn_code')} inputMode="numeric" maxLength={8} onChange={(e) => set('hsn_code', e.target.value.replace(/\D/g, ''))} />
              <SelectField label="Shipping class" value={form.product_type} options={[{ value: 'standard', label: 'Standard' }, { value: 'bulky', label: 'Bulky (surcharge applies)' }]} onChange={(e) => set('product_type', e.target.value as AdminProduct['product_type'])} />
              <SelectField
                label="Returns"
                value={form.is_returnable === null ? '' : String(form.is_returnable)}
                options={[{ value: '', label: 'Follow the category policy' }, { value: 'true', label: 'Always returnable' }, { value: 'false', label: 'Not returnable' }]}
                onChange={(e) => set('is_returnable', e.target.value === '' ? null : e.target.value === 'true')}
              />
            </Section>
            {descriptive.length ? (
              <Section title="Attributes" description="Used for filters. Options the product varies by are set on the Variants tab.">
                {descriptive.map((a) => {
                  const current = form.attribute_values.find((v) => a.values.some((x) => x.id === v));
                  return (
                    <SelectField
                      key={a.id}
                      label={a.name}
                      placeholder="Not set"
                      value={current ? String(current) : ''}
                      options={a.values.map((v) => ({ value: String(v.id), label: v.value }))}
                      onChange={(e) => {
                        const rest = form.attribute_values.filter((v) => !a.values.some((x) => x.id === v));
                        set('attribute_values', e.target.value ? [...rest, Number(e.target.value)] : rest);
                      }}
                    />
                  );
                })}
              </Section>
            ) : null}
          </div>
        </div>
      </TabPanel>

      <TabPanel id="variants" active={tab === 'variants'}>
        <VariantMatrix variants={form.variants} onChange={(v) => set('variants', v)} options={options} skuBase={(form.slug || slugify(form.name)).toUpperCase().slice(0, 24) || 'SKU'} errors={variantErrors} />
      </TabPanel>

      <TabPanel id="images" active={tab === 'images'}>
        {isNew ? (
          <p className="rounded-sm border border-line bg-surface-raised p-6 text-sm text-ink-soft">Create the product first, then add images here.</p>
        ) : (
          <ImageManager key={form.id} productId={form.id!} images={form.images ?? []} options={options} usedValueIds={usedValueIds} />
        )}
      </TabPanel>

      <TabPanel id="specs" active={tab === 'specs'}>
        <Section title="Specifications" description="Grouped key–value rows shown in the Specifications tab on the product page." actions={<Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => set('specs', [...form.specs, { group: form.specs.at(-1)?.group ?? '', key: '', value: '' }])}>Add row</Button>}>
          {specErrors ? <p role="alert" className="text-sm text-danger">{specErrors}</p> : null}
          {form.specs.length === 0 ? <p className="text-sm text-ink-muted">No specifications yet.</p> : null}
          {form.specs.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_auto] items-end gap-2">
              {(['group', 'key', 'value'] as const).map((field) => (
                <TextField
                  key={field}
                  label={field === 'group' ? 'Group' : field === 'key' ? 'Name' : 'Value'}
                  hideLabel={i > 0}
                  value={s[field]}
                  onChange={(e) => set('specs', form.specs.map((x, j) => (j === i ? { ...x, [field]: e.target.value } : x)))}
                />
              ))}
              <button type="button" aria-label={`Remove specification ${i + 1}`} onClick={() => set('specs', form.specs.filter((_, j) => j !== i))} className="mb-3 text-ink-muted hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </Section>
      </TabPanel>

      <TabPanel id="seo" active={tab === 'seo'}>
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Search engine listing" description="Leave blank to use the product name and short description.">
            <TextField label="Meta title" optional maxLength={120} value={form.seo_title} error={first(errors, 'seo_title')} hint={`${form.seo_title.length}/120. About 60 characters show in results.`} onChange={(e) => set('seo_title', e.target.value)} />
            <TextArea label="Meta description" optional rows={3} maxLength={300} value={form.seo_description} error={first(errors, 'seo_description')} hint={`${form.seo_description.length}/300. About 155 characters show in results.`} onChange={(e) => set('seo_description', e.target.value)} />
          </Section>
          <Section title="Preview">
            <div className="rounded-xs border border-line bg-surface p-4">
              <p className="truncate text-xs text-ink-muted">{window.location.host}/products/{form.slug || slugify(form.name)}</p>
              <p className="mt-1 truncate text-lg text-accent">{(form.seo_title || form.name || 'Product name').slice(0, 60)}</p>
              <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{(form.seo_description || form.short_description || 'A short description of the product.').slice(0, 160)}</p>
            </div>
          </Section>
        </div>
      </TabPanel>

      <ConfirmDialog open={confirmDelete} title="Delete this product?" danger confirmLabel="Delete" onConfirm={remove} onClose={() => setConfirmDelete(false)}>
        Products with past orders can't be deleted; deactivate them instead. This can't be undone.
      </ConfirmDialog>
    </>
  );
}
