import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function Digit({ value, label, tone }: { value: number; label: string; tone: 'light' | 'dark' }) {
  const text = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xs font-sans text-xl font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] sm:h-14 sm:w-14 sm:text-2xl',
          tone === 'dark' ? 'bg-paper-50/10 text-iris-200 ring-1 ring-paper-50/15' : 'bg-iris-100 text-charcoal-900',
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            initial={{ y: '-60%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '60%', opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className={cn('mt-1.5 text-xs font-semibold', tone === 'dark' ? 'text-paper-200' : 'text-ink-muted')}>
        {label}
      </span>
    </div>
  );
}

/** Live countdown. `onComplete` fires once when the time runs out. */
export function Countdown({
  to,
  tone = 'light',
  compact,
  onComplete,
  className,
}: {
  to: string | Date;
  tone?: 'light' | 'dark';
  compact?: boolean;
  onComplete?: () => void;
  className?: string;
}) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const remaining = target - now;
  useEffect(() => {
    if (remaining <= 0) onComplete?.();
  }, [remaining <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = parts(remaining);
  const label = `${p.days ? `${p.days} days ` : ''}${p.hours} hours ${p.minutes} minutes left`;

  if (compact) {
    const hh = String(p.hours + p.days * 24).padStart(2, '0');
    return (
      <span className={cn('tabular-nums', className)} aria-label={label} role="timer">
        {hh}:{String(p.minutes).padStart(2, '0')}:{String(p.seconds).padStart(2, '0')}
      </span>
    );
  }
  return (
    <div className={cn('flex items-start gap-2', className)} role="timer" aria-label={label}>
      {p.days > 0 ? <Digit value={p.days} label="Days" tone={tone} /> : null}
      <Digit value={p.hours} label="Hrs" tone={tone} />
      <Digit value={p.minutes} label="Min" tone={tone} />
      <Digit value={p.seconds} label="Sec" tone={tone} />
    </div>
  );
}
