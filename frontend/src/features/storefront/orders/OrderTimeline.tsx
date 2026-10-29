import { motion, useReducedMotion } from 'framer-motion';
import { Check, Package, PackageCheck, Truck, Home, ClipboardCheck, XCircle } from 'lucide-react';
import type { OrderDetail, OrderStatus } from '@/api/types';
import { cn } from '@/lib/cn';

const FLOW: { status: OrderStatus; label: string; Icon: typeof Check }[] = [
  { status: 'placed', label: 'Placed', Icon: ClipboardCheck },
  { status: 'confirmed', label: 'Confirmed', Icon: Check },
  { status: 'packed', label: 'Packed', Icon: Package },
  { status: 'shipped', label: 'Shipped', Icon: Truck },
  { status: 'out_for_delivery', label: 'Out for delivery', Icon: PackageCheck },
  { status: 'delivered', label: 'Delivered', Icon: Home },
];

const when = (iso?: string) =>
  iso ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '';

/** Animated tracking timeline: completed steps fill in sequence, the current step pulses gently. */
export function OrderTimeline({ order }: { order: Pick<OrderDetail, 'status' | 'events' | 'estimated_delivery_date' | 'cancelled_at' | 'cancel_reason'> }) {
  const reduce = useReducedMotion();
  if (order.status === 'cancelled') {
    return (
      <div className="flex items-start gap-3 rounded-sm border border-danger/30 bg-danger/5 p-4 text-sm">
        <XCircle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
        <div>
          <p className="font-semibold text-ink">Cancelled {when(order.cancelled_at ?? undefined)}</p>
          {order.cancel_reason ? <p className="mt-1 text-ink-soft">{order.cancel_reason}</p> : null}
        </div>
      </div>
    );
  }
  const reached = new Map(order.events.map((e) => [e.to_status, e.created_at]));
  const currentIndex = Math.max(-1, ...FLOW.map((s, i) => (reached.has(s.status) || s.status === order.status ? i : -1)));

  return (
    <ol className="relative" aria-label="Order progress">
      {FLOW.map((step, i) => {
        const done = i <= currentIndex;
        const current = i === currentIndex;
        const last = i === FLOW.length - 1;
        return (
          <li key={step.status} className="relative flex gap-4 pb-7 last:pb-0" aria-current={current ? 'step' : undefined}>
            {!last ? (
              <span className="absolute left-[1.0625rem] top-9 h-[calc(100%-2.25rem)] w-px bg-line" aria-hidden="true">
                <motion.span
                  className="block h-full w-full origin-top bg-charcoal-800"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: i < currentIndex ? 1 : 0 }}
                  transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : 0.2 + i * 0.25 }}
                />
              </span>
            ) : null}
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : i * 0.25 }}
              className={cn(
                'relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors',
                done ? 'border-charcoal-800 bg-charcoal-800 text-paper-50' : 'border-line-strong bg-surface text-ink-muted',
                current && 'ring-4 ring-iris-200/80',
              )}
            >
              <step.Icon className="h-4 w-4" aria-hidden="true" />
              {current && !reduce ? (
                <motion.span
                  className="absolute inset-0 rounded-full border border-iris-400"
                  animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  aria-hidden="true"
                />
              ) : null}
            </motion.span>
            <div className="pt-1.5">
              <p className={cn('text-sm font-semibold', done ? 'text-ink' : 'text-ink-muted')}>{step.label}</p>
              <p className="text-xs text-ink-muted">
                {reached.get(step.status)
                  ? when(reached.get(step.status))
                  : step.status === 'delivered' && order.estimated_delivery_date
                    ? `Expected by ${new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(order.estimated_delivery_date))}`
                    : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
