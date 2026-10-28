import { Package, Search, ShoppingBag, User } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminSearch } from '@/api/hooks/admin';
import { Modal } from '@/components/ui/Overlay';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { useDebounced } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';

type Hit = { key: string; label: string; detail: string; href: string; icon: typeof Search; group: string };

/** ⌘K / Ctrl+K palette across orders, products and customers. */
export function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const debounced = useDebounced(q, 200);
  const { data, isFetching } = useAdminSearch(debounced);
  const navigate = useNavigate();
  const listId = useId();

  const hits: Hit[] = useMemo(() => {
    if (!data || debounced.trim().length < 2) return [];
    return [
      ...data.orders.map((o) => ({ key: `o${o.number}`, label: o.number, detail: `${o.email} · ${o.status} · ${formatMoney(o.total)}`, href: `/admin-panel/orders/${o.number}`, icon: ShoppingBag, group: 'Orders' })),
      ...data.products.map((p) => ({ key: `p${p.id}`, label: p.name, detail: 'Product', href: `/admin-panel/products/${p.id}`, icon: Package, group: 'Products' })),
      ...data.customers.map((c) => ({ key: `c${c.id}`, label: c.name, detail: c.email, href: `/admin-panel/customers/${c.id}`, icon: User, group: 'Customers' })),
    ];
  }, [data, debounced]);

  useEffect(() => setActive(0), [debounced]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    onClose();
    navigate(hit.href);
  };

  return (
    <Modal open={open} onClose={onClose} title="Search" hideTitle className="max-w-xl">
      <div className="px-5 pb-5">
        <div className="flex items-center gap-3 border-b border-line pb-3">
          <Search className="h-5 w-5 text-ink-muted" aria-hidden="true" />
          <input
            autoFocus
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, hits.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                go(hits[active]);
              }
            }}
            placeholder="Orders, products, customers…"
            aria-label="Search the admin"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={listId}
            aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
            className="min-w-0 flex-1 bg-transparent text-lg text-ink placeholder:text-ink-muted focus:outline-none"
          />
          {isFetching ? <Spinner className="h-4 w-4 text-ink-muted" /> : null}
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="mt-3 max-h-80 overflow-y-auto">
          {hits.map((hit, i) => (
            // Keyboard is handled on the combobox input (aria-activedescendant), as the ARIA pattern specifies.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={hit.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(hit)}
              className={cn('flex cursor-pointer items-center gap-3 rounded-xs px-3 py-2.5', i === active && 'bg-accent-soft')}
            >
              <hit.icon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{hit.label}</span>
                <span className="block truncate text-xs text-ink-muted">{hit.detail}</span>
              </span>
              <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">{hit.group}</span>
            </li>
          ))}
        </ul>
        {debounced.trim().length >= 2 && data && !hits.length && !isFetching ? (
          <p className="py-6 text-center text-sm text-ink-muted">Nothing matches “{debounced}”.</p>
        ) : null}
        {debounced.trim().length < 2 ? <p className="py-6 text-center text-sm text-ink-muted">Type an order number, product name, email or phone.</p> : null}
      </div>
    </Modal>
  );
}
