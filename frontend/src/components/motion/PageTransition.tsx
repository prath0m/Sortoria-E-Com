import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { ease } from '@/design/motion';

export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.15 : 0.5, ease: ease.luxe }}
    >
      {children}
    </motion.div>
  );
}
