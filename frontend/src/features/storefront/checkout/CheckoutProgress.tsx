import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export const STEPS = ['Details', 'Delivery', 'Payment'] as const;

export function CheckoutProgress({ step, onStep }: { step: number; onStep: (index: number) => void }) {
  return (
    <nav aria-label="Checkout progress" className="mx-auto max-w-xl">
      <ol className="relative flex justify-between">
        <div className="absolute left-4 right-4 top-4 h-px bg-line" aria-hidden="true">
          <motion.div
            className="h-full origin-left bg-burgundy-800"
            initial={false}
            animate={{ scaleX: step / (STEPS.length - 1) }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="relative flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={!done}
                onClick={() => onStep(i)}
                aria-current={current ? 'step' : undefined}
                aria-label={`${label}${done ? ', completed' : current ? ', current step' : ''}`}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-400',
                  done && 'border-burgundy-800 bg-burgundy-800 text-cream-50',
                  current && 'border-burgundy-800 bg-surface text-burgundy-800 ring-4 ring-gold-200/70',
                  !done && !current && 'border-line-strong bg-surface text-ink-muted',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </button>
              <span className={cn('text-xs font-semibold uppercase tracking-[0.14em]', current || done ? 'text-ink' : 'text-ink-muted')}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
