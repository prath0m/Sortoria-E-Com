import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'link' | 'gold' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold uppercase tracking-[0.14em] transition-[background-color,color,border-color,box-shadow,transform] duration-250 ease-luxe disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-on hover:bg-primary-hover shadow-soft',
  secondary: 'border border-burgundy-800 text-burgundy-800 hover:bg-burgundy-800 hover:text-cream-50',
  ghost: 'text-ink hover:bg-ink/5',
  link: 'link-underline px-0 tracking-[0.12em] text-burgundy-800',
  gold: 'bg-gold-300 text-ink hover:bg-gold-200 shadow-soft',
  danger: 'bg-danger text-white hover:opacity-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[0.6875rem] rounded-xs',
  md: 'h-11 px-6 text-xs rounded-xs',
  lg: 'h-14 px-8 text-[0.8125rem] rounded-xs',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
}

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  block,
  className,
}: Pick<ButtonProps, 'variant' | 'size' | 'block' | 'className'>) {
  return cn(base, variants[variant], variant !== 'link' && sizes[size], block && 'w-full', className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, block, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...rest
}: LinkProps & Pick<ButtonProps, 'variant' | 'size' | 'block'>) {
  return <Link className={buttonClasses({ variant, size, block, className })} {...rest} />;
}

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; badge?: number }
>(function IconButton({ label, badge, className, children, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors duration-250 hover:bg-ink/5 disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
      {badge ? (
        <span className="absolute right-0.5 top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-burgundy-800 px-1 text-[0.625rem] font-bold leading-none text-cream-50">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
});
