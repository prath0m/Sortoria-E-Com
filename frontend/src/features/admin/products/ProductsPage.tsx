import { Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import { adminApi, useAdminList, useAdminMutation } from '@/api/hooks/adminCrud';
import { Button, ButtonLink } from '@/components/ui/Button';
import { formatMoney } from '@/lib/money';
import { useAuth } from '@/stores/auth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { BulkBar, FilterSelect, SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';
import { categoryOptions, useCatalogOptions } from './useCatalogOptions';
import type { ProductRow } from './types';

export default function ProductsPage() {
  const { state, query, set, selected, setSelected } = useTableState({ ordering: '-updated_at' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<ProductRow>('products', query);
  const { data: options } = useCatalogOptions();
  const canDelete = useAuth((s) => s.user?.capabilities.includes('catalog.delete'));
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const bulk = useAdminMutation('products', (body: Record<string, unknown>) => adminApi.post<Record<string, number>>('products/bulk/', body));

  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    const result = await bulk.mutateAsync({ ids: [...selected], action, ...extra });
    setSelected(new Set());
    setConfirmDelete(false);
    if (result.skipped) toast.warning(`${result.deleted} deleted. ${result.skipped} have orders and were kept; deactivate them instead.`);
  };

  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      header: 'Product',
      sortKey: 'name',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-10 shrink-0 overflow-hidden rounded-xs bg-ink/5">{p.thumb ? <img src={p.thumb} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}</div>
          <div className="min-w-0">
            <Link to={`/admin-panel/products/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:text-accent">
              {p.name}
            </Link>
            <p className="text-xs text-ink-muted">
              {[p.brand, p.category].filter(Boolean).join(' · ')} · {p.variant_count} {p.variant_count === 1 ? 'variant' : 'variants'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      sortKey: 'min_price_paise',
      align: 'right',
      cell: (p) => <span className="tabular-nums">{p.max_price_paise > p.min_price_paise ? `${formatMoney(p.min_price_paise)}+` : formatMoney(p.min_price_paise)}</span>,
    },
    { key: 'stock', header: 'Stock', sortKey: 'total_stock', align: 'right', cell: (p) => <span className={p.in_stock ? 'tabular-nums' : 'font-semibold text-danger'}>{p.in_stock ? p.total_stock : 'Out'}</span> },
    { key: 'sold', header: 'Sold', sortKey: 'sales_count', align: 'right', cell: (p) => <span className="tabular-nums text-ink-soft">{p.sales_count}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => (
        <div className="flex gap-1">
          <StatusBadge status={p.is_active ? 'active' : 'inactive'} />
          {p.is_featured ? <StatusBadge status="featured" label="Featured" className="bg-iris-300/30 text-ink" /> : null}
        </div>
      ),
    },
    { key: 'updated', header: 'Updated', sortKey: 'updated_at', cell: (p) => <span className="whitespace-nowrap text-xs text-ink-muted">{new Date(p.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span> },
  ];

  return (
    <>
      <PageHeader title="Products" eyebrow="Catalogue" actions={<ButtonLink to="/admin-panel/products/new" icon={<Plus className="h-4 w-4" />}>New product</ButtonLink>} />
      <Toolbar>
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Search name, SKU or brand" />
        <FilterSelect label="All categories" value={state.category ?? ''} onChange={(v) => set({ category: v })} options={categoryOptions(options)} />
        <FilterSelect label="All brands" value={state.brand ?? ''} onChange={(v) => set({ brand: v })} options={(options?.brands ?? []).map((b) => ({ value: String(b.id), label: b.name }))} />
        <FilterSelect label="Any status" value={state.status ?? ''} onChange={(v) => set({ status: v })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'featured', label: 'Featured' }]} />
        <FilterSelect label="Any stock" value={state.stock ?? ''} onChange={(v) => set({ stock: v })} options={[{ value: 'in', label: 'In stock' }, { value: 'out', label: 'Out of stock' }]} />
      </Toolbar>
      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button size="sm" variant="ghost" onClick={() => run('activate')}>Activate</Button>
        <Button size="sm" variant="ghost" onClick={() => run('deactivate')}>Deactivate</Button>
        <Button size="sm" variant="ghost" onClick={() => run('feature')}>Feature</Button>
        <Button size="sm" variant="ghost" onClick={() => run('unfeature')}>Unfeature</Button>
        <select
          aria-label="Move to category"
          value={moveTo}
          onChange={(e) => {
            setMoveTo('');
            if (e.target.value) run('set_category', { category: Number(e.target.value) });
          }}
          className="h-9 rounded-xs border border-line bg-surface-raised px-2 text-xs"
        >
          <option value="">Move to category…</option>
          {categoryOptions(options, true).map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        {canDelete ? (
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        ) : null}
      </BulkBar>
      <DataTable
        rows={data?.results}
        error={isError}
        onRetry={() => refetch()}
        columns={columns}
        rowKey={(p) => p.id}
        loading={isLoading}
        fetching={isFetching}
        ordering={state.ordering}
        onOrdering={(o) => set({ ordering: o })}
        page={data?.page}
        totalPages={data?.total_pages}
        count={data?.count}
        onPage={(p) => set({ page: String(p) })}
        selected={selected}
        onSelect={setSelected}
        onRowClick={(p) => navigate(`/admin-panel/products/${p.id}`)}
        emptyTitle="No products match"
        emptyText="Try a different search or clear the filters."
      />
      <ConfirmDialog open={confirmDelete} title={`Delete ${selected.size} products?`} danger confirmLabel="Delete" loading={bulk.isPending} onConfirm={() => run('delete')} onClose={() => setConfirmDelete(false)}>
        Products with past orders are kept for your records; deactivate those instead. This can't be undone.
      </ConfirmDialog>
    </>
  );
}
