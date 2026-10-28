import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BotanicalDivider } from '@/components/brand/Illustrations';
import { Reveal } from '@/components/motion/Reveal';
import { cn } from '@/lib/cn';

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  cta,
  center,
  tone = 'default',
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  cta?: { label: string; url: string };
  center?: boolean;
  tone?: 'default' | 'light';
}) {
  if (!title && !eyebrow) return null;
  return (
    <Reveal className={cn('mb-10 flex flex-wrap items-end justify-between gap-6', center && 'flex-col items-center text-center')}>
      <div className={cn(center && 'max-w-2xl')}>
        {eyebrow ? <p className={cn('eyebrow', tone === 'light' && 'text-gold-300')}>{eyebrow}</p> : null}
        {title ? <h2 className={cn('mt-2 text-display-lg', tone === 'light' && 'text-cream-50')}>{title}</h2> : null}
        {subtitle ? <p className={cn('mt-3 max-w-xl text-ink-soft', center && 'mx-auto', tone === 'light' && 'text-cream-200')}>{subtitle}</p> : null}
        {center ? <BotanicalDivider className="mt-6" /> : null}
      </div>
      {cta?.label ? (
        <Link to={cta.url} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-burgundy-800 link-underline">
          {cta.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </Reveal>
  );
}
