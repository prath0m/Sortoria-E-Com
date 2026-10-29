import { useQueryClient } from '@tanstack/react-query';
import { Plus, Zap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi, useAdminAll } from '@/api/hooks/adminCrud';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { SortableList } from '../components/SortableList';
import { dateTime } from '../orders/types';
import { StateBadge } from './state';
import type { Sale as SaleDraft } from './types';

type Sale = SaleDraft & { id: number };

export default function SalesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kind = params.get('kind') === 'daily_deal' ? 'daily_deal' : 'flash';
  const { data, isLoading, isError, refetch } = useAdminAll<Sale>('sales');
  const [order, setOrder] = useState<number[] | null>(null);

  const list = (data ?? []).filter((s) => s.kind === kind);
  const sorted = order ? order.map((id) => list.find((s) => s.id === id)).filter((s): s is Sale => !!s) : [...list].sort((a, b) => a.position - b.position);

  const reorder = async (next: Sale[]) => {
    setOrder(next.map((s) => s.id));
    try {
      await adminApi.post('sales/reorder/', { ids: next.map((s) => s.id) });
      qc.invalidateQueries({ queryKey: ['admin', 'sales'] });
    } catch {
      setOrder(null);
      toast.error('Could not save the new order.');
    }
  };

  return (
    <>
      <PageHeader
        title={kind === 'flash' ? 'Flash sales' : 'Daily deals'}
        eyebrow="Offers"
        actions={<ButtonLink to={`/admin/offers/sales/new?kind=${kind}`} icon={<Plus className="h-4 w-4" />}>{kind === 'flash' ? 'New flash sale' : 'New daily deal'}</ButtonLink>}
      >
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Prices drop automatically when a sale starts and return when it ends. Drag to set the order on the offers page.</p>
      </PageHeader>
      <div className="mb-4 flex gap-1 border-b border-line" role="group" aria-label="Sale type">
        {(['flash', 'daily_deal'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => { setOrder(null); setParams({ kind: k }, { replace: true }); }}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm', kind === k ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
          >
            {k === 'flash' ? 'Flash sales' : 'Daily deals'}
          </button>
        ))}
      </div>
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : !sorted.length ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-line bg-surface-raised px-6 py-16 text-center">
          <Zap className="h-8 w-8 text-ink-muted" aria-hidden="true" />
          <p className="text-sm text-ink-soft">Nothing scheduled. A short, well-chosen sale does more than a long one.</p>
        </div>
      ) : (
        <SortableList
          items={sorted}
          onReorder={reorder}
          label={(s) => s.title}
          render={(s) => (
            <button type="button" onClick={() => navigate(`/admin/offers/sales/${s.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="h-12 w-20 shrink-0 overflow-hidden rounded-xs bg-ink/5">{s.banner_image ? <img src={s.banner_image} alt="" className="h-full w-full object-cover" /> : null}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink hover:text-accent">{s.title}</span>
                <span className="block text-xs text-ink-muted">{dateTime(s.starts_at)} – {dateTime(s.ends_at)} · {s.item_count} {s.item_count === 1 ? 'product' : 'products'}</span>
              </span>
              <StateBadge state={s.state!} />
            </button>
          )}
        />
      )}
    </>
  );
}
