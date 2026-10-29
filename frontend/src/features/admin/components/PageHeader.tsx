import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PageHeader({ title, eyebrow, back, actions, children }: { title: ReactNode; eyebrow?: string; back?: { to: string; label: string }; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6">
      {back ? (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold text-ink-muted">{eyebrow}</p> : null}
          <h1 className="mt-1 text-display-md">{title}</h1>
          {children}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
