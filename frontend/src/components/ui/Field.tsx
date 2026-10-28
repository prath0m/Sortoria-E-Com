import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

const control =
  'peer block w-full rounded-xs border border-line-strong/70 bg-surface-raised px-4 text-[0.9375rem] text-ink placeholder:text-ink-muted/70 transition-[border-color,box-shadow] duration-250 focus:border-burgundy-800 focus:outline-none focus:ring-2 focus:ring-gold-300/60 disabled:opacity-60 aria-[invalid=true]:border-danger';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  hideLabel?: boolean;
  children: ReactNode;
  className?: string;
}

export function FieldShell({ id, label, hint, error, optional, hideLabel, children, className }: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className={cn('flex items-baseline justify-between text-sm font-medium text-ink', hideLabel && 'sr-only')}>
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-ink-muted">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  hideLabel?: boolean;
  wrapperClassName?: string;
};

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, hint, error, optional, hideLabel, wrapperClassName, className, id, type = 'text', ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} hideLabel={hideLabel} className={wrapperClassName}>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(control, 'h-12', isPassword && 'pr-12', className)}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-muted hover:text-ink"
            aria-label={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </FieldShell>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextArea(
  { label, hint, error, optional, className, id, rows = 4, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(control, 'py-3 leading-relaxed', className)}
        {...rest}
      />
    </FieldShell>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  hideLabel?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, error, hint, hideLabel, options, placeholder, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(
          control,
          'h-12 appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10',
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23590907' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")]",
          className,
        )}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

const CHECK_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.5l2.5 2.5L12 5.5' stroke='%23FBF8F3' stroke-width='2' fill='none'/%3E%3C/svg%3E\")";
const checkboxClass =
  'mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 cursor-pointer appearance-none rounded-xs border border-line-strong bg-surface-raised bg-center bg-no-repeat transition-colors checked:border-burgundy-800 checked:bg-burgundy-800 checked:[background-image:var(--check)]';

export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }
>(function Checkbox({ label, description, className, id, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        className={checkboxClass}
        style={{ '--check': CHECK_SVG } as React.CSSProperties}
        {...rest}
      />
      <label htmlFor={fieldId} className="cursor-pointer text-sm leading-snug text-ink">
        {label}
        {description ? <span className="mt-0.5 block text-[0.8125rem] text-ink-muted">{description}</span> : null}
      </label>
    </div>
  );
});
