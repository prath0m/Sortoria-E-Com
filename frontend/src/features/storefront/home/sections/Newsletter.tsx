import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { ApiError } from '@/api/client';
import { useSubscribe } from '@/api/hooks/cms';
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
          className={cn('text-sm', dark ? 'text-paper-100' : 'text-ink-soft')}
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
                // flex-none when stacked (compact, on phones), otherwise it would collapse to its content height.
                'h-12 min-w-0 rounded-full border px-5 text-sm focus:outline-none', compact ? 'flex-none sm:flex-1' : 'flex-1',
                dark
                  ? 'border-white/25 bg-white/5 text-white placeholder:text-white/50 focus:border-white'
                  : 'border-line-strong bg-surface-raised focus:border-charcoal-800',
              )}
            />
            <Button type="submit" variant={dark ? 'inverse' : 'primary'} size="lg" loading={subscribe.isPending}>
              Subscribe
            </Button>
          </div>
          {error ? (
            <p role="alert" className={cn('mt-2 text-sm', dark ? 'text-[#fca5a5]' : 'text-danger')}>
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
    <section className="container-page py-16 lg:py-24">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0a0a0a] px-6 py-14 text-white md:px-14 md:py-20">
        {/* A soft indigo glow: the one flourish in an otherwise monochrome page. */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 h-[30rem] w-[30rem] rounded-full bg-[#4f46e5] opacity-30 blur-[120px]" />
        <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            {eyebrow ? <p className="text-sm text-white/60">{eyebrow}</p> : null}
            <h2 className="mt-4 text-[clamp(2.25rem,1.2rem+4.4vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-white">{title}</h2>
          </div>
          <div>
            {subtitle ? <p className="mb-6 max-w-md text-white/70">{subtitle}</p> : null}
            <NewsletterForm source="homepage" tone="dark" />
          </div>
        </div>
      </div>
    </section>
  );
}
