import { Star } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

const LABELS = ['', 'Disappointing', 'Not quite', 'Good', 'Very good', 'Exceptional'];

/** Accessible 1–5 star picker: native radios in a fieldset, so arrow keys work. */
export function StarInput({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">Your rating</legend>
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
              <input
                type="radio"
                name="rating"
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="peer sr-only"
                aria-label={`${n} star${n > 1 ? 's' : ''}: ${LABELS[n]}`}
              />
              <Star
                className={cn(
                  'h-7 w-7 rounded-xs transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-charcoal-800',
                  n <= shown ? 'text-iris-400' : 'text-stone-300',
                )}
                fill="currentColor"
                strokeWidth={0}
              />
            </label>
          ))}
        </div>
        <span className="text-sm text-ink-soft" aria-hidden="true">
          {LABELS[shown]}
        </span>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
