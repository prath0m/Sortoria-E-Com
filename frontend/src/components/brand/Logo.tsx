import { cn } from '@/lib/cn';
import { MONOGRAM, WORDMARK } from './logoPaths';

interface LogoProps {
  className?: string;
  /** Uploaded logo from Store Settings; replaces the built-in wordmark when present. */
  src?: string | null;
  label?: string;
  /** `light` for dark bands and photos. */
  tone?: 'dark' | 'light';
}

export function Logo({ className, src, label = 'Sartoria', tone = 'dark' }: LogoProps) {
  if (src) {
    return <img src={src} alt={label} className={cn('h-8 w-auto', className)} />;
  }
  return (
    <svg
      viewBox={WORDMARK.viewBox}
      role="img"
      aria-label={label}
      className={cn('h-8 w-auto', tone === 'light' ? 'text-white' : 'text-ink', className)}
    >
      <path fill="currentColor" d={WORDMARK.letters} />
    </svg>
  );
}

interface MonogramProps {
  className?: string;
  src?: string | null;
  label?: string;
}

export function Monogram({ className, src, label = 'Sartoria' }: MonogramProps) {
  if (src) {
    return <img src={src} alt={label} className={cn('h-9 w-9', className)} />;
  }
  return (
    <svg viewBox={MONOGRAM.viewBox} role="img" aria-label={label} className={cn('h-9 w-9', className)}>
      <rect width="1000" height="1000" rx={MONOGRAM.radius} className="fill-ink" />
      <path className="fill-surface" transform={MONOGRAM.transform} d={MONOGRAM.letter} />
    </svg>
  );
}
