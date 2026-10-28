import { motion, useReducedMotion } from 'framer-motion';
import type { ReturnRequest } from '@/api/types';
import { cn } from '@/lib/cn';

const when = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(iso));

export function ReturnTimeline({ ret }: { ret: ReturnRequest }) {
  const reduce = useReducedMotion();
  const finalStep = ret.resolution === 'replacement' ? { status: 'replaced', label: 'Replacement sent' } : { status: 'refunded', label: 'Refunded' };
  const steps =
    ret.status === 'rejected'
      ? [...ret.events.map((e) => ({ status: e.status, label: e.label }))]
      : [
          { status: 'requested', label: 'Requested' },
          { status: 'approved', label: 'Approved' },
          { status: 'pickup_scheduled', label: 'Pickup scheduled' },
          { status: 'received', label: 'Received & inspected' },
          finalStep,
        ];
  const reached = new Map(ret.events.map((e) => [e.status as string, e.created_at]));
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:gap-0" aria-label="Return progress">
      {steps.map((step, i) => {
        const done = reached.has(step.status);
        return (
          <li key={step.status} className="relative flex flex-1 items-start gap-3 pb-5 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
            {i > 0 ? (
              <span className="absolute -top-5 left-[0.6875rem] h-5 w-px bg-line sm:left-[-50%] sm:top-3 sm:h-px sm:w-full" aria-hidden="true">
                <motion.span
                  className="block h-full w-full origin-left bg-burgundy-800"
                  initial={{ scale: 0 }}
                  animate={{ scale: done ? 1 : 0 }}
                  transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : i * 0.2 }}
                />
              </span>
            ) : null}
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: reduce ? 0 : i * 0.2 }}
              className={cn(
                'relative z-[1] h-6 w-6 shrink-0 rounded-full border-2',
                done ? (step.status === 'rejected' ? 'border-danger bg-danger' : 'border-burgundy-800 bg-burgundy-800') : 'border-line-strong bg-surface',
              )}
            />
            <div className="sm:mt-2">
              <p className={cn('text-sm font-semibold', done ? 'text-ink' : 'text-ink-muted')}>{step.label}</p>
              {reached.get(step.status) ? <p className="text-xs text-ink-muted">{when(reached.get(step.status)!)}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
