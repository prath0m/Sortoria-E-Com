import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { staggerChild, staggerParent } from '@/components/motion/Reveal';
import { cn } from '@/lib/cn';
import { SectionHeading } from './SectionHeading';
import { toSrcSet } from '@/lib/srcset';

type Category = { id: number; name: string; slug: string; image: string | null; renditions?: Record<string, string> };

/** Editorial mosaic: one tall feature tile, then a grid. */
export function CategoryShowcase({ eyebrow, title, subtitle, categories }: { eyebrow: string; title: string; subtitle: string; categories: Category[] }) {
  return (
    <section className="container-page py-16 lg:py-24">
      <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} center />
      <motion.ul
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-10%' }}
        className="grid auto-rows-[11rem] grid-cols-2 gap-3 sm:auto-rows-[14rem] md:grid-cols-4 md:gap-5 lg:auto-rows-[15rem]"
      >
        {categories.map((c, i) => (
          <motion.li key={c.id} variants={staggerChild} className={cn(i === 0 && 'col-span-2 row-span-2', i === 5 && 'md:col-span-2')}>
            <Link to={`/shop/${c.slug}`} className="group relative block h-full overflow-hidden rounded-sm bg-paper-200">
              {c.image ? (
                <img src={c.image} srcSet={toSrcSet(c.renditions)} sizes={i === 0 ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 25vw, 50vw'} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-1200 ease-luxe group-hover:scale-[1.06]" />
              ) : null}
              <span className="absolute inset-0 bg-gradient-to-t from-shade/70 via-shade/10 to-transparent" />
              <span className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2 md:inset-x-5 md:bottom-5">
                <span className={cn('font-display text-paper-50', i === 0 ? 'text-display-md' : 'text-xl md:text-2xl')}>{c.name}</span>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-iris-200 opacity-0 transition-all duration-400 group-hover:-translate-y-1 group-hover:opacity-100" aria-hidden="true" />
              </span>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
