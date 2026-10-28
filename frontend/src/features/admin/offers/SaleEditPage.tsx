import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminItem } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextField } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney } from '@/lib/money';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { ImageInput, type FileChange } from '../components/ImageInput';
import { DateTimeInput } from '../components/inputs';
import { PageHeader } from '../components/PageHeader';
import { ProductChip, ProductPicker } from '../components/ProductPicker';
import { saveWithFiles } from '../components/save';
import { flattenErrors, Section } from '../components/Section';
import { StateBadge } from './state';
import { salePrice, type Sale } from './types';

const inAWeek = () => new Date(Date.now() + 7 * 86_400_000).toISOString();

export default function SaleEditPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useAdminItem<Sale>('sales', id);
  const [draft, setDraft] = useState<Sale | null>(
    isNew ? { kind: params.get('kind') === 'daily_deal' ? 'daily_deal' : 'flash', title: '', slug: '', subtitle: '', starts_at: new Date().toISOString(), ends_at: inAWeek(), is_active: true, position: 0, items: [] } : null,
  );
  const [banner, setBanner] = useState<FileChange>(null);
  const [errors, setErrors] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!draft || (isLoading && !isNew)) return <Skeleton className="h-96" />;
  const set = <K extends keyof Sale>(k: K, v: Sale[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const err = (k: string) => (Array.isArray(errors[k]) && typeof (errors[k] as unknown[])[0] === 'string' ? String((errors[k] as string[])[0]) : undefined);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const { banner_image: _b, state: _s, item_count: _c, position: _p, ...rest } = draft;
    const body = { ...rest, items: draft.items.map(({ product_detail: _d, sold_count: _sc, ...i }) => i) };
    try {
      const saved = await saveWithFiles<Sale & { id: number }>('sales', draft.id, body, { banner_image: banner });
      qc.invalidateQueries({ queryKey: ['admin', 'sales'] });
      toast.success('Sale saved');
      if (isNew) navigate(`/admin-panel/offers/sales/${saved.id}`, { replace: true });
      else {
        setBanner(null);
        refetch();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.data && typeof e.data === 'object') {
        setErrors(e.data as Record<string, unknown>);
        toast.error('Please fix the highlighted fields.');
      } else toast.error(e instanceof ApiError ? e.message : 'Could not save the sale.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await adminApi.remove('sales', draft.id!);
    qc.invalidateQueries({ queryKey: ['admin', 'sales'] });
    toast.success('Sale deleted; prices are back to normal.');
    navigate(`/admin-panel/offers/sales?kind=${draft.kind}`);
  };

  const itemErrors = errors.items ? flattenErrors(errors.items, 'Product').join(' · ') : '';

  return (
    <>
      <PageHeader
        title={isNew ? (draft.kind === 'flash' ? 'New flash sale' : 'New daily deal') : draft.title}
        eyebrow={draft.kind === 'flash' ? 'Flash sale' : 'Daily deal'}
        back={{ to: `/admin-panel/offers/sales?kind=${draft.kind}`, label: draft.kind === 'flash' ? 'Flash sales' : 'Daily deals' }}
        actions={
          <>
            {!isNew ? <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>Delete</Button> : null}
            <Button onClick={save} loading={saving}>{isNew ? 'Create sale' : 'Save changes'}</Button>
          </>
        }
      >
        {draft.state ? <div className="mt-2"><StateBadge state={draft.state} /></div> : null}
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Section title={`Products (${draft.items.length})`} description="Each product's every variant drops by this amount. Caps limit how many units sell at the sale price.">
          {itemErrors ? <p role="alert" className="text-sm text-danger">{itemErrors}</p> : null}
          <ProductPicker
            exclude={draft.items.map((i) => i.product)}
            onPick={(p) => set('items', [...draft.items, { product: p.id, product_detail: p, discount_type: 'percent', value: 20, quantity_cap: null }])}
          />
          {draft.items.length === 0 ? <p className="text-sm text-ink-muted">Add the products in this sale.</p> : null}
          <div className="space-y-2">
            {draft.items.map((item, i) => {
              const update = (patch: Partial<typeof item>) => set('items', draft.items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <ProductChip key={item.product} product={item.product_detail} onRemove={() => set('items', draft.items.filter((_, j) => j !== i))}>
                  <div className="flex flex-wrap items-center gap-2">
                    <select aria-label={`Discount type for ${item.product_detail.name}`} value={item.discount_type} onChange={(e) => update({ discount_type: e.target.value as typeof item.discount_type, value: e.target.value === 'percent' ? 20 : item.product_detail.min_price_paise })} className="h-9 rounded-xs border border-line bg-surface-raised px-2 text-xs">
                      <option value="percent">% off</option>
                      <option value="fixed_price">Sale price</option>
                    </select>
                    {item.discount_type === 'percent' ? (
                      <input aria-label={`Percent off ${item.product_detail.name}`} type="number" min={1} max={90} value={item.value} onChange={(e) => update({ value: Number(e.target.value) })} className="h-9 w-16 rounded-xs border border-line bg-surface-raised px-2 text-sm tabular-nums" />
                    ) : (
                      <input aria-label={`Sale price for ${item.product_detail.name} in rupees`} inputMode="decimal" value={item.value / 100} onChange={(e) => update({ value: Math.round(Number(e.target.value.replace(/[^\d.]/g, '')) * 100) })} className="h-9 w-24 rounded-xs border border-line bg-surface-raised px-2 text-sm tabular-nums" />
                    )}
                    <input aria-label={`Unit cap for ${item.product_detail.name}`} type="number" min={0} placeholder="No cap" value={item.quantity_cap ?? ''} onChange={(e) => update({ quantity_cap: e.target.value === '' ? null : Number(e.target.value) })} className="h-9 w-20 rounded-xs border border-line bg-surface-raised px-2 text-sm tabular-nums" />
                    <span className="w-24 text-right text-xs tabular-nums text-ink-muted">
                      → {formatMoney(salePrice(item.product_detail.min_price_paise, item))}
                      {item.sold_count ? <span className="block">{item.sold_count} sold</span> : null}
                    </span>
                  </div>
                </ProductChip>
              );
            })}
          </div>
        </Section>
        <div className="min-w-0 space-y-5">
          <Section title="Details">
            <SelectField label="Type" value={draft.kind} options={[{ value: 'flash', label: 'Flash sale' }, { value: 'daily_deal', label: 'Daily deal' }]} onChange={(e) => set('kind', e.target.value as Sale['kind'])} />
            <TextField label="Title" value={draft.title} error={err('title')} onChange={(e) => set('title', e.target.value)} />
            <TextField label="Subtitle" optional value={draft.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
            <DateTimeInput label="Starts" value={draft.starts_at} error={err('starts_at')} onChange={(v) => set('starts_at', v)} />
            <DateTimeInput label="Ends" value={draft.ends_at} error={err('ends_at')} onChange={(v) => set('ends_at', v)} />
            <Checkbox label="Active" description="Switch off to pause without losing the setup." checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          </Section>
          <Section title="Banner">
            <ImageInput label="Banner image" current={draft.banner_image} file={banner} onChange={setBanner} aspect="aspect-[3/1]" clearable hint="Wide, at least 1600px across." />
          </Section>
        </div>
      </div>
      <ConfirmDialog open={confirmDelete} title="Delete this sale?" danger confirmLabel="Delete" onConfirm={remove} onClose={() => setConfirmDelete(false)}>
        Prices return to normal straight away.
      </ConfirmDialog>
    </>
  );
}

