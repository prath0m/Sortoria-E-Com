import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ease } from '@/design/motion';

export function AccordionItem({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cn('border-b border-line', className)}>
      <h3 className="font-sans text-base">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-semibold uppercase tracking-[0.12em] text-ink"
        >
          {title}
          <Plus className={cn('h-4 w-4 shrink-0 transition-transform duration-400 ease-luxe', open && 'rotate-45')} />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={id}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: ease.luxe }}
            className="overflow-hidden"
          >
            <div className="pb-5 text-[0.9375rem] text-ink-soft">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
