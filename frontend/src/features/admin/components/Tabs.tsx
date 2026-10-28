import { cn } from '@/lib/cn';

/** Simple accessible tab strip; panels are rendered by the caller. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; badge?: number | string; error?: boolean }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            const i = tabs.findIndex((x) => x.id === value);
            if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length].id);
            if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length].id);
          }}
          tabIndex={value === t.id ? 0 : -1}
          className={cn(
            '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
            value === t.id ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink',
          )}
        >
          {t.label}
          {t.badge !== undefined ? <span className="rounded-full bg-ink/10 px-1.5 text-[0.6875rem] tabular-nums">{t.badge}</span> : null}
          {t.error ? <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="has errors" /> : null}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: boolean; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={!active}>
      {active ? children : null}
    </div>
  );
}
