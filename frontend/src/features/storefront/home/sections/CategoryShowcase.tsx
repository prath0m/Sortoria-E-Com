import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { toSrcSet } from '@/lib/srcset';
import { SectionHeading } from './SectionHeading';

type Category = { id: number; name: string; slug: string; image: string | null; renditions?: Record<string, string> };

/**
 * Departments as a typographic index: large names in hairline rows. On pointer devices a preview
 * image follows the cursor; on touch, each row carries a small thumbnail instead.
 */
export function CategoryShowcase({ eyebrow, title, subtitle, categories }: { eyebrow: string; title: string; subtitle: string; categories: Category[] }) {
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState<Category | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 30, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 260, damping: 30, mass: 0.6 });

  return (
    <section className="container-page py-16 lg:py-24">
      <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} cta={{ label: 'Shop everything', url: '/shop' }} />
      <div
        className="relative"
        onPointerMove={(e) => {
          x.set(e.clientX);
          y.set(e.clientY);
        }}
        onPointerLeave={() => setActive(null)}
      >
      <ol>
        {categories.map((c, i) => (
          <li key={c.id} className="border-b border-line first:border-t">
            <Link
              to={`/shop/${c.slug}`}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(c)}
              onFocus={() => setActive(null)}
              className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-4 md:grid-cols-[4rem_1fr_auto] md:py-6"
            >
              <span className="text-xs tabular-nums text-ink-muted">{String(i + 1).padStart(2, '0')}</span>
              <span
                className={cn(
                  'text-[clamp(1.75rem,1rem+3.6vw,4.5rem)] font-semibold leading-none tracking-[-0.045em] transition-[color,transform] duration-500 ease-luxe group-hover:translate-x-3',
                  active && active.id !== c.id ? 'text-ink/25' : 'text-ink',
                )}
              >
                {c.name}
              </span>
              <span className="flex items-center gap-3">
                {c.image ? (
                  <img src={c.image} srcSet={toSrcSet(c.renditions)} sizes="64px" alt="" loading="lazy" className="h-12 w-12 rounded-full object-cover md:hidden" />
                ) : null}
                <ArrowUpRight className="h-6 w-6 text-ink transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 md:h-8 md:w-8" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
        {!reduce ? (
          <motion.div
            aria-hidden="true"
            style={{ x: sx, y: sy }}
            className="pointer-events-none fixed left-0 top-0 z-[30] hidden md:block"
          >
            <AnimatePresence>
              {active?.image ? (
                <motion.img
                  key={active.id}
                  src={active.image}
                  srcSet={toSrcSet(active.renditions)}
                  sizes="320px"
                  alt=""
                  initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 h-[22rem] w-[17rem] max-w-none rounded-md object-cover shadow-lift"
                />
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
