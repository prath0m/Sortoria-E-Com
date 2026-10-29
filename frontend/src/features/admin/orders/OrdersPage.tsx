import { Download } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, downloadFile, useAdminList, useAdminMutation } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { useAuth } from '@/stores/auth';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { BulkBar, FilterSelect, SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';
import { dateTime, ORDER_STATUSES, PAYMENT_LABEL, type OrderRow } from './types';

const QUICK: { label: string; status: string }[] = [
  { label: 'All', status: '' },
  { label: 'To confirm', status: 'placed' },
  { label: 'To pack', status: 'confirmed' },
  { label: 'To ship', status: 'packed' },
  { label: 'In transit', status: 'shipped' },
  { label: 'Delivered', status: 'delivered' },
];

const BULK_TARGETS = ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'] as const;

export default function OrdersPage() {
  const { state, query, set, selected, setSelected } = useTableState({ ordering: '-created_at' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<OrderRow>('orders', query);
  const navigate = useNavigate();
  const canManage = useAuth((s) => s.user?.capabilities.includes('orders.manage'));
  const [downloading, setDownloading] = useState(false);
  const bulk = useAdminMutation('orders', (body: Record<string, unknown>) => adminApi.post<{ updated: string[]; failed: { number: string; reason: string }[] }>('orders/bulk/', body), {
    invalidate: ['dashboard'],
  });

  const transition = async (status: string) => {
    const result = await bulk.mutateAsync({ numbers: [...selected], action: 'transition', status });
    setSelected(new Set());
    if (result.updated.length) toast.success(`${result.updated.length} ${result.updated.length === 1 ? 'order' : 'orders'} updated`);
    if (result.failed.length) toast.warning(`${result.failed.length} skipped: ${result.failed.slice(0, 3).map((f) => `${f.number} (${f.reason})`).join(', ')}`);
  };

  const invoices = async () => {
    setDownloading(true);
    try {
      await downloadFile('/admin/orders/bulk/', 'invoices.pdf', { method: 'POST', body: { numbers: [...selected], action: 'invoices' } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not prepare the invoices.');
    } finally {
      setDownloading(false);
    }
  };

  const columns: Column<OrderRow>[] = [
    {
      key: 'number',
      header: 'Order',
      sortKey: 'created_at',
      cell: (o) => (
        <div>
          <Link to={`/admin/orders/${o.number}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:text-accent">
            {o.number}
          </Link>
          <p className="whitespace-nowrap text-xs text-ink-muted">{dateTime(o.placed_at ?? o.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (o) => (
        <div className="min-w-0 max-w-[14rem]">
          <p className="truncate text-ink">{o.customer}</p>
          <p className="truncate text-xs text-ink-muted">{o.email}</p>
        </div>
      ),
    },
    { key: 'items', header: 'Items', align: 'right', cell: (o) => <span className="tabular-nums text-ink-soft">{o.item_count}</span> },
    { key: 'total', header: 'Total', sortKey: 'grand_total_paise', align: 'right', cell: (o) => <span className="font-medium tabular-nums">{formatMoney(o.grand_total_paise)}</span> },
    {
      key: 'payment',
      header: 'Payment',
      cell: (o) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-xs text-ink-soft">{PAYMENT_LABEL[o.payment_method] ?? o.payment_method}</span>
          <StatusBadge status={o.payment_status} />
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (o) => <StatusBadge status={o.status} label={o.status_label} /> },
  ];

  return (
    <>
      <PageHeader title="Orders" eyebrow="Sales" />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="group" aria-label="Quick filters">
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            aria-pressed={(state.status ?? '') === q.status}
            onClick={() => set({ status: q.status })}
            className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm', (state.status ?? '') === q.status ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
          >
            {q.label}
          </button>
        ))}
      </div>
      <Toolbar>
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Order number, name, email, phone" />
        <FilterSelect label="Any status" value={state.status ?? ''} onChange={(v) => set({ status: v })} options={ORDER_STATUSES} />
        <FilterSelect label="Any payment" value={state.payment_method ?? ''} onChange={(v) => set({ payment_method: v })} options={[{ value: 'razorpay', label: 'Online' }, { value: 'cod', label: 'Cash on delivery' }]} />
        <FilterSelect label="Any payment status" value={state.payment_status ?? ''} onChange={(v) => set({ payment_status: v })} options={['pending', 'paid', 'failed', 'refunded', 'partially_refunded'].map((s) => ({ value: s, label: s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) }))} />
        <label className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
          From
          <input type="date" value={state.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value })} className="h-10 min-w-0 flex-1 rounded-xs border border-line bg-surface-raised px-2 text-sm text-ink sm:flex-none" />
        </label>
        <label className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
          To
          <input type="date" value={state.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value })} className="h-10 min-w-0 flex-1 rounded-xs border border-line bg-surface-raised px-2 text-sm text-ink sm:flex-none" />
        </label>
        {Object.keys(state).some((k) => !['ordering', 'page'].includes(k)) ? (
          <Button size="sm" variant="ghost" onClick={() => set({ search: null, status: null, payment_method: null, payment_status: null, date_from: null, date_to: null })}>
            Clear filters
          </Button>
        ) : null}
      </Toolbar>
      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        {canManage ? (
          <select
            aria-label="Move selected orders to"
            value=""
            disabled={bulk.isPending}
            onChange={(e) => e.target.value && transition(e.target.value)}
            className="h-9 rounded-xs border border-line bg-surface-raised px-2 text-xs"
          >
            <option value="">Mark as…</option>
            {BULK_TARGETS.map((s) => <option key={s} value={s}>{ORDER_STATUSES.find((x) => x.value === s)?.label}</option>)}
          </select>
        ) : null}
        <Button size="sm" variant="ghost" loading={downloading} icon={<Download className="h-3.5 w-3.5" />} onClick={invoices}>
          Invoices
        </Button>
      </BulkBar>
      <DataTable
        rows={data?.results}
        error={isError}
        onRetry={() => refetch()}
        columns={columns}
        rowKey={(o) => o.number}
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
        onRowClick={(o) => navigate(`/admin/orders/${o.number}`)}
        emptyTitle="No orders here"
        emptyText="Orders matching these filters will appear here."
      />
    </>
  );
}
