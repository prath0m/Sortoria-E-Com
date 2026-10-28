import { ArrowDown, ArrowUp, ArrowUpDown, Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { ErrorState } from './ErrorState';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortKey?: string;
  className?: string;
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  fetching?: boolean;
  ordering?: string;
  onOrdering?: (ordering: string) => void;
  page?: number;
  totalPages?: number;
  count?: number;
  onPage?: (page: number) => void;
  selected?: Set<string | number>;
  onSelect?: (next: Set<string | number>) => void;
  emptyTitle?: string;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  error?: boolean;
  onRetry?: () => void;
}

function Box({ state, onClick, label }: { state: 'on' | 'off' | 'some'; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'some' ? 'mixed' : state === 'on'}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-xs border transition-colors',
        state === 'off' ? 'border-line-strong' : 'border-primary bg-primary text-primary-on',
      )}
    >
      {state === 'on' ? <Check className="h-3 w-3" strokeWidth={3} /> : state === 'some' ? <Minus className="h-3 w-3" strokeWidth={3} /> : null}
    </button>
  );
}

/** Server-driven table: sorting via `ordering`, pagination via `page`, optional row selection for bulk actions. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  fetching,
  ordering,
  onOrdering,
  page,
  totalPages,
  count,
  onPage,
  selected,
  onSelect,
  emptyTitle = 'Nothing here yet',
  emptyText,
  onRowClick,
  error,
  onRetry,
}: DataTableProps<T>) {
  if (error && !rows) {
    return (
      <div className="rounded-sm border border-line bg-surface-raised">
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }
  const keys = rows?.map(rowKey) ?? [];
  const allOn = !!keys.length && keys.every((k) => selected?.has(k));
  const someOn = keys.some((k) => selected?.has(k));
  const toggleAll = () => onSelect?.(allOn ? new Set() : new Set(keys));
  const toggle = (k: string | number) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelect?.(next);
  };

  const sortState = (key?: string) => (!key || !ordering ? null : ordering === key ? 'asc' : ordering === `-${key}` ? 'desc' : null);

  return (
    <div className="min-w-0 rounded-sm border border-line bg-surface-raised">
      <div className={cn('overflow-x-auto transition-opacity', fetching && 'opacity-60')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-ink-muted">
              {onSelect ? (
                <th scope="col" className="w-10 px-4 py-3">
                  <Box state={allOn ? 'on' : someOn ? 'some' : 'off'} onClick={toggleAll} label="Select all on this page" />
                </th>
              ) : null}
              {columns.map((col) => {
                const state = sortState(col.sortKey);
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={state === 'asc' ? 'ascending' : state === 'desc' ? 'descending' : undefined}
                    className={cn('whitespace-nowrap px-4 py-3 font-semibold', col.align === 'right' && 'text-right', col.className)}
                  >
                    {col.sortKey && onOrdering ? (
                      <button
                        type="button"
                        onClick={() => onOrdering(state === 'desc' ? col.sortKey! : `-${col.sortKey}`)}
                        className={cn('inline-flex items-center gap-1 uppercase hover:text-ink', state && 'text-ink')}
                      >
                        {col.header}
                        {state === 'asc' ? <ArrowUp className="h-3 w-3" /> : state === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td colSpan={columns.length + (onSelect ? 1 : 0)} className="px-4 py-3">
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))
              : rows?.map((row) => {
                  const key = rowKey(row);
                  const isSelected = selected?.has(key);
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        'border-b border-line/60 last:border-0',
                        onRowClick && 'cursor-pointer hover:bg-ink/[0.03]',
                        isSelected && 'bg-accent-soft/60',
                      )}
                    >
                      {onSelect ? (
                        <td className="px-4 py-3">
                          <Box state={isSelected ? 'on' : 'off'} onClick={() => toggle(key)} label="Select row" />
                        </td>
                      ) : null}
                      {columns.map((col) => (
                        <td key={col.key} className={cn('px-4 py-3 align-middle', col.align === 'right' && 'text-right', col.className)}>
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {!loading && !rows?.length ? <EmptyState illustration="search" title={emptyTitle} description={emptyText} className="py-12" /> : null}
      {page && totalPages && totalPages > 1 && onPage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="text-xs text-ink-muted">{count} total</p>
          <Pagination page={page} totalPages={totalPages} onChange={onPage} />
        </div>
      ) : count !== undefined && !loading ? (
        <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">{count} total</p>
      ) : null}
    </div>
  );
}
