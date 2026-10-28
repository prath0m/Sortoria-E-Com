import { useQueryClient } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminAll } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextArea, TextField } from '@/components/ui/Field';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney } from '@/lib/money';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { ImageInput, type FileChange } from '../components/ImageInput';
import { DateTimeInput, MoneyInput, Switch } from '../components/inputs';
import { PageHeader } from '../components/PageHeader';
import { ProductChip, ProductPicker } from '../components/ProductPicker';
import { saveWithFiles } from '../components/save';
import { flattenErrors } from '../components/Section';
import { StateBadge } from './state';
import type { Bundle } from './types';

function bundlePrice(b: Bundle, full: number) {
  if (b.discount_type === 'percent') return full - Math.floor((full * b.value) / 100);
  if (b.discount_type === 'fixed_off') return Math.max(0, full - b.value);
  return Math.min(full, b.value);
}

function Editor({ bundle, onClose }: { bundle: Bundle; onClose: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(bundle);
  const [image, setImage] = useState<FileChange>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Bundle>(k: K, v: Bundle[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const full = draft.items.reduce((n, i) => n + i.product_detail.min_price_paise * i.quantity, 0);

  const save = async () => {
    setSaving(true);
    setError('');
    const { image: _i, state: _s, full_price_paise: _f, ...rest } = draft;
    const body = { ...rest, items: draft.items.map((i) => ({ product: i.product, quantity: i.quantity })) };
    try {
      await saveWithFiles('bundles', draft.id, body, { image });
      qc.invalidateQueries({ queryKey: ['admin', 'bundles'] });
      toast.success('Bundle saved');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? flattenErrors(err.data).join(' · ') || err.message : 'Could not save the bundle.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open onClose={onClose} title={draft.id ? `Edit ${bundle.title}` : 'New bundle'} className="max-w-xl" footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save bundle</Button></div>}>
      <div className="space-y-5 p-5">
        {error ? <p role="alert" className="rounded-xs bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        <TextField label="Title" value={draft.title} onChange={(e) => set('title', e.target.value)} />
        <TextArea label="Description" optional rows={3} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium text-ink">Products in the set</legend>
          <ProductPicker exclude={draft.items.map((i) => i.product)} onPick={(p) => set('items', [...draft.items, { product: p.id, product_detail: p, quantity: 1 }])} />
          {draft.items.map((item, i) => (
            <ProductChip key={item.product} product={item.product_detail} onRemove={() => set('items', draft.items.filter((_, j) => j !== i))}>
              <label className="flex items-center gap-1 text-xs text-ink-muted">
                Qty
                <input type="number" min={1} max={10} value={item.quantity} onChange={(e) => set('items', draft.items.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x)))} className="h-9 w-14 rounded-xs border border-line bg-surface-raised px-2 text-sm tabular-nums text-ink" />
              </label>
            </ProductChip>
          ))}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Offer" value={draft.discount_type} options={[{ value: 'percent', label: 'Percent off the set' }, { value: 'fixed_off', label: 'Amount off the set' }, { value: 'fixed_price', label: 'Set price' }]} onChange={(e) => set('discount_type', e.target.value as Bundle['discount_type'])} />
          {draft.discount_type === 'percent' ? (
            <TextField label="Percent off" type="number" min={1} max={90} value={draft.value} onChange={(e) => set('value', Number(e.target.value))} />
          ) : (
            <MoneyInput label={draft.discount_type === 'fixed_off' ? 'Amount off' : 'Set price'} value={draft.value} onChange={(v) => set('value', v ?? 0)} />
          )}
        </div>
        {draft.items.length >= 2 ? (
          <p className="rounded-xs bg-accent-soft px-3 py-2 text-sm text-ink">
            Separately {formatMoney(full)} · together <strong>{formatMoney(bundlePrice(draft, full))}</strong>
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeInput label="Starts" value={draft.starts_at} onChange={(v) => set('starts_at', v)} />
          <DateTimeInput label="Ends" optional value={draft.ends_at} onChange={(v) => set('ends_at', v)} />
        </div>
        <Checkbox label="Active" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
        <ImageInput label="Image" current={bundle.image} file={image} onChange={setImage} clearable hint="Shown on the offers page. Leave empty to use the products' photos." />
      </div>
    </Drawer>
  );
}

export default function BundlesPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useAdminAll<Bundle>('bundles');
  const [editing, setEditing] = useState<Bundle | null>(null);
  const [deleting, setDeleting] = useState<Bundle | null>(null);

  const toggle = async (b: Bundle) => {
    await adminApi.update('bundles', b.id!, { is_active: !b.is_active });
    qc.invalidateQueries({ queryKey: ['admin', 'bundles'] });
  };
  const remove = async () => {
    await adminApi.remove('bundles', deleting!.id!);
    qc.invalidateQueries({ queryKey: ['admin', 'bundles'] });
    toast.success('Bundle deleted');
    setDeleting(null);
  };

  return (
    <>
      <PageHeader
        title="Bundles"
        eyebrow="Offers"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ title: '', slug: '', description: '', discount_type: 'percent', value: 10, starts_at: new Date().toISOString(), ends_at: null, is_active: true, items: [] })}>New bundle</Button>}
      >
        <p className="mt-1 text-sm text-ink-muted">Sets that cost less together. The discount applies automatically when every piece is in the bag.</p>
      </PageHeader>
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : !data?.length ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-line bg-surface-raised px-6 py-16 text-center">
          <Package className="h-8 w-8 text-ink-muted" aria-hidden="true" />
          <p className="text-sm text-ink-soft">No bundles yet. Pair things people already buy together.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((b) => (
            <article key={b.id} className="flex flex-col rounded-sm border border-line bg-surface-raised p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-sans text-sm font-semibold text-ink">{b.title}</h2>
                  <p className="text-xs text-ink-muted">
                    {formatMoney(b.full_price_paise ?? 0)} → {formatMoney(bundlePrice(b, b.full_price_paise ?? 0))}
                  </p>
                </div>
                <StateBadge state={b.state!} />
              </div>
              <div className="mt-3 flex -space-x-2">
                {b.items.map((i) => (
                  <span key={i.product} className="h-12 w-10 overflow-hidden rounded-xs border-2 border-surface-raised bg-ink/5" title={`${i.quantity} × ${i.product_detail.name}`}>
                    {i.product_detail.thumb ? <img src={i.product_detail.thumb} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Switch checked={b.is_active} onChange={() => toggle(b)} label={`${b.title} active`} />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(b)}>Delete</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(b)}>Edit</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing ? <Editor key={editing.id ?? 'new'} bundle={editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.title}?`} danger confirmLabel="Delete" onConfirm={remove} onClose={() => setDeleting(null)}>
        Bags that already contain the set lose the discount at their next update.
      </ConfirmDialog>
    </>
  );
}
