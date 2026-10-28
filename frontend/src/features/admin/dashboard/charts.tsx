import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Chart colours come from CSS variables so light/dark modes each use their validated steps. */
export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export const axisProps = {
  stroke: 'var(--chart-grid)',
  tick: { fill: 'var(--chart-axis)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

export function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-sm border border-line bg-surface-raised p-5', className)} aria-label={title}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-sans text-sm font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="text-xs text-ink-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-soft">
      {dashed ? (
        <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} aria-hidden="true" />
      ) : (
        <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-40 rounded-xs border border-line bg-surface-raised px-3 py-2 text-xs shadow-lift">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            {r.color ? <span className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} aria-hidden="true" /> : null}
            {r.label}
          </span>
          <span className="font-medium tabular-nums text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function bucketLabel(iso: string, granularity: 'hour' | 'day' | 'month', long = false) {
  const d = new Date(iso);
  if (granularity === 'hour') return new Intl.DateTimeFormat('en-IN', { hour: 'numeric' }).format(d);
  if (granularity === 'month') return new Intl.DateTimeFormat('en-IN', { month: long ? 'long' : 'short', year: long ? 'numeric' : undefined }).format(d);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', weekday: long ? 'short' : undefined }).format(d);
}
