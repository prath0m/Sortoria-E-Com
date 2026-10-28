import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminList, useAdminMutation } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { Stars } from '@/components/ui/Rating';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { BulkBar, FilterSelect, SearchInput, Toolbar } from '../components/Toolbar';
import { useTableState } from '../components/useTableState';
import { dateTime } from '../orders/types';

interface AdminReview {
  id: number;
  product: string;
  product_id: number;
  product_slug: string;
  author: string;
  email: string;
  rating: number;
  title: string;
  body: string;
  photos: string[];
  is_verified_buyer: boolean;
  status: 'pending' | 'approved' | 'rejected';
  admin_reply: string;
  created_at: string;
  moderated_at: string | null;
}

function ReviewCard({ review, selected, onToggle }: { review: AdminReview; selected: boolean; onToggle: () => void }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState(review.admin_reply);
  const [replying, setReplying] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = async (body: Partial<AdminReview>, message: string) => {
    setBusy(true);
    try {
      await adminApi.update('reviews', review.id, body);
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      toast.success(message);
      setReplying(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={cn('rounded-sm border bg-surface-raised p-4', selected ? 'border-accent' : 'border-line')}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select review by ${review.author}`} className="mt-1 h-4 w-4 accent-[rgb(var(--primary))]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Stars value={review.rating} />
            <StatusBadge status={review.status} />
            {review.is_verified_buyer ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified buyer
              </span>
            ) : null}
            <span className="ml-auto text-xs text-ink-muted">{dateTime(review.created_at)}</span>
          </div>
          <p className="mt-2 font-medium text-ink">{review.title}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{review.body}</p>
          {review.photos.length ? (
            <div className="mt-2 flex gap-2">
              {review.photos.map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" className="h-16 w-16 overflow-hidden rounded-xs border border-line">
                  <img src={src} alt={`Attached by ${review.author}`} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-ink-muted">
            {review.author} ({review.email}) on{' '}
            <a href={`/products/${review.product_slug}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              {review.product}
            </a>
          </p>
          {review.admin_reply && !replying ? (
            <div className="mt-3 rounded-xs bg-accent-soft p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Your reply</p>
              <p className="mt-1 text-ink">{review.admin_reply}</p>
            </div>
          ) : null}
          {replying ? (
            <div className="mt-3 space-y-2">
              <label className="sr-only" htmlFor={`reply-${review.id}`}>Reply</label>
              <textarea id={`reply-${review.id}`} rows={3} value={reply} onChange={(e) => setReply(e.target.value)} className="w-full rounded-xs border border-line bg-surface p-2 text-sm focus:border-accent focus:outline-none" placeholder="Thank them, or explain what you'll do about it." />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancel</Button>
                <Button size="sm" loading={busy} onClick={() => patch({ admin_reply: reply }, 'Reply posted')}>Post reply</Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1">
              {review.status !== 'approved' ? <Button size="sm" variant="secondary" loading={busy} onClick={() => patch({ status: 'approved' }, 'Review approved')}>Approve</Button> : null}
              {review.status !== 'rejected' ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => patch({ status: 'rejected' }, 'Review rejected')}>Reject</Button> : null}
              <Button size="sm" variant="ghost" onClick={() => setReplying(true)}>{review.admin_reply ? 'Edit reply' : 'Reply'}</Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ReviewsPage() {
  const { state, query, set, selected, setSelected } = useTableState({ ordering: '-created_at' });
  const status = state.status ?? 'pending';
  const params = { ...query, status: status === 'all' ? undefined : status };
  const { data, isLoading, isFetching, isError, refetch } = useAdminList<AdminReview>('reviews', params);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bulk = useAdminMutation('reviews', (body: Record<string, unknown>) => adminApi.post('reviews/bulk/', body), { invalidate: ['dashboard'] });

  const run = async (action: string) => {
    await bulk.mutateAsync({ ids: [...selected], action });
    toast.success(`${selected.size} ${selected.size === 1 ? 'review' : 'reviews'} ${{ approve: 'approved', reject: 'rejected', delete: 'deleted' }[action]}`);
    setSelected(new Set());
    setConfirmDelete(false);
  };
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <PageHeader title="Reviews" eyebrow="People" />
      <div className="mb-4 flex gap-1 border-b border-line" role="group" aria-label="Review status">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => set({ status: s })}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm', status === s ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
          >
            {{ pending: 'Awaiting review', approved: 'Approved', rejected: 'Rejected', all: 'All' }[s]}
          </button>
        ))}
      </div>
      <Toolbar>
        <SearchInput value={state.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Search text, product or email" />
        <FilterSelect label="Any rating" value={state.rating ?? ''} onChange={(v) => set({ rating: v })} options={[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r} star${r > 1 ? 's' : ''}` }))} />
        <FilterSelect label="Any buyer" value={state.is_verified_buyer ?? ''} onChange={(v) => set({ is_verified_buyer: v })} options={[{ value: 'true', label: 'Verified buyers' }, { value: 'false', label: 'Unverified' }]} />
        {data?.results.length ? (
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(data.results.map((r) => r.id)))}>Select page</Button>
        ) : null}
      </Toolbar>
      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button size="sm" variant="ghost" loading={bulk.isPending} onClick={() => run('approve')}>Approve</Button>
        <Button size="sm" variant="ghost" disabled={bulk.isPending} onClick={() => run('reject')}>Reject</Button>
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
      </BulkBar>
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : !data?.results.length ? (
        <EmptyState illustration="search" title={status === 'pending' ? 'All caught up' : 'No reviews here'} description={status === 'pending' ? 'New reviews will wait here for approval.' : 'Try a different filter.'} className="py-12" />
      ) : (
        <div className={cn('space-y-3 transition-opacity', isFetching && 'opacity-60')}>
          {data.results.map((r) => <ReviewCard key={r.id} review={r} selected={selected.has(r.id)} onToggle={() => toggle(r.id)} />)}
          {data.total_pages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-ink-muted">{data.count} reviews</p>
              <Pagination page={data.page} totalPages={data.total_pages} onChange={(p) => set({ page: String(p) })} />
            </div>
          ) : null}
        </div>
      )}
      <ConfirmDialog open={confirmDelete} title={`Delete ${selected.size} reviews?`} danger confirmLabel="Delete" loading={bulk.isPending} onConfirm={() => run('delete')} onClose={() => setConfirmDelete(false)}>
        Ratings are recalculated. This can't be undone.
      </ConfirmDialog>
    </>
  );
}
