import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A titled card used to group form fields on admin edit screens. */
export function Section({ title, description, children, className, actions }: { title: string; description?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn('min-w-0 rounded-sm border border-line bg-surface-raised p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-sans text-sm font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
