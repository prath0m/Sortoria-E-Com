import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { ApiError } from '@/api/client';
import { useSubscribe } from '@/api/hooks/cms';
import { Illustration, OrganicShape } from '@/components/brand/Illustrations';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export function NewsletterForm({ source, tone = 'light', compact }: { source: string; tone?: 'light' | 'dark'; compact?: boolean }) {
  const subscribe = useSubscribe();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const dark = tone === 'dark';
  return (
    <AnimatePresence mode="wait">
      {subscribe.isSuccess ? (
        <motion.p
          key="done"
          role="status"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('text-sm', dark ? 'text-cream-100' : 'text-ink-soft')}
        >
          {subscribe.data.detail}
        </motion.p>
      ) : (
        <motion.form
          key="form"
          exit={{ opacity: 0 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            try {
              await subscribe.mutateAsync({ email, source });
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Please try again.');
            }
          }}
          className={cn('w-full', !compact && 'max-w-md')}
        >
          <label htmlFor={`newsletter-${source}`} className="sr-only">
            Email address
          </label>
          <div className={cn('flex gap-2', compact && 'flex-col sm:flex-row')}>
            <input
              id={`newsletter-${source}`}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              autoComplete="email"
              aria-invalid={!!error}
              className={cn(
                'h-12 min-w-0 flex-1 rounded-xs border px-4 text-sm focus:outline-none',
                dark
                  ? 'border-cream-100/30 bg-transparent text-cream-50 placeholder:text-cream-200/70 focus:border-gold-300'
                  : 'border-line-strong bg-surface-raised focus:border-burgundy-800',
              )}
            />
            <Button type="submit" variant={dark ? 'gold' : 'primary'} size="lg" loading={subscribe.isPending}>
              Subscribe
            </Button>
          </div>
          {error ? (
            <p role="alert" className={cn('mt-2 text-sm', dark ? 'text-gold-200' : 'text-danger')}>
              {error}
            </p>
          ) : null}
        </motion.form>
      )}
    </AnimatePresence>
  );
}

export function NewsletterSection({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <section className="grain relative overflow-hidden py-16 lg:py-24">
      <OrganicShape className="absolute -left-24 top-0 h-[28rem] w-[28rem]" tone="burgundy" />
      <OrganicShape className="absolute -right-24 bottom-0 h-[22rem] w-[22rem]" tone="gold" />
      <div className="container-page relative z-[2] flex flex-col items-center text-center">
        <Illustration name="letter" className="h-24 w-24" />
        <p className="eyebrow mt-4">{eyebrow}</p>
        <h2 className="mt-2 max-w-2xl text-display-lg">{title}</h2>
        {subtitle ? <p className="mt-3 max-w-xl text-ink-soft">{subtitle}</p> : null}
        <div className="mt-8 flex w-full justify-center">
          <NewsletterForm source="homepage" />
        </div>
      </div>
    </section>
  );
}
