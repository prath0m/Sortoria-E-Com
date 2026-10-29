import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'link' | 'inverse' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-sans font-medium tracking-[-0.005em] transition-[background-color,color,border-color,box-shadow,transform] duration-250 ease-luxe disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-on hover:bg-primary-hover',
  secondary: 'border border-line-strong bg-surface-raised text-ink hover:border-ink',
  ghost: 'text-ink hover:bg-ink/5',
  link: '!h-auto !rounded-none px-0 !px-0 text-accent underline-offset-4 hover:underline',
  // White on photos and dark bands, in both themes (fixed colours on purpose).
  inverse: 'bg-white text-[#0a0a0a] hover:bg-white/90',
  danger: 'bg-danger text-white hover:opacity-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[0.8125rem]',
  md: 'h-11 px-6 text-sm',
  lg: 'h-12 px-7 text-[0.9375rem]',
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
  icon,
  children,
  ...rest
}: LinkProps & Pick<ButtonProps, 'variant' | 'size' | 'block' | 'icon'>) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
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
        <span className="absolute right-0.5 top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold leading-none text-white dark:text-[#0a0a0a]">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
});
