import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminAll, useAdminList } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextField } from '@/components/ui/Field';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { INDIAN_STATES } from '@/lib/states';
import { formatMoney } from '@/lib/money';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type Column } from '../components/DataTable';
import { ErrorState } from '../components/ErrorState';
import { MoneyInput, Switch } from '../components/inputs';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { FilterSelect, SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';

interface Method {
  id: number;
  code: 'standard' | 'express';
  name: string;
  description: string;
  base_rate_paise: number;
  free_threshold_paise: number | null;
  bulky_surcharge_paise: number;
  allows_bulky: boolean;
  is_active: boolean;
}

interface Zone {
  id?: number;
  name: string;
  standard_days_min: number;
  standard_days_max: number;
  express_days_min: number;
  express_days_max: number;
  express_available: boolean;
  cod_available: boolean;
  extra_fee_paise: number;
  pincode_count?: number;
}

interface Pincode {
  id?: number;
  pincode: string;
  zone: number | null;
  zone_name?: string;
  city: string;
  state: string;
  state_code?: string;
  is_active: boolean;
}

function MethodCard({ method }: { method: Method }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(method);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(method);
  const save = async () => {
    setSaving(true);
    try {
      await adminApi.update('shipping/methods', method.id, draft);
      qc.invalidateQueries({ queryKey: ['admin', 'shipping/methods'] });
      toast.success(`${draft.name} saved`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Section
      title={method.code === 'express' ? 'Express' : 'Standard'}
      description={method.code === 'express' ? 'Faster delivery where zones allow it.' : 'The default for every order.'}
      actions={<Switch checked={draft.is_active} onChange={(v) => setDraft({ ...draft, is_active: v })} label={`Offer ${method.name}`} disabled={method.code === 'standard'} />}
    >
      <TextField label="Name at checkout" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <TextField label="Description" optional value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput label="Rate" value={draft.base_rate_paise} onChange={(v) => setDraft({ ...draft, base_rate_paise: v ?? 0 })} />
        <MoneyInput label="Free above" optional value={draft.free_threshold_paise} onChange={(v) => setDraft({ ...draft, free_threshold_paise: v })} hint="Blank: never free." />
        <MoneyInput label="Bulky item surcharge" value={draft.bulky_surcharge_paise} onChange={(v) => setDraft({ ...draft, bulky_surcharge_paise: v ?? 0 })} hint="Added per bulky item." />
      </div>
      <Checkbox label="Can carry bulky items" checked={draft.allows_bulky} onChange={(e) => setDraft({ ...draft, allows_bulky: e.target.checked })} />
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" disabled={!dirty} loading={saving} onClick={save}>Save</Button>
      </div>
    </Section>
  );
}

function ZoneEditor({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(zone);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const num = (k: keyof Zone) => ({ value: Number(draft[k]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [k]: Math.max(0, Number(e.target.value)) }) });
  const save = async () => {
    setSaving(true);
    try {
      if (draft.id) await adminApi.update('shipping/zones', draft.id, draft);
      else await adminApi.create('shipping/zones', draft);
      qc.invalidateQueries({ queryKey: ['admin', 'shipping/zones'] });
      toast.success('Zone saved');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Drawer open onClose={onClose} title={draft.id ? `Edit ${zone.name}` : 'New zone'} footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save zone</Button></div>}>
      <div className="space-y-5 p-5">
        <TextField label="Name" value={draft.name} error={errors.name?.[0]} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <fieldset className="grid grid-cols-2 gap-4">
          <legend className="col-span-2 mb-1 text-sm font-medium text-ink">Standard delivery (working days)</legend>
          <TextField label="Fastest" type="number" min={0} {...num('standard_days_min')} />
          <TextField label="Slowest" type="number" min={0} error={errors.standard_days_max?.[0]} {...num('standard_days_max')} />
        </fieldset>
        <Checkbox label="Express available" checked={draft.express_available} onChange={(e) => setDraft({ ...draft, express_available: e.target.checked })} />
        {draft.express_available ? (
          <fieldset className="grid grid-cols-2 gap-4">
            <legend className="col-span-2 mb-1 text-sm font-medium text-ink">Express delivery (working days)</legend>
            <TextField label="Fastest" type="number" min={0} {...num('express_days_min')} />
            <TextField label="Slowest" type="number" min={0} error={errors.express_days_max?.[0]} {...num('express_days_max')} />
          </fieldset>
        ) : null}
        <Checkbox label="Cash on delivery available" checked={draft.cod_available} onChange={(e) => setDraft({ ...draft, cod_available: e.target.checked })} />
        <MoneyInput label="Extra fee for this zone" value={draft.extra_fee_paise} onChange={(v) => setDraft({ ...draft, extra_fee_paise: v ?? 0 })} hint="Added to every method, e.g. for remote areas." />
      </div>
    </Drawer>
  );
}

function PincodeEditor({ pincode, zones, onClose }: { pincode: Pincode; zones: Zone[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(pincode);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...draft, state_code: '' };
      if (draft.id) await adminApi.update('shipping/pincodes', draft.id, body);
      else await adminApi.create('shipping/pincodes', body);
      qc.invalidateQueries({ queryKey: ['admin', 'shipping/pincodes'] });
      qc.invalidateQueries({ queryKey: ['admin', 'shipping/zones'] });
      toast.success('Pincode saved');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      else toast.error('Could not save.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Drawer open onClose={onClose} title={draft.id ? `Edit ${pincode.pincode}` : 'Add pincode'} footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>}>
      <div className="space-y-5 p-5">
        <TextField label="Pincode" inputMode="numeric" maxLength={6} value={draft.pincode} error={errors.pincode?.[0]} onChange={(e) => setDraft({ ...draft, pincode: e.target.value.replace(/\D/g, '') })} />
        <SelectField label="Zone" placeholder="Choose a zone" value={draft.zone ? String(draft.zone) : ''} error={errors.zone?.[0]} options={zones.map((z) => ({ value: String(z.id), label: z.name }))} onChange={(e) => setDraft({ ...draft, zone: Number(e.target.value) || null })} />
        <TextField label="City" value={draft.city} error={errors.city?.[0]} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
        <SelectField label="State" placeholder="Choose a state" value={draft.state} error={errors.state?.[0]} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} onChange={(e) => setDraft({ ...draft, state: e.target.value })} />
        <Checkbox label="Deliverable" description="Switch off to pause deliveries here without deleting it." checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
      </div>
    </Drawer>
  );
}

function Pincodes({ zones }: { zones: Zone[] }) {
  const qc = useQueryClient();
  const { state, query, set } = useTableState({ ordering: 'pincode' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<Pincode>('shipping/pincodes', query);
  const [editing, setEditing] = useState<Pincode | null>(null);
  const toggle = async (p: Pincode) => {
    await adminApi.update('shipping/pincodes', p.id!, { is_active: !p.is_active });
    qc.invalidateQueries({ queryKey: ['admin', 'shipping/pincodes'] });
  };
  const columns: Column<Pincode>[] = [
    { key: 'pincode', header: 'Pincode', sortKey: 'pincode', cell: (p) => <span className="font-mono font-medium text-ink">{p.pincode}</span> },
    { key: 'city', header: 'City', sortKey: 'city', cell: (p) => <span className="text-ink-soft">{p.city}</span> },
    { key: 'state', header: 'State', sortKey: 'state', cell: (p) => <span className="text-ink-soft">{p.state}</span> },
    { key: 'zone', header: 'Zone', cell: (p) => <span className="text-ink-soft">{p.zone_name}</span> },
    { key: 'active', header: 'Deliverable', align: 'right', cell: (p) => <Switch checked={p.is_active} onChange={() => toggle(p)} label={`Deliver to ${p.pincode}`} /> },
  ];
  return (
    <>
      <Toolbar>
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Pincode, city or state" />
        <FilterSelect label="All zones" value={state.zone ?? ''} onChange={(v) => set({ zone: v })} options={zones.map((z) => ({ value: String(z.id), label: z.name }))} />
        <Button size="sm" className="ml-auto" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing({ pincode: '', zone: zones[0]?.id ?? null, city: '', state: '', is_active: true })}>Add pincode</Button>
      </Toolbar>
      <DataTable rows={data?.results} error={isError} onRetry={() => refetch()} columns={columns} rowKey={(p) => p.id!} loading={isLoading} fetching={isFetching} ordering={state.ordering} onOrdering={(o) => set({ ordering: o })} page={data?.page} totalPages={data?.total_pages} count={data?.count} onPage={(p) => set({ page: String(p) })} onRowClick={setEditing} emptyTitle="No pincodes match" emptyText="Add them one at a time, or import a CSV from Import & export." />
      {editing ? <PincodeEditor key={editing.id ?? 'new'} pincode={editing} zones={zones} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

export default function ShippingPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'rates';
  const methods = useAdminAll<Method>('shipping/methods');
  const zones = useAdminAll<Zone>('shipping/zones');
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [deletingZone, setDeletingZone] = useState<Zone | null>(null);

  const removeZone = async () => {
    try {
      await adminApi.remove('shipping/zones', deletingZone!.id!);
      qc.invalidateQueries({ queryKey: ['admin', 'shipping/zones'] });
      toast.success('Zone deleted');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete.');
    }
    setDeletingZone(null);
  };

  return (
    <>
      <PageHeader title="Shipping" eyebrow="Store" />
      <div role="tablist" aria-label="Shipping settings" className="mb-5 flex gap-1 border-b border-line">
        {[{ id: 'rates', label: 'Rates' }, { id: 'zones', label: 'Zones' }, { id: 'pincodes', label: 'Pincodes' }].map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setParams({ tab: t.id }, { replace: true })} className={cn('-mb-px border-b-2 px-3 py-2.5 text-sm', tab === t.id ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink')}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'rates' ? (
        methods.isError ? <ErrorState onRetry={() => methods.refetch()} /> : !methods.data ? <Skeleton className="h-80" /> : (
          <div className="grid gap-5 lg:grid-cols-2">{methods.data.map((m) => <MethodCard key={`${m.id}-${m.base_rate_paise}-${m.is_active}`} method={m} />)}</div>
        )
      ) : null}
      {tab === 'zones' ? (
        zones.isError ? <ErrorState onRetry={() => zones.refetch()} /> : !zones.data ? <Skeleton className="h-64" /> : (
          <>
            <div className="mb-3 flex justify-end">
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditingZone({ name: '', standard_days_min: 3, standard_days_max: 6, express_days_min: 1, express_days_max: 2, express_available: true, cod_available: true, extra_fee_paise: 0 })}>New zone</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {zones.data.map((z) => (
                <article key={z.id} className="rounded-sm border border-line bg-surface-raised p-4">
                  <div className="flex items-start justify-between">
                    <h2 className="font-sans text-sm font-semibold text-ink">{z.name}</h2>
                    <span className="text-xs tabular-nums text-ink-muted">{z.pincode_count} pincodes</span>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-ink-soft">
                    <div className="flex justify-between"><dt>Standard</dt><dd>{z.standard_days_min}–{z.standard_days_max} days</dd></div>
                    <div className="flex justify-between"><dt>Express</dt><dd>{z.express_available ? `${z.express_days_min}–${z.express_days_max} days` : 'Not offered'}</dd></div>
                    <div className="flex justify-between"><dt>Cash on delivery</dt><dd>{z.cod_available ? 'Yes' : 'No'}</dd></div>
                    {z.extra_fee_paise ? <div className="flex justify-between"><dt>Extra fee</dt><dd>{formatMoney(z.extra_fee_paise)}</dd></div> : null}
                  </dl>
                  <div className="mt-4 flex justify-end gap-1">
                    <Button size="sm" variant="ghost" className="text-danger" disabled={!!z.pincode_count} title={z.pincode_count ? 'Move its pincodes first' : undefined} onClick={() => setDeletingZone(z)}>Delete</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingZone(z)}>Edit</Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )
      ) : null}
      {tab === 'pincodes' ? <Pincodes zones={zones.data ?? []} /> : null}
      {editingZone ? <ZoneEditor key={editingZone.id ?? 'new'} zone={editingZone} onClose={() => setEditingZone(null)} /> : null}
      <ConfirmDialog open={!!deletingZone} title={`Delete ${deletingZone?.name}?`} danger confirmLabel="Delete" onConfirm={removeZone} onClose={() => setDeletingZone(null)} />
    </>
  );
}
