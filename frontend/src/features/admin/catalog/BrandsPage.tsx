import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminList } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Checkbox, TextArea, TextField } from '@/components/ui/Field';
import { Drawer } from '@/components/ui/Overlay';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type Column } from '../components/DataTable';
import { ImageInput } from '../components/ImageInput';
import { filesForm, type FileChange } from '../components/files';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';

interface Brand {
  id?: number;
  name: string;
  slug: string;
  logo?: string | null;
  description: string;
  is_active: boolean;
  product_count?: number;
}

function Editor({ brand, onClose }: { brand: Brand; onClose: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(brand);
  const [logo, setLogo] = useState<FileChange>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const { logo: _logo, product_count: _count, ...body } = draft;
    try {
      const saved = draft.id ? await adminApi.update<Brand>('brands', draft.id, body) : await adminApi.create<Brand>('brands', body);
      const form = filesForm({ logo });
      if (form) await adminApi.update('brands', saved.id!, form);
      qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
      qc.invalidateQueries({ queryKey: ['admin', 'catalog-options'] });
      toast.success(draft.id ? 'Brand saved' : 'Brand created');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else toast.error(err instanceof ApiError ? err.message : 'Could not save the brand.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={draft.id ? `Edit ${brand.name}` : 'New brand'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{draft.id ? 'Save' : 'Create'}</Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <TextField label="Name" value={draft.name} error={errors.name?.[0]} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <TextField label="URL slug" optional value={draft.slug} error={errors.slug?.[0]} hint="Leave blank to generate from the name." onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
        <TextArea label="About the brand" optional rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <div className="w-40">
          <ImageInput label="Logo" current={brand.logo} file={logo} onChange={setLogo} aspect="aspect-square" fit="contain" clearable hint="Square, transparent PNG works best." />
        </div>
        <Checkbox label="Active" description="Inactive brands are hidden from filters and the brand page." checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
      </div>
    </Drawer>
  );
}

export default function BrandsPage() {
  const qc = useQueryClient();
  const { state, query, set } = useTableState({ ordering: 'name' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<Brand>('brands', query);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);

  const remove = async () => {
    try {
      await adminApi.remove('brands', deleting!.id!);
      qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
      toast.success('Brand deleted');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the brand.');
    }
    setDeleting(null);
  };

  const columns: Column<Brand>[] = [
    {
      key: 'name',
      header: 'Brand',
      sortKey: 'name',
      cell: (b) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-line bg-surface">
            {b.logo ? <img src={b.logo} alt="" className="h-full w-full object-contain" /> : <span className="font-display text-lg text-ink-muted">{b.name[0]}</span>}
          </div>
          <span className="font-medium text-ink">{b.name}</span>
        </div>
      ),
    },
    { key: 'products', header: 'Products', sortKey: 'product_count', align: 'right', cell: (b) => <span className="tabular-nums">{b.product_count}</span> },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.is_active ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (b) => (
        <Button size="sm" variant="ghost" className="text-danger" disabled={!!b.product_count} title={b.product_count ? 'Brands with products can’t be deleted' : undefined} onClick={(e) => { e.stopPropagation(); setDeleting(b); }}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Brands" eyebrow="Catalogue" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ name: '', slug: '', description: '', is_active: true })}>New brand</Button>} />
      <Toolbar>
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Search brands" />
      </Toolbar>
      <DataTable
        rows={data?.results}
        error={isError}
        onRetry={() => refetch()}
        columns={columns}
        rowKey={(b) => b.id!}
        loading={isLoading}
        fetching={isFetching}
        ordering={state.ordering}
        onOrdering={(o) => set({ ordering: o })}
        page={data?.page}
        totalPages={data?.total_pages}
        count={data?.count}
        onPage={(p) => set({ page: String(p) })}
        onRowClick={setEditing}
        emptyTitle="No brands found"
      />
      {editing ? <Editor key={editing.id ?? 'new'} brand={editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.name}?`} danger confirmLabel="Delete" onConfirm={remove} onClose={() => setDeleting(null)}>
        This can't be undone.
      </ConfirmDialog>
    </>
  );
}
