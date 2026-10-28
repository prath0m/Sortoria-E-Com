import { useEffect, useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const control =
  'block h-12 w-full rounded-xs border border-line-strong/70 bg-surface-raised px-4 text-[0.9375rem] text-ink focus:border-burgundy-800 focus:outline-none focus:ring-2 focus:ring-gold-300/60 aria-[invalid=true]:border-danger';

function Shell({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-ink">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-ink-muted">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[0.8125rem] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[0.8125rem] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Rupee input backed by integer paise. Empty means null. Keeps the typed text (e.g. "12.") while editing. */
export function MoneyInput({ label, value, onChange, hint, error, optional }: { label: string; value: number | null | undefined; onChange: (paise: number | null) => void; hint?: ReactNode; error?: string; optional?: boolean }) {
  const id = useId();
  const format = (paise: number | null | undefined) => (paise == null ? '' : String(paise / 100));
  const [text, setText] = useState(format(value));
  const toPaise = (raw: string) => (raw === '' || raw === '.' ? null : Math.round(Number(raw) * 100));
  useEffect(() => {
    // Follow outside changes (e.g. "apply to all"), but don't fight the user's own keystrokes.
    setText((current) => (toPaise(current) === (value ?? null) ? current : format(value)));
  }, [value]);
  return (
    <Shell id={id} label={label} hint={hint} error={error} optional={optional}>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true">₹</span>
        <input
          id={id}
          inputMode="decimal"
          aria-invalid={error ? true : undefined}
          value={text}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').replace(/(\.\d{2})\d+/, '$1');
            setText(raw);
            onChange(toPaise(raw));
          }}
          onBlur={() => setText(format(toPaise(text)))}
          className={cn(control, 'pl-8 tabular-nums')}
        />
      </div>
    </Shell>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO string -> value for <input type="datetime-local"> in the viewer's timezone. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimeInput({ label, value, onChange, hint, error, optional }: { label: string; value: string | null | undefined; onChange: (iso: string | null) => void; hint?: ReactNode; error?: string; optional?: boolean }) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        type="datetime-local"
        aria-invalid={error ? true : undefined}
        value={toLocalInput(value)}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        className={control}
      />
    </Shell>
  );
}

/** Accessible on/off switch for quick toggles in lists. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-primary' : 'bg-ink/20')}
    >
      <span className={cn('inline-block h-4 w-4 rounded-full bg-surface-raised shadow-soft transition-transform', checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5')} />
    </button>
  );
}
