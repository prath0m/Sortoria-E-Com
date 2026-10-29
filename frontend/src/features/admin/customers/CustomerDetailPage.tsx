import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminItem } from '@/api/hooks/adminCrud';
import type { OrderAddress } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney } from '@/lib/money';
import { useAuth } from '@/stores/auth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type Column } from '../components/DataTable';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { StatusBadge } from '../components/StatusBadge';
import { dateTime, shortDate, type OrderRow } from '../orders/types';
import type { CustomerRow } from './CustomersPage';

interface CustomerDetail extends CustomerRow {
  addresses: (OrderAddress & { id: number; label: string; is_default: boolean })[];
  orders: OrderRow[];
  reviews: number;
  returns: number;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-line bg-surface-raised p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-display-sm tabular-nums text-ink">{value}</p>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: c, isLoading, isError, refetch } = useAdminItem<CustomerDetail>('customers', id);
  const canManage = useAuth((s) => s.user?.capabilities.includes('customers.manage'));
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  if (isError) return <ErrorState title="We couldn't load this customer." onRetry={() => refetch()} />;
  if (isLoading || !c) return <Skeleton className="h-96" />;

  const toggleActive = async () => {
    setSaving(true);
    try {
      await adminApi.update('customers', c.id, { is_active: !c.is_active });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
      toast.success(c.is_active ? 'Account deactivated and signed out everywhere' : 'Account reactivated');
      setConfirm(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the account.');
    } finally {
      setSaving(false);
    }
  };

  const aov = c.order_count ? Math.round(c.lifetime_value / c.order_count) : 0;
  const columns: Column<OrderRow>[] = [
    { key: 'number', header: 'Order', cell: (o) => <span className="font-medium text-ink">{o.number}</span> },
    { key: 'date', header: 'Date', cell: (o) => <span className="whitespace-nowrap text-xs text-ink-muted">{dateTime(o.placed_at ?? o.created_at)}</span> },
    { key: 'items', header: 'Items', align: 'right', cell: (o) => <span className="tabular-nums">{o.item_count}</span> },
    { key: 'total', header: 'Total', align: 'right', cell: (o) => <span className="tabular-nums">{formatMoney(o.grand_total_paise)}</span> },
    { key: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.status} label={o.status_label} /> },
  ];

  return (
    <>
      <PageHeader
        title={c.full_name || c.email}
        eyebrow="Customer"
        back={{ to: '/admin/customers', label: 'All customers' }}
        actions={
          canManage ? (
            <Button size="sm" variant={c.is_active ? 'ghost' : 'secondary'} className={c.is_active ? 'text-danger' : undefined} onClick={() => setConfirm(true)}>
              {c.is_active ? 'Deactivate account' : 'Reactivate account'}
            </Button>
          ) : null
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          {c.is_active ? <StatusBadge status="active" /> : <StatusBadge status="inactive" label="Deactivated" />}
          <span>{c.email}</span>
          {c.phone ? <span>· {c.phone}</span> : null}
          <span>· Joined {shortDate(c.date_joined)}</span>
          {c.marketing_opt_in ? <span>· Subscribed to emails</span> : null}
        </div>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders" value={c.order_count} />
        <Stat label="Lifetime spend" value={formatMoney(c.lifetime_value)} />
        <Stat label="Average order" value={formatMoney(aov)} />
        <Stat label="Reviews · returns" value={`${c.reviews} · ${c.returns}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <h2 className="mb-3 font-sans text-sm font-semibold text-ink">Order history</h2>
          <DataTable rows={c.orders} columns={columns} rowKey={(o) => o.number} onRowClick={(o) => navigate(`/admin/orders/${o.number}`)} emptyTitle="No orders yet" emptyText="This customer hasn't placed an order." />
        </div>
        <Section title="Saved addresses">
          {c.addresses.length === 0 ? <p className="text-sm text-ink-muted">None saved.</p> : null}
          {c.addresses.map((a) => (
            <address key={a.id} className="text-sm not-italic text-ink-soft">
              <span className="font-medium text-ink">{a.label || a.full_name}</span>
              {a.is_default ? <span className="ml-2 text-xs text-ink-muted">Default</span> : null}
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}
              <br />
              {a.city}, {a.state} {a.pincode}
            </address>
          ))}
          <p className="text-xs text-ink-muted">
            Last signed in {c.last_login ? dateTime(c.last_login) : 'never'}. <Link to={`/admin/orders?search=${encodeURIComponent(c.email)}`} className="text-accent hover:underline">Find guest orders by email</Link>
          </p>
        </Section>
      </div>
      <ConfirmDialog
        open={confirm}
        title={c.is_active ? 'Deactivate this account?' : 'Reactivate this account?'}
        danger={c.is_active}
        confirmLabel={c.is_active ? 'Deactivate' : 'Reactivate'}
        loading={saving}
        onConfirm={toggleActive}
        onClose={() => setConfirm(false)}
      >
        {c.is_active ? "They'll be signed out on every device and won't be able to sign in. Their orders stay intact." : 'They can sign in again straight away.'}
      </ConfirmDialog>
    </>
  );
}
