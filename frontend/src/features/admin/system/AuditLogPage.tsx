import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/api/client';
import { useAdminList } from '@/api/hooks/adminCrud';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FilterSelect, SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';
import { dateTime } from '../orders/types';

interface Entry {
  id: number;
  actor: { id: number; email: string; name: string } | null;
  action: string;
  action_label: string;
  object_type: string;
  object_id: string;
  object_repr: string;
  changes: Record<string, unknown>;
  ip: string | null;
  user_agent: string;
  created_at: string;
}

const ACTION_TONE: Record<string, string> = { create: 'active', update: 'confirmed', delete: 'failed', bulk: 'pending', transition: 'shipped', import: 'manual', export: 'neutral', login: 'neutral' };
const pretty = (type: string) => type.split('.').pop()!.replace(/([a-z])([A-Z])/g, '$1 $2');

function Value({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === '') return <span className="text-ink-muted">empty</span>;
  if (typeof v === 'object') return <code className="break-all text-xs">{JSON.stringify(v)}</code>;
  return <span className="break-all">{String(v)}</span>;
}

function Changes({ changes }: { changes: Record<string, unknown> }) {
  const entries = Object.entries(changes);
  if (!entries.length) return <p className="text-xs text-ink-muted">No details recorded.</p>;
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
      {entries.map(([key, value]) => {
        const diff = value && typeof value === 'object' && 'from' in (value as object) && 'to' in (value as object) ? (value as { from: unknown; to: unknown }) : null;
        return (
          <div key={key} className="contents">
            <dt className="text-ink-muted">{key.replace(/_/g, ' ')}</dt>
            <dd className="min-w-0 text-ink">
              {diff ? (
                <>
                  <span className="line-through decoration-ink-muted/60"><Value v={diff.from} /></span> → <Value v={diff.to} />
                </>
              ) : (
                <Value v={value} />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default function AuditLogPage() {
  const { state, query, set } = useTableState({ ordering: '-created_at' });
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<Entry>('audit-log', query);
  const { data: facets } = useQuery({
    queryKey: ['admin', 'audit-log', 'facets'],
    queryFn: () => api<{ object_types: string[]; actions: { value: string; label: string }[]; actors: { id: number; email: string }[] }>('/admin/audit-log/facets/'),
  });
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <PageHeader title="Activity log" eyebrow="Store">
        <p className="mt-1 text-sm text-ink-muted">Every change made in the admin, who made it and when. Entries can't be edited or removed.</p>
      </PageHeader>
      <Toolbar>
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Search records or people" />
        <FilterSelect label="Anyone" value={state.actor ?? ''} onChange={(v) => set({ actor: v })} options={(facets?.actors ?? []).map((a) => ({ value: String(a.id), label: a.email }))} />
        <FilterSelect label="Any action" value={state.action ?? ''} onChange={(v) => set({ action: v })} options={facets?.actions ?? []} />
        <FilterSelect label="Any record" value={state.object_type ?? ''} onChange={(v) => set({ object_type: v })} options={(facets?.object_types ?? []).map((t) => ({ value: t, label: pretty(t) }))} />
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">From<input type="date" value={state.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value })} className="h-10 rounded-xs border border-line bg-surface-raised px-2 text-sm text-ink" /></label>
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">To<input type="date" value={state.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value })} className="h-10 rounded-xs border border-line bg-surface-raised px-2 text-sm text-ink" /></label>
      </Toolbar>
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-96" />
      ) : !data?.results.length ? (
        <p className="rounded-sm border border-line bg-surface-raised px-6 py-12 text-center text-sm text-ink-soft">Nothing recorded for these filters.</p>
      ) : (
        <div className={cn('rounded-sm border border-line bg-surface-raised transition-opacity', isFetching && 'opacity-60')}>
          <ol className="divide-y divide-line/60">
            {data.results.map((e) => (
              <li key={e.id}>
                <button type="button" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-ink/[0.03]">
                  <StatusBadge status={ACTION_TONE[e.action] ?? 'neutral'} label={e.action_label} />
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    <span className="font-medium">{e.actor?.name || e.actor?.email || 'System'}</span>
                    <span className="text-ink-soft"> · {pretty(e.object_type)}</span>
                    {e.object_repr ? <span className="text-ink-soft"> · {e.object_repr}</span> : null}
                  </span>
                  <span className="whitespace-nowrap text-xs text-ink-muted">{dateTime(e.created_at)}</span>
                  <ChevronDown className={cn('h-4 w-4 text-ink-muted transition-transform', open === e.id && 'rotate-180')} aria-hidden="true" />
                </button>
                {open === e.id ? (
                  <div className="space-y-3 border-t border-line/60 bg-surface px-4 py-3">
                    <Changes changes={e.changes} />
                    <p className="text-xs text-ink-muted">
                      {e.actor?.email ?? 'System'} · {e.ip ?? 'no IP'} · {e.user_agent.slice(0, 90) || 'no browser recorded'}
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          {data.total_pages > 1 ? (
            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <p className="text-xs text-ink-muted">{data.count} entries</p>
              <Pagination page={data.page} totalPages={data.total_pages} onChange={(p) => set({ page: String(p) })} />
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
