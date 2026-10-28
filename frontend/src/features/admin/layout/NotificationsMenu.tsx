import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, MessageSquare, PackageX, RotateCcw, ShoppingBag, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarkNotificationsRead, useNotifications } from '@/api/hooks/admin';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const ICONS: Record<string, typeof Bell> = {
  new_order: ShoppingBag,
  low_stock: PackageX,
  return_requested: RotateCcw,
  review_pending: MessageSquare,
  import_finished: Upload,
  payment_failed: AlertTriangle,
};

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const mark = useMarkNotificationsRead();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton label={`Notifications${data?.unread ? `, ${data.unread} unread` : ''}`} badge={data?.unread} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Bell className="h-5 w-5" />
      </IconButton>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-12 z-modal w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-sm border border-line bg-surface-raised shadow-lift"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Notifications</p>
              {data?.unread ? (
                <button type="button" className="text-xs text-accent link-underline" onClick={() => mark.mutate({ all: true })}>
                  Mark all read
                </button>
              ) : null}
            </div>
            <ul className="max-h-96 overflow-y-auto" data-lenis-prevent>
              {data?.results.length ? (
                data.results.map((n) => {
                  const Icon = ICONS[n.kind] ?? Bell;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!n.read) mark.mutate({ ids: [n.id] });
                          setOpen(false);
                          if (n.link) navigate(n.link);
                        }}
                        className={cn('flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left hover:bg-ink/5', !n.read && 'bg-accent-soft/50')}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block text-sm', n.read ? 'text-ink-soft' : 'font-medium text-ink')}>{n.title}</span>
                          <span className="text-xs text-ink-muted">{timeAgo(n.created_at)}</span>
                        </span>
                        {!n.read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" /> : null}
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="px-4 py-10 text-center text-sm text-ink-muted">You're all caught up.</li>
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
