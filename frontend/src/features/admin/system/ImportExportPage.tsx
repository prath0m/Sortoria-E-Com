import { useQueryClient } from '@tanstack/react-query';
import { Download, FileUp } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/api/client';
import { downloadFile, useAdminList } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/stores/auth';
import { DataTable, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { StatusBadge } from '../components/StatusBadge';
import { useTableState } from '../components/useTableState';
import { dateTime } from '../orders/types';

interface Job {
  id: number;
  kind: 'products' | 'inventory' | 'pincodes';
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_rows: number;
  success_rows: number;
  error_rows: number;
  has_report: boolean;
  message: string;
  file_name: string;
  created_by: string | null;
  created_at: string;
}

const IMPORTS = [
  { kind: 'products', title: 'Products', capability: 'import.run', text: 'One row per variant. New slugs create products; existing ones are updated. SKUs match variants.' },
  { kind: 'inventory', title: 'Stock levels', capability: 'inventory.manage', text: 'SKU and the new stock count. Every change is logged as a CSV import.' },
  { kind: 'pincodes', title: 'Pincodes', capability: 'shipping.manage', text: 'Where you deliver, and which zone each pincode belongs to.' },
] as const;

const EXPORTS = [
  { kind: 'products', title: 'Products', capability: 'catalog.edit', text: 'Same layout as the import, so you can edit in a spreadsheet and upload it back.' },
  { kind: 'inventory', title: 'Stock levels', capability: 'inventory.manage', text: 'Every SKU with its stock.' },
  { kind: 'orders', title: 'Orders', capability: 'orders.view', text: 'Totals, tax and addresses, for your accountant.' },
  { kind: 'customers', title: 'Customers', capability: 'customers.view', text: 'Accounts with order counts and lifetime spend.' },
  { kind: 'pincodes', title: 'Pincodes', capability: 'shipping.manage', text: 'Serviceable pincodes and zones.' },
] as const;

const STATUS_TONE = { pending: 'pending', running: 'confirmed', completed: 'active', failed: 'failed' } as const;

function ImportCard({ kind, title, text }: { kind: string; title: string; text: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    try {
      const job = await api<Job>('/admin/imports/', { method: 'POST', body: form });
      toast.success(`${title} import started. Results appear below.`);
      qc.invalidateQueries({ queryKey: ['admin', 'imports'] });
      // Imports run in the background; check back until this one finishes.
      const poll = async (tries: number) => {
        const current = await api<Job>(`/admin/imports/${job.id}/`);
        if ((current.status === 'pending' || current.status === 'running') && tries > 0) return setTimeout(() => poll(tries - 1), 1500);
        qc.invalidateQueries({ queryKey: ['admin'] });
        if (current.status === 'failed') toast.error(current.message);
        else if (current.status === 'completed') (current.error_rows ? toast.warning : toast.success)(current.message);
      };
      poll(40);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload the file.');
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="flex flex-col rounded-xs border border-line p-4">
      <h3 className="font-sans text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 flex-1 text-xs text-ink-muted">{text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xs bg-primary px-4 text-[0.8125rem] font-semibold text-primary-on focus-within:ring-2 focus-within:ring-iris-300 hover:bg-primary-hover">
          <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
          {uploading ? 'Uploading…' : 'Upload CSV'}
          <input type="file" accept=".csv,text/csv" className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </label>
        <button type="button" onClick={() => downloadFile(`/admin/imports/template/${kind}/`, `sartoria-${kind}-template.csv`)} className="text-xs font-semibold text-accent underline-offset-4 hover:underline">
          Download template
        </button>
      </div>
    </div>
  );
}

function ExportCard({ kind, title, text }: { kind: string; title: string; text: string }) {
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const run = async () => {
    setBusy(true);
    const query = kind === 'orders' ? `?${new URLSearchParams(Object.entries({ date_from: from, date_to: to }).filter(([, v]) => v)).toString()}` : '';
    try {
      await downloadFile(`/admin/export/${kind}/${query}`, `sartoria-${kind}.csv`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not export.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col rounded-xs border border-line p-4">
      <h3 className="font-sans text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 flex-1 text-xs text-ink-muted">{text}</p>
      {kind === 'orders' ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-muted">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 w-full rounded-xs border border-line bg-surface px-2 text-sm text-ink" /></label>
          <label className="text-xs text-ink-muted">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 w-full rounded-xs border border-line bg-surface px-2 text-sm text-ink" /></label>
        </div>
      ) : null}
      <Button size="sm" variant="secondary" className="mt-3 self-start" loading={busy} icon={<Download className="h-3.5 w-3.5" />} onClick={run}>Download CSV</Button>
    </div>
  );
}

export default function ImportExportPage() {
  const capabilities = useAuth((s) => s.user?.capabilities ?? []);
  const { query, set } = useTableState({ ordering: '-created_at' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<Job>('imports', query);
  const imports = IMPORTS.filter((i) => capabilities.includes(i.capability));
  const exports = EXPORTS.filter((e) => capabilities.includes(e.capability));

  const columns: Column<Job>[] = [
    { key: 'when', header: 'When', cell: (j) => <span className="whitespace-nowrap text-xs text-ink-muted">{dateTime(j.created_at)}</span> },
    { key: 'what', header: 'Import', cell: (j) => <div><p className="capitalize text-ink">{j.kind}</p><p className="max-w-[16rem] truncate text-xs text-ink-muted">{j.file_name} · {j.created_by}</p></div> },
    { key: 'rows', header: 'Rows', align: 'right', cell: (j) => <span className="tabular-nums">{j.success_rows} / {j.total_rows}</span> },
    { key: 'result', header: 'Result', cell: (j) => <p className="max-w-[22rem] text-xs text-ink-soft">{j.message || '—'}</p> },
    { key: 'status', header: 'Status', cell: (j) => <StatusBadge status={STATUS_TONE[j.status]} label={j.status === 'completed' && j.error_rows ? 'Needs fixes' : j.status.replace(/^\w/, (c) => c.toUpperCase())} /> },
    { key: 'report', header: '', align: 'right', cell: (j) => (j.has_report ? <button type="button" onClick={() => downloadFile(`/admin/imports/${j.id}/report/`, `import-${j.id}-errors.csv`)} className="whitespace-nowrap text-xs font-semibold text-accent underline-offset-4 hover:underline">Error report</button> : null) },
  ];

  return (
    <>
      <PageHeader title="Import & export" eyebrow="Store">
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">CSV files in UTF-8. Prices are in rupees and include GST. Valid rows are applied; anything that needs fixing comes back in an error report with the reason beside each row.</p>
      </PageHeader>
      <div className="space-y-5">
        {imports.length ? (
          <Section title="Import">
            <div className="grid gap-3 md:grid-cols-3">{imports.map((i) => <ImportCard key={i.kind} {...i} />)}</div>
          </Section>
        ) : null}
        <Section title="Export">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{exports.map((e) => <ExportCard key={e.kind} {...e} />)}</div>
        </Section>
        {imports.length ? (
          <div>
            <h2 className="mb-3 font-sans text-sm font-semibold text-ink">Recent imports</h2>
            <DataTable rows={data?.results} error={isError} onRetry={() => refetch()} columns={columns} rowKey={(j) => j.id} loading={isLoading} fetching={isFetching} page={data?.page} totalPages={data?.total_pages} count={data?.count} onPage={(p) => set({ page: String(p) })} emptyTitle="No imports yet" emptyText="Download a template to see the layout." />
          </div>
        ) : null}
      </div>
    </>
  );
}
