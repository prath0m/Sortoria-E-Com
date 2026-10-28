import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import type { ProductCard as Product } from '@/api/types';
import { Reveal } from '@/components/motion/Reveal';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { ProductCard } from './ProductCard';

interface ProductRailProps {
  title: string;
  eyebrow?: string;
  products?: Product[];
  loading?: boolean;
  action?: ReactNode;
}

/** Horizontal, scroll-snapping product row with arrow controls (no carousel library needed). */
export function ProductRail({ title, eyebrow, products, loading, action }: ProductRailProps) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const node = track.current;
    if (node) node.scrollBy({ left: dir * node.clientWidth * 0.8, behavior: 'smooth' });
  };
  if (!loading && !products?.length) return null;
  return (
    <section className="py-12 lg:py-16" aria-label={title}>
      <div className="container-page">
        <Reveal className="mb-8 flex items-end justify-between gap-6">
          <div>
            {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
            <h2 className="text-display-lg">{title}</h2>
          </div>
          <div className="flex items-center gap-4">
            {action}
            <div className="hidden gap-2 md:flex">
              <button type="button" onClick={() => scroll(-1)} aria-label="Scroll back" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong transition-colors hover:border-burgundy-800 hover:text-burgundy-800">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => scroll(1)} aria-label="Scroll forward" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong transition-colors hover:border-burgundy-800 hover:text-burgundy-800">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </Reveal>
        <ul
          ref={track}
          data-lenis-prevent-horizontal
          className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:gap-6 lg:-mx-10 lg:px-10"
        >
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%]">
                  <ProductCardSkeleton />
                </li>
              ))
            : products!.map((p) => (
                <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%]">
                  <ProductCard product={p} sizes="(min-width: 1024px) 23vw, (min-width: 640px) 31vw, 46vw" />
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}
