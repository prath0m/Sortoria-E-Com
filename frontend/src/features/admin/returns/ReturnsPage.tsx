import { Link, useNavigate } from 'react-router-dom';
import { useAdminList } from '@/api/hooks/adminCrud';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FilterSelect, SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';
import { dateTime } from '../orders/types';

interface ReturnRow {
  number: string;
  order_number: string;
  customer: string;
  email: string;
  status: string;
  status_label: string;
  reason: string;
  reason_label: string;
  resolution: 'refund' | 'replacement';
  refund_amount_paise: number;
  item_count: number;
  created_at: string;
}

export const RETURN_REASONS = [
  { value: 'wrong_size', label: "Doesn't fit" },
  { value: 'damaged', label: 'Arrived damaged' },
  { value: 'defective', label: 'Faulty or not working' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'other', label: 'Something else' },
];

const QUICK = [
  { label: 'All', status: '' },
  { label: 'New', status: 'requested' },
  { label: 'Approved', status: 'approved' },
  { label: 'Pickup scheduled', status: 'pickup_scheduled' },
  { label: 'Received', status: 'received' },
  { label: 'Refunded', status: 'refunded' },
  { label: 'Replaced', status: 'replaced' },
  { label: 'Rejected', status: 'rejected' },
];

export default function ReturnsPage() {
  const { state, query, set } = useTableState({ ordering: '-created_at' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<ReturnRow>('returns', query);
  const navigate = useNavigate();

  const columns: Column<ReturnRow>[] = [
    {
      key: 'number',
      header: 'Return',
      sortKey: 'created_at',
      cell: (r) => (
        <div>
          <Link to={`/admin-panel/returns/${r.number}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:text-accent">{r.number}</Link>
          <p className="whitespace-nowrap text-xs text-ink-muted">{dateTime(r.created_at)}</p>
        </div>
      ),
    },
    { key: 'order', header: 'Order', cell: (r) => <span className="text-ink-soft">{r.order_number}</span> },
    {
      key: 'customer',
      header: 'Customer',
      cell: (r) => (
        <div className="max-w-[14rem]">
          <p className="truncate text-ink">{r.customer}</p>
          <p className="truncate text-xs text-ink-muted">{r.email}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (r) => (
        <div>
          <p className="text-ink-soft">{r.reason_label}</p>
          <p className="text-xs text-ink-muted">{r.item_count} {r.item_count === 1 ? 'item' : 'items'} · {r.resolution === 'refund' ? 'Refund' : 'Replacement'}</p>
        </div>
      ),
    },
    { key: 'amount', header: 'Refund', sortKey: 'refund_amount_paise', align: 'right', cell: (r) => <span className="tabular-nums">{r.resolution === 'refund' ? formatMoney(r.refund_amount_paise) : '—'}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} label={r.status_label} /> },
  ];

  return (
    <>
      <PageHeader title="Returns" eyebrow="Sales" />
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
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Return or order number, email" />
        <FilterSelect label="Any reason" value={state.reason ?? ''} onChange={(v) => set({ reason: v })} options={RETURN_REASONS} />
        <FilterSelect label="Refund or replacement" value={state.resolution ?? ''} onChange={(v) => set({ resolution: v })} options={[{ value: 'refund', label: 'Refund' }, { value: 'replacement', label: 'Replacement' }]} />
      </Toolbar>
      <DataTable
        rows={data?.results}
        error={isError}
        onRetry={() => refetch()}
        columns={columns}
        rowKey={(r) => r.number}
        loading={isLoading}
        fetching={isFetching}
        ordering={state.ordering}
        onOrdering={(o) => set({ ordering: o })}
        page={data?.page}
        totalPages={data?.total_pages}
        count={data?.count}
        onPage={(p) => set({ page: String(p) })}
        onRowClick={(r) => navigate(`/admin-panel/returns/${r.number}`)}
        emptyTitle="No returns here"
        emptyText="Return requests matching these filters will appear here."
      />
    </>
  );
}
