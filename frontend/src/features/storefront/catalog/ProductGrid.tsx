import { motion } from 'framer-motion';
import type { ProductCard as Product } from '@/api/types';
import { staggerChild, staggerParent } from '@/components/motion/Reveal';
import { cn } from '@/lib/cn';
import { ProductCard } from './ProductCard';

export function ProductGrid({ products, view = 'grid', className }: { products: Product[]; view?: 'grid' | 'list'; className?: string }) {
  return (
    <motion.ul
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className={cn(
        view === 'grid' ? 'grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4' : 'flex flex-col gap-8',
        className,
      )}
    >
      {products.map((product, i) => (
        <motion.li key={product.id} variants={staggerChild}>
          <ProductCard product={product} view={view} priority={i < 4} />
        </motion.li>
      ))}
    </motion.ul>
  );
}
