import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminAll } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextArea, TextField } from '@/components/ui/Field';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { ImageInput } from '../components/ImageInput';
import { type FileChange } from '../components/files';
import { DateTimeInput, Switch } from '../components/inputs';
import { ProductChip, ProductPicker, type ProductRef } from '../components/ProductPicker';
import { saveWithFiles } from '../components/save';
import { SortableList } from '../components/SortableList';
import { categoryOptions, useCatalogOptions } from '../products/useCatalogOptions';

type Row = Record<string, unknown> & { id: number; is_active?: boolean; position?: number };

export type FieldSpec =
  | { name: string; label: string; type: 'text' | 'url'; hint?: string; optional?: boolean; maxLength?: number }
  | { name: string; label: string; type: 'textarea'; hint?: string; optional?: boolean; rows?: number; maxLength?: number }
  | { name: string; label: string; type: 'number'; hint?: string; min?: number; max?: number; optional?: boolean }
  | { name: string; label: string; type: 'select'; options: { value: string; label: string }[]; hint?: string }
  | { name: string; label: string; type: 'checkbox'; hint?: string }
  | { name: string; label: string; type: 'datetime'; hint?: string; optional?: boolean }
  | { name: string; label: string; type: 'image'; hint?: string; aspect?: string; clearable?: boolean }
  | { name: string; label: string; type: 'products'; hint?: string }
  | { name: string; label: string; type: 'categories'; hint?: string };

export interface CollectionProps {
  resource: string;
  noun: string;
  fields: FieldSpec[] | ((draft: Record<string, unknown>) => FieldSpec[]);
  blank: () => Record<string, unknown>;
  renderRow: (row: Row) => ReactNode;
  filter?: (row: Row) => boolean;
  sortable?: boolean;
  emptyText: string;
  invalidate?: string[];
  newButton?: ReactNode;
  /** Open the editor for a fresh record (used by pages that pick a type first). */
  creating?: Record<string, unknown> | null;
  onCreatingDone?: () => void;
}

function FieldInput({ spec, draft, set, files, setFile, errors }: { spec: FieldSpec; draft: Record<string, unknown>; set: (k: string, v: unknown) => void; files: Record<string, FileChange>; setFile: (k: string, f: FileChange) => void; errors: Record<string, string[]> }) {
  const { data: options } = useCatalogOptions();
  const error = errors[spec.name]?.[0];
  const value = draft[spec.name];
  switch (spec.type) {
    case 'text':
    case 'url':
      return <TextField label={spec.label} optional={spec.optional} hint={spec.hint} maxLength={spec.maxLength} error={error} value={String(value ?? '')} onChange={(e) => set(spec.name, e.target.value)} />;
    case 'textarea':
      return <TextArea label={spec.label} optional={spec.optional} hint={spec.hint} rows={spec.rows ?? 3} maxLength={spec.maxLength} error={error} value={String(value ?? '')} onChange={(e) => set(spec.name, e.target.value)} />;
    case 'number':
      return <TextField label={spec.label} type="number" min={spec.min} max={spec.max} optional={spec.optional} hint={spec.hint} error={error} value={value == null ? '' : String(value)} onChange={(e) => set(spec.name, e.target.value === '' ? null : Number(e.target.value))} />;
    case 'select':
      return <SelectField label={spec.label} hint={spec.hint} error={error} value={String(value ?? '')} options={spec.options} onChange={(e) => set(spec.name, e.target.value)} />;
    case 'checkbox':
      return <Checkbox label={spec.label} description={spec.hint} checked={!!value} onChange={(e) => set(spec.name, e.target.checked)} />;
    case 'datetime':
      return <DateTimeInput label={spec.label} optional={spec.optional} hint={spec.hint} error={error} value={(value as string | null) ?? null} onChange={(v) => set(spec.name, v)} />;
    case 'image':
      return (
        <div>
          <ImageInput label={spec.label} hint={spec.hint} aspect={spec.aspect} clearable={spec.clearable} current={value as string | null} file={files[spec.name] ?? null} onChange={(f) => setFile(spec.name, f)} />
          {error ? <p role="alert" className="mt-1 text-[0.8125rem] text-danger">{error}</p> : null}
        </div>
      );
    case 'products': {
      const picked = (draft.products_detail as ProductRef[] | undefined) ?? [];
      const update = (next: ProductRef[]) => {
        set('products_detail', next);
        set('products', next.map((p) => p.id));
      };
      return (
        <fieldset className="space-y-2">
          <ProductPicker label={spec.label} exclude={picked.map((p) => p.id)} onPick={(p) => update([...picked, p])} />
          {spec.hint ? <p className="text-xs text-ink-muted">{spec.hint}</p> : null}
          {picked.map((p) => <ProductChip key={p.id} product={p} onRemove={() => update(picked.filter((x) => x.id !== p.id))} />)}
        </fieldset>
      );
    }
    case 'categories':
      return (
        <label className="block text-sm font-medium text-ink">
          {spec.label}
          <select
            multiple
            value={((value as number[]) ?? []).map(String)}
            onChange={(e) => set(spec.name, Array.from(e.target.selectedOptions, (o) => Number(o.value)))}
            className="mt-1.5 h-40 w-full rounded-xs border border-line bg-surface px-2 py-1 text-sm font-normal"
          >
            {categoryOptions(options).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {spec.hint ? <span className="mt-1 block text-xs font-normal text-ink-muted">{spec.hint}</span> : null}
        </label>
      );
  }
}

function Editor({ resource, noun, fields, record, onClose, invalidate }: { resource: string; noun: string; fields: CollectionProps['fields']; record: Record<string, unknown>; onClose: () => void; invalidate?: string[] }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(record);
  const [files, setFiles] = useState<Record<string, FileChange>>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const specs = typeof fields === 'function' ? fields(draft) : fields;
  const id = record.id as number | undefined;

  const save = async () => {
    setSaving(true);
    setErrors({});
    const body: Record<string, unknown> = {};
    for (const spec of specs) {
      if (spec.type === 'image') continue;
      if (spec.type === 'products') body.products = draft.products ?? [];
      else body[spec.name] = draft[spec.name];
    }
    for (const key of ['type', 'placement', 'kind']) if (key in draft && !(key in body)) body[key] = draft[key];
    const imageChanges = Object.fromEntries(specs.filter((s) => s.type === 'image').map((s) => [s.name, files[s.name] ?? null]));
    try {
      await saveWithFiles(resource, id, body, imageChanges);
      for (const key of [resource.split('/')[0], ...(invalidate ?? [])]) qc.invalidateQueries({ queryKey: ['admin', key] });
      qc.invalidateQueries({ queryKey: ['admin', resource] });
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} saved`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors);
        toast.error('Please fix the highlighted fields.');
      } else toast.error(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open onClose={onClose} title={id ? `Edit ${noun}` : `New ${noun}`} className="max-w-xl" footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>}>
      <div className="space-y-5 p-5">
        {specs.map((spec) => (
          <FieldInput key={spec.name} spec={spec} draft={draft} errors={errors} files={files} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} setFile={(k, f) => setFiles((x) => ({ ...x, [k]: f }))} />
        ))}
      </div>
    </Drawer>
  );
}

/** A reorderable, toggleable list of CMS records with a drawer editor generated from field specs. */
export function Collection({ resource, noun, fields, blank, renderRow, filter, sortable = true, emptyText, invalidate, newButton, creating, onCreatingDone }: CollectionProps) {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useAdminAll<Row>(resource);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [order, setOrder] = useState<number[] | null>(null);
  const rows = (data ?? []).filter(filter ?? (() => true));
  const sorted = order ? order.map((id) => rows.find((r) => r.id === id)).filter((r): r is Row => !!r) : rows;
  const open = editing ?? creating ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', resource] });

  const reorder = async (next: Row[]) => {
    setOrder(next.map((r) => r.id));
    try {
      await adminApi.post(`${resource}/reorder/`, { ids: next.map((r) => r.id) });
      await refresh();
    } catch {
      toast.error('Could not save the new order.');
    }
    setOrder(null);
  };
  const toggle = async (row: Row) => {
    try {
      await adminApi.update(resource, row.id, { is_active: !row.is_active });
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update.');
    }
  };
  const remove = async () => {
    try {
      await adminApi.remove(resource, deleting!.id);
      refresh();
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} deleted`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete.');
    }
    setDeleting(null);
  };

  const rowContent = (row: Row) => (
    <>
      <button type="button" onClick={() => setEditing(row)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {renderRow(row)}
      </button>
      {'is_active' in row ? <Switch checked={!!row.is_active} onChange={() => toggle(row)} label={`Show this ${noun}`} /> : null}
      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(row)}>Delete</Button>
    </>
  );

  return (
    <div>
      <div className="mb-3 flex justify-end">{newButton ?? <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing(blank())}>Add {noun}</Button>}</div>
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-48" />
      ) : !sorted.length ? (
        <p className="rounded-sm border border-line bg-surface-raised px-6 py-12 text-center text-sm text-ink-soft">{emptyText}</p>
      ) : sortable ? (
        <SortableList items={sorted} onReorder={reorder} label={() => noun} render={rowContent} />
      ) : (
        <ul className="rounded-sm border border-line bg-surface-raised">
          {sorted.map((row) => <li key={row.id} className="flex items-center gap-3 border-b border-line/60 px-3 py-3 last:border-0">{rowContent(row)}</li>)}
        </ul>
      )}
      {open ? (
        <Editor
          key={String(open.id ?? 'new')}
          resource={resource}
          noun={noun}
          fields={fields}
          record={open}
          invalidate={invalidate}
          onClose={() => {
            setEditing(null);
            onCreatingDone?.();
          }}
        />
      ) : null}
      <ConfirmDialog open={!!deleting} title={`Delete this ${noun}?`} danger confirmLabel="Delete" onConfirm={remove} onClose={() => setDeleting(null)}>
        This can't be undone. To hide it for now, switch it off instead.
      </ConfirmDialog>
    </div>
  );
}

export function Thumb({ src, wide }: { src?: unknown; wide?: boolean }) {
  return <span className={`${wide ? 'h-12 w-20' : 'h-12 w-12'} shrink-0 overflow-hidden rounded-xs bg-ink/5`}>{typeof src === 'string' && src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}</span>;
}

export function RowText({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium text-ink">{title}</span>
      {sub ? <span className="block truncate text-xs text-ink-muted">{sub}</span> : null}
    </span>
  );
}
