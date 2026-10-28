import { Link, useNavigate } from 'react-router-dom';
import { useAdminList } from '@/api/hooks/adminCrud';
import { formatMoney } from '@/lib/money';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FilterSelect, SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';
import { shortDate } from '../orders/types';

export interface CustomerRow {
  id: number;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  marketing_opt_in: boolean;
  date_joined: string;
  last_login: string | null;
  order_count: number;
  lifetime_value: number;
  last_order_at: string | null;
}

export default function CustomersPage() {
  const { state, query, set } = useTableState({ ordering: '-date_joined' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<CustomerRow>('customers', query);
  const navigate = useNavigate();

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Customer',
      cell: (c) => (
        <div className="max-w-[16rem]">
          <Link to={`/admin-panel/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink hover:text-accent">
            {c.full_name || c.email}
          </Link>
          <p className="truncate text-xs text-ink-muted">{c.email}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', cell: (c) => <span className="whitespace-nowrap text-ink-soft">{c.phone || '—'}</span> },
    { key: 'orders', header: 'Orders', sortKey: 'order_count', align: 'right', cell: (c) => <span className="tabular-nums">{c.order_count}</span> },
    { key: 'ltv', header: 'Spent', sortKey: 'lifetime_value', align: 'right', cell: (c) => <span className="font-medium tabular-nums">{formatMoney(c.lifetime_value)}</span> },
    { key: 'last', header: 'Last order', sortKey: 'last_order_at', cell: (c) => <span className="whitespace-nowrap text-xs text-ink-muted">{shortDate(c.last_order_at)}</span> },
    { key: 'joined', header: 'Joined', sortKey: 'date_joined', cell: (c) => <span className="whitespace-nowrap text-xs text-ink-muted">{shortDate(c.date_joined)}</span> },
    { key: 'status', header: 'Status', cell: (c) => (c.is_active ? <StatusBadge status="active" /> : <StatusBadge status="inactive" label="Deactivated" />) },
  ];

  return (
    <>
      <PageHeader title="Customers" eyebrow="People" />
      <Toolbar>
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Name, email or phone" />
        <FilterSelect label="Any order history" value={state.has_orders ?? ''} onChange={(v) => set({ has_orders: v })} options={[{ value: 'true', label: 'Has ordered' }, { value: 'false', label: 'Never ordered' }]} />
        <FilterSelect label="Any status" value={state.is_active ?? ''} onChange={(v) => set({ is_active: v })} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Deactivated' }]} />
      </Toolbar>
      <DataTable
        rows={data?.results}
        error={isError}
        onRetry={() => refetch()}
        columns={columns}
        rowKey={(c) => c.id}
        loading={isLoading}
        fetching={isFetching}
        ordering={state.ordering}
        onOrdering={(o) => set({ ordering: o })}
        page={data?.page}
        totalPages={data?.total_pages}
        count={data?.count}
        onPage={(p) => set({ page: String(p) })}
        onRowClick={(c) => navigate(`/admin-panel/customers/${c.id}`)}
        emptyTitle="No customers found"
      />
    </>
  );
}
