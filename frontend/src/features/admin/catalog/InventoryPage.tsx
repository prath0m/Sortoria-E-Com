import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { adminApi, useAdminList, useAdminMutation } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FilterSelect, SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';

interface Row {
  id: number;
  sku: string;
  product_id: number;
  product: string;
  label: string;
  stock: number;
  threshold: number;
  low_stock_threshold: number | null;
  price_paise: number;
  is_active: boolean;
  status: 'ok' | 'low' | 'out';
}

interface Movement {
  delta: number;
  balance_after: number;
  reason: string;
  reference: string;
  actor: string;
  created_at: string;
}

function Movements({ row, onClose }: { row: Row; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'inventory', 'movements', row.id], queryFn: () => api<Movement[]>(`/admin/inventory/${row.id}/movements/`) });
  return (
    <Drawer open onClose={onClose} title="Stock history">
      <div className="p-5">
        <p className="font-medium text-ink">{row.product}</p>
        <p className="text-sm text-ink-muted">{row.label || 'Single variant'} · {row.sku}</p>
        {isLoading ? (
          <div className="mt-5 space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.length ? (
          <p className="mt-6 text-sm text-ink-muted">No movements recorded yet.</p>
        ) : (
          <ol className="mt-5 divide-y divide-line/60">
            {data.map((m, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-ink">{m.reason}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {m.reference ? `${m.reference} · ` : ''}
                    {m.actor} · {new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className={cn('font-semibold', m.delta > 0 ? 'text-success' : 'text-danger')}>{m.delta > 0 ? `+${m.delta}` : m.delta}</p>
                  <p className="text-xs text-ink-muted">→ {m.balance_after}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Drawer>
  );
}

export default function InventoryPage() {
  const { state, query, set } = useTableState({ ordering: 'stock' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<Row>('inventory', query);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<Row | null>(null);
  const save = useAdminMutation('inventory', (rows: { variant_id: number; stock: number }[]) => adminApi.post<{ updated: number }>('inventory/bulk/', { rows, note }), {
    success: 'Stock updated',
    invalidate: ['products', 'dashboard'],
  });

  const changed = Object.entries(edits)
    .filter(([id, v]) => v !== '' && Number(v) !== data?.results.find((r) => r.id === Number(id))?.stock)
    .map(([id, v]) => ({ variant_id: Number(id), stock: Math.max(0, Math.floor(Number(v))) }));

  const columns: Column<Row>[] = [
    {
      key: 'product',
      header: 'Product',
      sortKey: 'product__name',
      cell: (r) => (
        <div className="min-w-0">
          <Link to={`/admin/products/${r.product_id}`} className="font-medium text-ink hover:text-accent">{r.product}</Link>
          <p className="text-xs text-ink-muted">{r.label || 'Single variant'}</p>
        </div>
      ),
    },
    { key: 'sku', header: 'SKU', sortKey: 'sku', cell: (r) => <span className="font-mono text-xs text-ink-soft">{r.sku}</span> },
    { key: 'price', header: 'Price', align: 'right', cell: (r) => <span className="tabular-nums text-ink-soft">{formatMoney(r.price_paise)}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} label={r.status === 'ok' ? 'In stock' : r.status === 'low' ? `Low (≤ ${r.threshold})` : 'Out of stock'} /> },
    {
      key: 'stock',
      header: 'Stock',
      sortKey: 'stock',
      align: 'right',
      cell: (r) => {
        const value = edits[r.id] ?? String(r.stock);
        const dirty = edits[r.id] !== undefined && Number(edits[r.id]) !== r.stock;
        return (
          <input
            type="number"
            min={0}
            aria-label={`Stock for ${r.sku}`}
            value={value}
            onChange={(e) => setEdits((x) => ({ ...x, [r.id]: e.target.value }))}
            className={cn('h-9 w-24 rounded-xs border bg-surface px-2 text-right text-sm tabular-nums focus:border-accent focus:outline-none', dirty ? 'border-accent bg-accent-soft' : 'border-line')}
          />
        );
      },
    },
    {
      key: 'history',
      header: '',
      align: 'right',
      cell: (r) => (
        <button type="button" onClick={() => setHistory(r)} aria-label={`Stock history for ${r.sku}`} className="-m-2 inline-flex p-2 text-ink-muted hover:text-ink">
          <History className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Inventory" eyebrow="Catalogue">
        <p className="mt-1 text-sm text-ink-muted">Edit stock inline, then save. Every change is logged with your name and note.</p>
      </PageHeader>
      <Toolbar>
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Search product or SKU" />
        <FilterSelect label="Any stock level" value={state.stock ?? ''} onChange={(v) => set({ stock: v })} options={[{ value: 'low', label: 'Running low' }, { value: 'out', label: 'Out of stock' }, { value: 'ok', label: 'Healthy' }]} />
      </Toolbar>
      {changed.length ? (
        <div className="sticky top-20 z-[5] mb-3 flex flex-wrap items-center gap-3 rounded-sm border border-accent/40 bg-accent-soft px-4 py-2 shadow-soft">
          <span className="text-sm font-semibold text-ink">{changed.length} unsaved {changed.length === 1 ? 'change' : 'changes'}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="Note, e.g. Stock count 28 Oct" aria-label="Note for this adjustment" className="h-9 min-w-0 flex-1 rounded-xs border border-line bg-surface-raised px-2 text-sm sm:max-w-xs" />
          <Button size="sm" variant="ghost" onClick={() => setEdits({})}>Discard</Button>
          <Button size="sm" loading={save.isPending} onClick={() => save.mutate(changed, { onSuccess: () => { setEdits({}); setNote(''); } })}>Save stock</Button>
        </div>
      ) : null}
      <DataTable
        rows={data?.results}
        error={isError}
        onRetry={() => refetch()}
        columns={columns}
        rowKey={(r) => r.id}
        loading={isLoading}
        fetching={isFetching}
        ordering={state.ordering}
        onOrdering={(o) => set({ ordering: o })}
        page={data?.page}
        totalPages={data?.total_pages}
        count={data?.count}
        onPage={(p) => set({ page: String(p) })}
        emptyTitle="Nothing matches"
        emptyText="No variants match these filters."
      />
      {history ? <Movements row={history} onClose={() => setHistory(null)} /> : null}
    </>
  );
}
