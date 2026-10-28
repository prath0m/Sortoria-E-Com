import { cn } from '@/lib/cn';
import { MONOGRAM, WORDMARK } from './logoPaths';

interface LogoProps {
  className?: string;
  /** Uploaded logo from Store Settings; replaces the built-in wordmark when present. */
  src?: string | null;
  label?: string;
  tone?: 'burgundy' | 'cream';
}

export function Logo({ className, src, label = 'Sartoria', tone = 'burgundy' }: LogoProps) {
  if (src) {
    return <img src={src} alt={label} className={cn('h-8 w-auto', className)} />;
  }
  return (
    <svg
      viewBox={WORDMARK.viewBox}
      role="img"
      aria-label={label}
      className={cn('h-8 w-auto', tone === 'cream' ? 'text-cream-50' : 'text-burgundy-800', className)}
    >
      <path fill="currentColor" d={WORDMARK.letters} />
      <path
        fill="none"
        stroke="rgb(var(--gold-300))"
        strokeWidth={WORDMARK.stroke}
        strokeLinecap="round"
        d={WORDMARK.flourish}
      />
      <path fill="rgb(var(--gold-300))" d={WORDMARK.lozenge} />
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
    <svg viewBox={MONOGRAM.viewBox} role="img" aria-label={label} className={cn('h-9 w-9 text-burgundy-800', className)}>
      <circle
        cx="500"
        cy="500"
        r={MONOGRAM.ringR}
        fill="none"
        stroke="rgb(var(--gold-300))"
        strokeWidth={MONOGRAM.ringStroke * 2}
      />
      <path fill="rgb(var(--gold-300))" d="M500 44 L516 60 L500 76 L484 60 Z" />
      <path fill="currentColor" transform={MONOGRAM.transform} d={MONOGRAM.letter} />
    </svg>
  );
}
