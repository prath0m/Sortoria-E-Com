import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn('relative inline-flex', className)} aria-hidden="true">
      <span className="flex gap-0.5 text-sage-300">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} width={size} height={size} fill="currentColor" strokeWidth={0} />
        ))}
      </span>
      <span className="absolute inset-0 flex gap-0.5 overflow-hidden text-gold-400" style={{ width: `${(value / 5) * 100}%` }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} width={size} height={size} className="shrink-0" fill="currentColor" strokeWidth={0} />
        ))}
      </span>
    </span>
  );
}

export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-muted', className)}>
      <Stars value={value} />
      <span className="sr-only">Rated {value.toFixed(1)} out of 5</span>
      <span aria-hidden="true">{value.toFixed(1)}</span>
      {count !== undefined ? <span>({count})</span> : null}
    </span>
  );
}
