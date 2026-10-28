import 'react-day-picker/style.css';

import { CalendarDays } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { RangeQuery } from '@/api/hooks/admin';

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '12m', label: '12 months' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function RangePicker({ value, onChange }: { value: RangeQuery; onChange: (q: RangeQuery) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const customLabel =
    value.range === 'custom' && value.from && value.to
      ? `${new Date(value.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(value.to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
      : 'Custom';

  return (
    <div ref={ref} className="relative max-w-full">
      <div role="group" aria-label="Date range" className="scrollbar-none flex max-w-full overflow-x-auto rounded-xs border border-line bg-surface-raised p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={value.range === p.value}
            onClick={() => onChange({ range: p.value })}
            className={cn('whitespace-nowrap rounded-[3px] px-3 py-1.5 text-xs font-medium transition-colors', value.range === p.value ? 'bg-primary text-primary-on' : 'text-ink-soft hover:text-ink')}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={value.range === 'custom'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] px-3 py-1.5 text-xs font-medium', value.range === 'custom' ? 'bg-primary text-primary-on' : 'text-ink-soft hover:text-ink')}
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {customLabel}
        </button>
      </div>
      {open ? (
        <div className="absolute right-0 top-11 z-modal rounded-sm border border-line bg-surface-raised p-3 shadow-lift">
          <DayPicker
            mode="range"
            selected={draft}
            onSelect={setDraft}
            disabled={{ after: new Date() }}
            numberOfMonths={1}
            className="rdp-sartoria"
          />
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!draft?.from}
              onClick={() => {
                if (!draft?.from) return;
                onChange({ range: 'custom', from: iso(draft.from), to: iso(draft.to ?? draft.from) });
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
