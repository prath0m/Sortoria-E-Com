import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'sale' | 'new' | 'muted' | 'dark' | 'success' | 'outline';

const tones: Record<Tone, string> = {
  // Fixed-colour pairs use explicit text colours so they read the same in light and dark themes.
  sale: 'bg-[#dc2626] text-white',
  new: 'bg-[#0a0a0a] text-white',
  muted: 'bg-ink/10 text-ink-soft',
  dark: 'bg-[#0a0a0a]/75 text-white backdrop-blur',
  success: 'bg-success/10 text-success',
  outline: 'border border-line-strong text-ink-soft',
};

export function Badge({ tone = 'muted', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium leading-none',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
