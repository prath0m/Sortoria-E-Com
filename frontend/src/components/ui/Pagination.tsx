import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

function pages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('…');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push('…');
  out.push(total);
  return out;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const cell = 'inline-flex h-10 min-w-10 items-center justify-center rounded-xs px-2 text-sm transition-colors';
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1', className)}>
      <button
        type="button"
        className={cn(cell, 'hover:bg-ink/5 disabled:opacity-30')}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className={cn(cell, 'text-ink-muted')} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
            className={cn(cell, p === page ? 'bg-burgundy-800 font-semibold text-cream-50' : 'hover:bg-ink/5')}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={cn(cell, 'hover:bg-ink/5 disabled:opacity-30')}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
