import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'sale' | 'new' | 'muted' | 'dark' | 'success' | 'outline';

const tones: Record<Tone, string> = {
  sale: 'bg-gold-300 text-ink',
  new: 'bg-burgundy-800 text-cream-50',
  muted: 'bg-cream-200 text-ink-soft',
  dark: 'bg-ink/80 text-cream-50 backdrop-blur',
  success: 'bg-success/10 text-success',
  outline: 'border border-line-strong text-ink-soft',
};

export function Badge({ tone = 'muted', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs px-2 py-1 text-[0.625rem] font-bold uppercase leading-none tracking-[0.14em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
