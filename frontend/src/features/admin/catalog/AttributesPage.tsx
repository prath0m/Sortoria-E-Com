import { useQueryClient } from '@tanstack/react-query';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminAll } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextField } from '@/components/ui/Field';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { flattenErrors } from '../components/errors';

interface Value {
  id?: number;
  value: string;
  slug?: string;
  hex: string;
  numeric_value: string | null;
  position?: number;
}

interface Attribute {
  id?: number;
  name: string;
  slug: string;
  kind: 'swatch' | 'text' | 'numeric';
  unit: string;
  is_variant_axis: boolean;
  is_filterable: boolean;
  position: number;
  values: Value[];
}

const KIND_LABEL = { swatch: 'Colour swatch', text: 'Text', numeric: 'Numeric' };

function Editor({ attribute, onClose }: { attribute: Attribute; onClose: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(attribute);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const setValue = (i: number, patch: Partial<Value>) => setDraft((d) => ({ ...d, values: d.values.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));

  const save = async () => {
    setSaving(true);
    setError('');
    const body = { ...draft, values: draft.values.filter((v) => v.value.trim()).map((v, position) => ({ ...v, position })) };
    try {
      if (draft.id) await adminApi.update('attributes', draft.id, body, 'PUT');
      else await adminApi.create('attributes', body);
      qc.invalidateQueries({ queryKey: ['admin', 'attributes'] });
      qc.invalidateQueries({ queryKey: ['admin', 'catalog-options'] });
      toast.success('Attribute saved');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? flattenErrors(err.data).join(' · ') || err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  // Reorder values with drag (pointer) or the move buttons (keyboard).
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.values.length) return;
    const values = [...draft.values];
    const [item] = values.splice(from, 1);
    values.splice(to, 0, item);
    setDraft({ ...draft, values });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={draft.id ? `Edit ${attribute.name}` : 'New attribute'}
      className="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save</Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        {error ? <p role="alert" className="rounded-xs bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <TextField label="Slug" value={draft.slug} hint="Used in filter URLs, e.g. ?colour=navy" onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
          <SelectField label="Kind" value={draft.kind} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Attribute['kind'] })} />
          <TextField label="Unit" optional value={draft.unit} hint="For numeric values, e.g. GB or ml." onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
        </div>
        <Checkbox label="Products can vary by this" description="Shows it in the variant builder, e.g. Size or Colour." checked={draft.is_variant_axis} onChange={(e) => setDraft({ ...draft, is_variant_axis: e.target.checked })} />
        <Checkbox label="Use as a filter" description="Categories still choose which filters they show." checked={draft.is_filterable} onChange={(e) => setDraft({ ...draft, is_filterable: e.target.checked })} />

        <fieldset className="border-t border-line pt-5">
          <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Values</legend>
          <ul className="mt-3 space-y-2">
            {draft.values.map((v, i) => (
              <li
                key={v.id ?? `new-${i}`}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIndex !== null) move(dragIndex, i); setDragIndex(null); }}
                className="flex items-center gap-2"
              >
                <span className="cursor-grab text-ink-muted" aria-hidden="true"><GripVertical className="h-4 w-4" /></span>
                <input aria-label={`Value ${i + 1}`} value={v.value} onChange={(e) => setValue(i, { value: e.target.value })} className="h-9 min-w-0 flex-1 rounded-xs border border-line bg-surface px-2 text-sm" />
                {draft.kind === 'swatch' ? (
                  <input aria-label={`Colour for ${v.value || `value ${i + 1}`}`} type="color" value={v.hex || '#000000'} onChange={(e) => setValue(i, { hex: e.target.value.toUpperCase() })} className="h-9 w-10 cursor-pointer rounded-xs border border-line bg-surface p-0.5" />
                ) : null}
                {draft.kind === 'numeric' ? (
                  <input aria-label={`Number for ${v.value || `value ${i + 1}`}`} inputMode="decimal" placeholder="Sort value" value={v.numeric_value ?? ''} onChange={(e) => setValue(i, { numeric_value: e.target.value || null })} className="h-9 w-24 rounded-xs border border-line bg-surface px-2 text-sm" />
                ) : null}
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${v.value} up`} className="px-1 text-xs text-ink-muted hover:text-ink disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === draft.values.length - 1} aria-label={`Move ${v.value} down`} className="px-1 text-xs text-ink-muted hover:text-ink disabled:opacity-30">↓</button>
                <button type="button" onClick={() => setDraft({ ...draft, values: draft.values.filter((_, j) => j !== i) })} aria-label={`Remove ${v.value}`} className="text-ink-muted hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="ghost" className="mt-3" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setDraft({ ...draft, values: [...draft.values, { value: '', hex: '', numeric_value: null }] })}>
            Add value
          </Button>
          <p className="mt-2 text-xs text-ink-muted">Values used by products can't be removed.</p>
        </fieldset>
      </div>
    </Drawer>
  );
}

export default function AttributesPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useAdminAll<Attribute>('attributes');
  const [editing, setEditing] = useState<Attribute | null>(null);
  const [deleting, setDeleting] = useState<Attribute | null>(null);

  const remove = async () => {
    try {
      await adminApi.remove('attributes', deleting!.id!);
      qc.invalidateQueries({ queryKey: ['admin', 'attributes'] });
      qc.invalidateQueries({ queryKey: ['admin', 'catalog-options'] });
      toast.success('Attribute deleted');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete.');
    }
    setDeleting(null);
  };

  return (
    <>
      <PageHeader
        title="Attributes"
        eyebrow="Catalogue"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ name: '', slug: '', kind: 'text', unit: '', is_variant_axis: true, is_filterable: true, position: data?.length ?? 0, values: [] })}>New attribute</Button>}
      >
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Sizes, colours, capacities and materials. They drive variants and storefront filters.</p>
      </PageHeader>
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : !data?.length ? (
        <p className="rounded-sm border border-line bg-surface-raised p-8 text-center text-sm text-ink-soft">No attributes yet. Add Size or Colour to start building variants.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((a) => (
            <article key={a.id} className="flex flex-col rounded-sm border border-line bg-surface-raised p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-sans text-sm font-semibold text-ink">{a.name}</h2>
                  <p className="text-xs text-ink-muted">
                    {KIND_LABEL[a.kind]}
                    {a.is_variant_axis ? ' · Variant option' : ''}
                    {a.is_filterable ? ' · Filter' : ''}
                  </p>
                </div>
                <span className="text-xs tabular-nums text-ink-muted">{a.values.length}</span>
              </div>
              <div className="mt-3 flex flex-1 flex-wrap content-start gap-1">
                {a.values.slice(0, 14).map((v) => (
                  <span key={v.id} className="inline-flex items-center gap-1 rounded-xs bg-ink/5 px-1.5 py-0.5 text-xs text-ink-soft">
                    {v.hex ? <span className="h-2.5 w-2.5 rounded-full ring-1 ring-ink/20" style={{ background: v.hex }} aria-hidden="true" /> : null}
                    {v.value}
                  </span>
                ))}
                {a.values.length > 14 ? <span className="px-1 text-xs text-ink-muted">+{a.values.length - 14} more</span> : null}
              </div>
              <div className="mt-4 flex justify-end gap-1">
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(a)}>Delete</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(a)}>Edit</Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing ? <Editor key={editing.id ?? 'new'} attribute={editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.name}?`} danger confirmLabel="Delete" onConfirm={remove} onClose={() => setDeleting(null)}>
        Attributes in use by products can't be deleted.
      </ConfirmDialog>
    </>
  );
}
