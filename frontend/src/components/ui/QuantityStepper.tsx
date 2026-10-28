import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md';
  label?: string;
  disabled?: boolean;
}

export function QuantityStepper({ value, min = 1, max, onChange, size = 'md', label = 'Quantity', disabled }: QuantityStepperProps) {
  const h = size === 'sm' ? 'h-9' : 'h-12';
  const btn = cn('inline-flex w-10 items-center justify-center text-ink transition-colors hover:bg-ink/5 disabled:opacity-30', h);
  return (
    <div className={cn('inline-flex items-center rounded-xs border border-line-strong', disabled && 'opacity-50')} role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <output aria-live="polite" aria-label={`${label}: ${value}`} className={cn('flex w-10 items-center justify-center text-sm font-semibold tabular-nums', h)}>
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
