import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';
import type { Quote } from '@/api/types';
import { formatMoney } from '@/lib/money';

export function FreeShippingProgress({ quote }: { quote: Quote }) {
  const threshold = quote.free_shipping_threshold_paise;
  if (!threshold || !quote.lines.length) return null;
  const remaining = quote.free_shipping_remaining_paise;
  const progress = Math.min(1, (threshold - remaining) / threshold);
  return (
    <div className="rounded-sm bg-cream-200/70 p-4">
      <p className="flex items-center gap-2 text-sm text-ink">
        <Truck className="h-4 w-4 text-burgundy-800" aria-hidden="true" />
        {remaining > 0 ? (
          <span>
            Add <strong>{formatMoney(remaining)}</strong> more for complimentary shipping.
          </span>
        ) : (
          <span>Your order ships complimentary.</span>
        )}
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-cream-300" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Progress to complimentary shipping">
        <motion.div
          className="h-full origin-left rounded-full bg-gradient-to-r from-burgundy-700 to-gold-400"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
