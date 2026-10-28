import { Search, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useDebounced } from '@/lib/hooks';
import { cn } from '@/lib/cn';

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebounced(draft, 300);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xs border border-line bg-surface-raised pl-9 pr-8 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
      />
      {draft ? (
        <button type="button" onClick={() => setDraft('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </label>
  );
}

export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-10 rounded-xs border border-line bg-surface-raised px-3 text-sm focus:border-accent focus:outline-none', value ? 'text-ink' : 'text-ink-muted')}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null;
  return (
    <div className="sticky top-20 z-[5] mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-accent/40 bg-accent-soft px-4 py-2 shadow-soft">
      <span className="text-sm font-semibold text-ink">{count} selected</span>
      <span className="mx-1 h-4 w-px bg-line-strong" aria-hidden="true" />
      {children}
      <button type="button" onClick={onClear} className="ml-auto text-xs text-ink-muted hover:text-ink">
        Clear selection
      </button>
    </div>
  );
}
