import { cn } from '@/lib/cn';

const TONES: Record<string, string> = {
  good: 'bg-success/15 text-success',
  warn: 'bg-warning/15 text-warning',
  bad: 'bg-danger/15 text-danger',
  info: 'bg-accent-soft text-accent',
  neutral: 'bg-ink/10 text-ink-soft',
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  delivered: 'good', paid: 'good', approved: 'good', refunded: 'good', replaced: 'good', active: 'good', ok: 'good', captured: 'good', processed: 'good',
  placed: 'info', confirmed: 'info', packed: 'info', shipped: 'info', out_for_delivery: 'info', requested: 'info', pickup_scheduled: 'info', received: 'info',
  pending: 'warn', pending_payment: 'warn', low: 'warn', partially_refunded: 'warn', manual: 'warn',
  cancelled: 'neutral', inactive: 'neutral', rejected: 'neutral',
  payment_failed: 'bad', failed: 'bad', out: 'bad',
};

/** Status pill: always text, never colour alone. */
export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-xs px-2 py-0.5 text-[0.6875rem] font-semibold', TONES[tone], className)}>
      {label ?? status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}
