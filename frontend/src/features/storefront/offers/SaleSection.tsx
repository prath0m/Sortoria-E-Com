import { Link } from 'react-router-dom';
import type { Sale } from '@/api/types';
import { Countdown } from '@/components/motion/Countdown';
import { Reveal } from '@/components/motion/Reveal';
import { ProductCard } from '../catalog/ProductCard';

export function SaleSection({ sale, limit }: { sale: Sale; limit?: number }) {
  const products = limit ? sale.products.slice(0, limit) : sale.products;
  const live = new Date(sale.starts_at).getTime() <= Date.now();
  return (
    <section aria-labelledby={`sale-${sale.id}`} className="grain overflow-hidden rounded-md bg-burgundy-900 text-cream-100">
      <div className="relative z-[2] p-6 sm:p-10">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-gold-300">{sale.kind === 'daily_deal' ? 'Deal of the day' : 'Flash sale'}</p>
            <h2 id={`sale-${sale.id}`} className="mt-2 text-display-lg text-cream-50">
              <Link to={`/offers/sale/${sale.slug}`} className="hover:text-gold-200">{sale.title}</Link>
            </h2>
            {sale.subtitle ? <p className="mt-2 max-w-xl text-cream-200">{sale.subtitle}</p> : null}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cream-200">{live ? 'Ends in' : 'Starts in'}</p>
            <Countdown to={live ? sale.ends_at : sale.starts_at} tone="dark" />
          </div>
        </Reveal>
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <li key={p.id} className="rounded-sm bg-surface-raised p-3 text-ink">
              <ProductCard product={p} />
              {p.sale_progress?.cap ? (
                <div className="mt-3">
                  <div className="h-1 overflow-hidden rounded-full bg-cream-200">
                    <div
                      className="h-full rounded-full bg-gold-400"
                      style={{ width: `${Math.min(100, (p.sale_progress.sold / p.sale_progress.cap) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {Math.max(0, p.sale_progress.cap - p.sale_progress.sold)} left at this price
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
