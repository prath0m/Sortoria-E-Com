import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useFocusTrap, useScrollLock } from '@/lib/hooks';
import { ease } from '@/design/motion';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  hideTitle?: boolean;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 bg-ink/40 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
      aria-hidden="true"
    />
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-ink/5"
    >
      <X className="h-5 w-5" />
    </button>
  );
}

function Panel({
  open,
  onClose,
  title,
  hideTitle,
  children,
  className,
  footer,
  variant,
}: OverlayProps & { variant: 'modal' | 'drawer-right' | 'drawer-left' | 'sheet' }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, onClose);
  useScrollLock(open);

  const motionProps = {
    modal: { initial: { opacity: 0, y: 24, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 16, scale: 0.98 } },
    'drawer-right': { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } },
    'drawer-left': { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
    sheet: { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } },
  }[variant];

  const layout = {
    modal: 'relative m-auto max-h-[92vh] w-full max-w-lg overflow-hidden rounded-md bg-surface-raised shadow-lift',
    'drawer-right': 'ml-auto h-full w-full max-w-md bg-surface-raised shadow-drawer',
    'drawer-left': 'mr-auto h-full w-[88vw] max-w-sm bg-surface-raised shadow-drawer',
    sheet: 'mt-auto max-h-[88vh] w-full rounded-t-md bg-surface-raised shadow-lift',
  }[variant];

  return (
    <div className={cn('fixed inset-0 z-modal flex', variant === 'modal' && 'p-4')}>
      <Backdrop onClose={onClose} />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-lenis-prevent
        className={cn('relative flex flex-col outline-none', layout, className)}
        transition={{ duration: 0.45, ease: ease.luxe }}
        {...motionProps}
      >
        {variant === 'sheet' ? <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" /> : null}
        <div className={cn('flex items-center justify-between gap-4 px-5 py-3', !hideTitle && 'border-b border-line')}>
          <h2 id={titleId} className={cn('font-display text-display-sm', hideTitle && 'sr-only')}>
            {title}
          </h2>
          <CloseButton onClose={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? <div className="border-t border-line bg-surface-raised px-5 py-4">{footer}</div> : null}
      </motion.div>
    </div>
  );
}

function makeOverlay(variant: 'modal' | 'drawer-right' | 'drawer-left' | 'sheet') {
  return function Overlay(props: OverlayProps) {
    return createPortal(
      <AnimatePresence>{props.open ? <Panel key="panel" variant={variant} {...props} /> : null}</AnimatePresence>,
      document.body,
    );
  };
}

export const Modal = makeOverlay('modal');
export const Drawer = makeOverlay('drawer-right');
export const LeftDrawer = makeOverlay('drawer-left');
export const BottomSheet = makeOverlay('sheet');
