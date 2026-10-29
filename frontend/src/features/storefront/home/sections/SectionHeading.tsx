import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '@/components/motion/Reveal';
import { cn } from '@/lib/cn';
import { useSectionIndex } from '../sectionIndex';

/** Editorial section header: "(02) Eyebrow" on the left, a large title on the right, link at the end. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  cta,
  action,
  center,
  tone = 'default',
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  cta?: { label: string; url: string };
  action?: ReactNode;
  center?: boolean;
  tone?: 'default' | 'light';
}) {
  const index = useSectionIndex();
  if (!title && !eyebrow) return null;
  const light = tone === 'light';
  const label = (
    <p className={cn('flex items-baseline gap-3 text-sm', light ? 'text-white/60' : 'text-ink-muted')}>
      {index ? <span className="tabular-nums">({index})</span> : null}
      {eyebrow ? <span>{eyebrow}</span> : null}
    </p>
  );
  const link = cta?.label ? (
    <Link
      to={cta.url}
      className={cn('group inline-flex items-center gap-1.5 text-sm font-medium', light ? 'text-white' : 'text-ink')}
    >
      <span className="underline decoration-1 underline-offset-[6px] transition-[text-decoration-color] group-hover:decoration-transparent">{cta.label}</span>
      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  ) : null;

  if (center) {
    return (
      <Reveal className="mb-12 flex flex-col items-center text-center lg:mb-16">
        {label}
        {title ? <h2 className={cn('mt-4 max-w-3xl text-display-xl', light && 'text-white')}>{title}</h2> : null}
        {subtitle ? <p className={cn('mt-4 max-w-xl', light ? 'text-white/70' : 'text-ink-soft')}>{subtitle}</p> : null}
        {link ? <div className="mt-6">{link}</div> : null}
      </Reveal>
    );
  }

  return (
    <Reveal className={cn('mb-10 grid gap-4 border-t pt-6 lg:mb-14 lg:grid-cols-12 lg:gap-8', light ? 'border-white/15' : 'border-line')}>
      <div className="lg:col-span-3">{label}</div>
      <div className="flex flex-wrap items-end justify-between gap-6 lg:col-span-9">
        <div className="max-w-3xl">
          {title ? <h2 className={cn('text-display-xl', light && 'text-white')}>{title}</h2> : null}
          {subtitle ? <p className={cn('mt-4 max-w-xl', light ? 'text-white/70' : 'text-ink-soft')}>{subtitle}</p> : null}
        </div>
        {link || action ? (
          <div className="flex items-center gap-4">
            {link}
            {action}
          </div>
        ) : null}
      </div>
    </Reveal>
  );
}
