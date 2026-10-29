import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminList } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextField } from '@/components/ui/Field';
import { Drawer } from '@/components/ui/Overlay';
import { formatMoney } from '@/lib/money';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type Column } from '../components/DataTable';
import { DateTimeInput, MoneyInput, Switch } from '../components/inputs';
import { PageHeader } from '../components/PageHeader';
import { ProductChip, ProductPicker, type ProductRef } from '../components/ProductPicker';
import { FilterSelect, SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';
import { categoryOptions, useCatalogOptions } from '../products/useCatalogOptions';
import { shortDate } from '../orders/types';
import { StateBadge } from './state';
import { STATE_FILTER } from './stateFilter';

interface Coupon {
  id?: number;
  code: string;
  description: string;
  discount_type: 'percent' | 'fixed';
  value: number;
  max_discount_paise: number | null;
  min_order_paise: number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit_total: number | null;
  usage_limit_per_user: number | null;
  first_order_only: boolean;
  applicable_categories: number[];
  applicable_products: number[];
  products_detail?: ProductRef[];
  is_active: boolean;
  times_used?: number;
  state?: string;
  revenue_paise?: number;
  discount_given_paise?: number;
}

const blank = (): Coupon => ({
  code: '', description: '', discount_type: 'percent', value: 10, max_discount_paise: null, min_order_paise: 0, starts_at: new Date().toISOString(), ends_at: null,
  usage_limit_total: null, usage_limit_per_user: 1, first_order_only: false, applicable_categories: [], applicable_products: [], products_detail: [], is_active: true,
});

const describe = (c: Coupon) =>
  c.discount_type === 'percent'
    ? `${c.value}% off${c.max_discount_paise ? ` up to ${formatMoney(c.max_discount_paise)}` : ''}`
    : `${formatMoney(c.value)} off`;

const optionalInt = (v: string) => (v === '' ? null : Math.max(0, Math.floor(Number(v))));

function Editor({ coupon, onClose }: { coupon: Coupon; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: options } = useCatalogOptions();
  const [draft, setDraft] = useState(coupon);
  const [products, setProducts] = useState<ProductRef[]>(coupon.products_detail ?? []);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Coupon>(k: K, v: Coupon[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    const body = { ...draft, applicable_products: products.map((p) => p.id), products_detail: undefined, state: undefined, times_used: undefined };
    try {
      if (draft.id) await adminApi.update('coupons', draft.id, body);
      else await adminApi.create('coupons', body);
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      toast.success(draft.id ? 'Coupon saved' : `Coupon ${draft.code.toUpperCase()} created`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else toast.error(err instanceof ApiError ? err.message : 'Could not save the coupon.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open onClose={onClose} title={draft.id ? `Edit ${coupon.code}` : 'New coupon'} className="max-w-xl" footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save coupon</Button></div>}>
      <div className="space-y-5 p-5">
        <TextField label="Code" value={draft.code} error={errors.code?.[0]} hint="Shoppers type this at checkout. Letters, numbers and hyphens." onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} className="font-mono uppercase" />
        <TextField label="Description" optional value={draft.description} hint="Shown on the offers page, e.g. “10% off your first order”." onChange={(e) => set('description', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Discount" value={draft.discount_type} options={[{ value: 'percent', label: 'Percentage off' }, { value: 'fixed', label: 'Amount off' }]} onChange={(e) => set('discount_type', e.target.value as Coupon['discount_type'])} />
          {draft.discount_type === 'percent' ? (
            <TextField label="Percent off" type="number" min={1} max={90} value={draft.value} error={errors.value?.[0]} onChange={(e) => set('value', Number(e.target.value))} />
          ) : (
            <MoneyInput label="Amount off" value={draft.value} error={errors.value?.[0]} onChange={(v) => set('value', v ?? 0)} />
          )}
          {draft.discount_type === 'percent' ? <MoneyInput label="Maximum discount" optional value={draft.max_discount_paise} onChange={(v) => set('max_discount_paise', v)} hint="Caps big baskets." /> : null}
          <MoneyInput label="Minimum order" value={draft.min_order_paise} onChange={(v) => set('min_order_paise', v ?? 0)} hint="After other discounts." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeInput label="Starts" value={draft.starts_at} onChange={(v) => set('starts_at', v)} error={errors.starts_at?.[0]} />
          <DateTimeInput label="Ends" optional value={draft.ends_at} onChange={(v) => set('ends_at', v)} error={errors.ends_at?.[0]} hint="Blank runs until you switch it off." />
          <TextField label="Total uses" type="number" min={0} optional value={draft.usage_limit_total ?? ''} hint="Blank for unlimited." onChange={(e) => set('usage_limit_total', optionalInt(e.target.value))} />
          <TextField label="Uses per customer" type="number" min={0} optional value={draft.usage_limit_per_user ?? ''} hint="Blank for unlimited." onChange={(e) => set('usage_limit_per_user', optionalInt(e.target.value))} />
        </div>
        <Checkbox label="First order only" description="Only for shoppers who haven't ordered before." checked={draft.first_order_only} onChange={(e) => set('first_order_only', e.target.checked)} />
        <Checkbox label="Active" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
        <fieldset className="space-y-3 border-t border-line pt-5">
          <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Limit to</legend>
          <p className="text-xs text-ink-muted">Leave both empty for the whole store. Otherwise only matching items count towards the discount.</p>
          <select
            multiple
            aria-label="Categories"
            value={draft.applicable_categories.map(String)}
            onChange={(e) => set('applicable_categories', Array.from(e.target.selectedOptions, (o) => Number(o.value)))}
            className="h-32 w-full rounded-xs border border-line bg-surface px-2 py-1 text-sm"
          >
            {categoryOptions(options).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ProductPicker exclude={products.map((p) => p.id)} onPick={(p) => setProducts((x) => [...x, p])} label="Products" />
          <div className="space-y-2">{products.map((p) => <ProductChip key={p.id} product={p} onRemove={() => setProducts((x) => x.filter((y) => y.id !== p.id))} />)}</div>
        </fieldset>
      </div>
    </Drawer>
  );
}

export default function CouponsPage() {
  const qc = useQueryClient();
  const { state, query, set } = useTableState({ ordering: '-created_at' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<Coupon>('coupons', query);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const toggle = async (c: Coupon) => {
    try {
      await adminApi.update('coupons', c.id!, { is_active: !c.is_active });
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update.');
    }
  };
  const remove = async () => {
    try {
      await adminApi.remove('coupons', deleting!.id!);
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      toast.success('Coupon deleted');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete.');
    }
    setDeleting(null);
  };

  const columns: Column<Coupon>[] = [
    {
      key: 'code',
      header: 'Code',
      sortKey: 'code',
      cell: (c) => (
        <div>
          <p className="font-mono text-sm font-semibold text-ink">{c.code}</p>
          <p className="text-xs text-ink-muted">{describe(c)}{c.min_order_paise ? ` · over ${formatMoney(c.min_order_paise)}` : ''}{c.first_order_only ? ' · first order' : ''}</p>
        </div>
      ),
    },
    { key: 'used', header: 'Used', sortKey: 'times_used', align: 'right', cell: (c) => <span className="tabular-nums">{c.times_used}{c.usage_limit_total ? ` / ${c.usage_limit_total}` : ''}</span> },
    { key: 'revenue', header: 'Orders worth', align: 'right', cell: (c) => <span className="tabular-nums text-ink-soft">{formatMoney(c.revenue_paise ?? 0)}</span> },
    { key: 'given', header: 'Discount given', align: 'right', cell: (c) => <span className="tabular-nums text-ink-soft">{formatMoney(c.discount_given_paise ?? 0)}</span> },
    { key: 'dates', header: 'Runs', sortKey: 'ends_at', cell: (c) => <span className="whitespace-nowrap text-xs text-ink-muted">{shortDate(c.starts_at)} – {c.ends_at ? shortDate(c.ends_at) : 'open'}</span> },
    { key: 'state', header: 'Status', cell: (c) => <StateBadge state={c.state!} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <div className="flex items-center justify-end gap-2">
          <Switch checked={c.is_active} onChange={() => toggle(c)} label={`${c.code} active`} />
          <Button size="sm" variant="ghost" className="text-danger" onClick={(e) => { e.stopPropagation(); setDeleting(c); }}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Coupons" eyebrow="Offers" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(blank())}>New coupon</Button>} />
      <Toolbar>
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Search codes" />
        <FilterSelect label="Any status" value={state.state ?? ''} onChange={(v) => set({ state: v })} options={STATE_FILTER} />
      </Toolbar>
      <DataTable rows={data?.results} error={isError} onRetry={() => refetch()} columns={columns} rowKey={(c) => c.id!} loading={isLoading} fetching={isFetching} ordering={state.ordering} onOrdering={(o) => set({ ordering: o })} page={data?.page} totalPages={data?.total_pages} count={data?.count} onPage={(p) => set({ page: String(p) })} onRowClick={setEditing} emptyTitle="No coupons yet" emptyText="Create one for a launch, a festival or a thank-you." />
      {editing ? <Editor key={editing.id ?? 'new'} coupon={editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.code}?`} danger confirmLabel="Delete" onConfirm={remove} onClose={() => setDeleting(null)}>
        Past orders keep their discount. To stop new use but keep the history, switch it off instead.
      </ConfirmDialog>
    </>
  );
}

