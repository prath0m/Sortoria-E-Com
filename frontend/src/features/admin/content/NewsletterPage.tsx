import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, downloadFile, useAdminList } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FilterSelect, SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';
import { dateTime } from '../orders/types';

interface Subscriber {
  id: number;
  email: string;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  status_label: string;
  source: string;
  created_at: string;
  confirmed_at: string | null;
}

const TONE = { confirmed: 'active', pending: 'pending', unsubscribed: 'inactive' } as const;

export default function NewsletterPage() {
  const qc = useQueryClient();
  const { state, query, set } = useTableState({ ordering: '-created_at' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<Subscriber>('newsletter', query);
  const [deleting, setDeleting] = useState<Subscriber | null>(null);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile(`/admin/newsletter/export/${state.search ? `?search=${encodeURIComponent(state.search)}` : ''}`, 'newsletter-subscribers.csv');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not export.');
    } finally {
      setExporting(false);
    }
  };
  const remove = async () => {
    await adminApi.remove('newsletter', deleting!.id);
    qc.invalidateQueries({ queryKey: ['admin', 'newsletter'] });
    toast.success('Removed from the list');
    setDeleting(null);
  };

  const columns: Column<Subscriber>[] = [
    { key: 'email', header: 'Email', sortKey: 'email', cell: (s) => <span className="text-ink">{s.email}</span> },
    { key: 'source', header: 'Signed up from', cell: (s) => <span className="text-ink-soft">{s.source || '—'}</span> },
    { key: 'created', header: 'Signed up', sortKey: 'created_at', cell: (s) => <span className="whitespace-nowrap text-xs text-ink-muted">{dateTime(s.created_at)}</span> },
    { key: 'confirmed', header: 'Confirmed', sortKey: 'confirmed_at', cell: (s) => <span className="whitespace-nowrap text-xs text-ink-muted">{dateTime(s.confirmed_at)}</span> },
    { key: 'status', header: 'Status', cell: (s) => <StatusBadge status={TONE[s.status]} label={s.status_label} /> },
    { key: 'actions', header: '', align: 'right', cell: (s) => <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(s)}>Remove</Button> },
  ];

  return (
    <>
      <PageHeader title="Newsletter" eyebrow="Content" actions={<Button variant="secondary" loading={exporting} icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export confirmed</Button>}>
        <p className="mt-1 text-sm text-ink-muted">Sign-ups are double opt-in: only confirmed addresses are exported for sending.</p>
      </PageHeader>
      <Toolbar>
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Search email" />
        <FilterSelect label="Any status" value={state.status ?? ''} onChange={(v) => set({ status: v })} options={[{ value: 'confirmed', label: 'Confirmed' }, { value: 'pending', label: 'Awaiting confirmation' }, { value: 'unsubscribed', label: 'Unsubscribed' }]} />
      </Toolbar>
      <DataTable rows={data?.results} error={isError} onRetry={() => refetch()} columns={columns} rowKey={(s) => s.id} loading={isLoading} fetching={isFetching} ordering={state.ordering} onOrdering={(o) => set({ ordering: o })} page={data?.page} totalPages={data?.total_pages} count={data?.count} onPage={(p) => set({ page: String(p) })} emptyTitle="No subscribers yet" emptyText="The sign-up box on the homepage and footer feeds this list." />
      <ConfirmDialog open={!!deleting} title={`Remove ${deleting?.email}?`} danger confirmLabel="Remove" onConfirm={remove} onClose={() => setDeleting(null)}>
        Use this for data-deletion requests. To stop emails, the subscriber's own unsubscribe link is enough.
      </ConfirmDialog>
    </>
  );
}
