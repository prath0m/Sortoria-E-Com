import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Stars } from '@/components/ui/Rating';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { SectionHeading } from './SectionHeading';

type Item = { name: string; location: string; quote: string; rating: number; avatar: string | null };

/** One voice at a time, set large. Advances slowly; pauses on hover, focus or reduced motion. */
export function Testimonials({ eyebrow, title, items }: { eyebrow: string; title: string; items: Item[] }) {
  const reduce = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;
  const go = (n: number) => setIndex(((n % count) + count) % count);

  useEffect(() => {
    if (reduce || paused || count < 2) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), 8000);
    return () => window.clearTimeout(t);
  }, [index, reduce, paused, count]);

  const item = items[index];
  if (!item) return null;

  return (
    <section
      className="container-page py-16 lg:py-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        action={
          count > 1 ? (
            <div className="flex items-center gap-3">
              <span className="text-sm tabular-nums text-ink-muted" aria-hidden="true">
                {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
              </span>
              <button type="button" onClick={() => go(index - 1)} aria-label="Previous testimonial" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-surface">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => go(index + 1)} aria-label="Next testimonial" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-surface">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : null
        }
      />
      <div className="lg:ml-[25%]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.figure
            key={index}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <blockquote className="max-w-4xl text-[clamp(1.5rem,1rem+2.2vw,3rem)] font-medium leading-[1.15] tracking-[-0.03em] text-ink">
              “{item.quote}”
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-4">
              {item.avatar ? <img src={item.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : null}
              <span className="text-sm">
                <span className="block font-semibold text-ink">{item.name}</span>
                <span className="flex items-center gap-2 text-ink-muted">
                  {item.location}
                  <Stars value={item.rating} size={12} />
                  <span className="sr-only">Rated {item.rating} out of 5</span>
                </span>
              </span>
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>
    </section>
  );
}
