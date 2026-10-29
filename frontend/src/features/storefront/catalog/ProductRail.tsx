import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useRef } from 'react';
import type { ProductCard as Product } from '@/api/types';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { SectionHeading } from '../home/sections/SectionHeading';
import { ProductCard } from './ProductCard';

interface ProductRailProps {
  title: string;
  eyebrow?: string;
  products?: Product[];
  loading?: boolean;
  cta?: { label: string; url: string };
}

/** Horizontal, scroll-snapping product row with arrow controls (no carousel library needed). */
export function ProductRail({ title, eyebrow, products, loading, cta }: ProductRailProps) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const node = track.current;
    if (node) node.scrollBy({ left: dir * node.clientWidth * 0.8, behavior: 'smooth' });
  };
  if (!loading && !products?.length) return null;
  return (
    <section className="py-16 lg:py-24" aria-label={title}>
      <div className="container-page">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          cta={cta}
          action={
            <div className="hidden gap-2 md:flex">
              <button type="button" onClick={() => scroll(-1)} aria-label="Scroll back" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-surface">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => scroll(1)} aria-label="Scroll forward" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong transition-colors hover:border-ink hover:bg-ink hover:text-surface">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          }
        />
        <ul
          ref={track}
          data-lenis-prevent-horizontal
          className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:gap-6 lg:-mx-10 lg:scroll-px-10 lg:px-10"
        >
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="w-[72%] shrink-0 snap-start sm:w-[40%] lg:w-[28%]">
                  <ProductCardSkeleton />
                </li>
              ))
            : products!.map((p) => (
                <li key={p.id} className="w-[72%] shrink-0 snap-start sm:w-[40%] lg:w-[28%]">
                  <ProductCard product={p} sizes="(min-width: 1024px) 28vw, (min-width: 640px) 40vw, 72vw" />
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}
