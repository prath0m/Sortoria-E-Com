import { ChevronsLeft, ExternalLink } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useStoreSettings } from '@/api/hooks/store';
import { Logo, Monogram } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { useAuth } from '@/stores/auth';
import { can, NAV } from './nav';

export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const capabilities = useAuth((s) => s.user?.capabilities);
  const { data: store } = useStoreSettings();
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center border-b border-line', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        {collapsed ? (
          <Monogram className="h-8 w-8" />
        ) : (
          <span className="flex items-baseline gap-2">
            <Logo src={store?.logo} className="h-5 text-accent" />
            <span className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-ink-muted">Admin</span>
          </span>
        )}
        {onToggle && !collapsed ? (
          <button type="button" onClick={onToggle} aria-label="Collapse sidebar" className="inline-flex h-8 w-8 items-center justify-center rounded-xs text-ink-muted hover:bg-ink/5 hover:text-ink">
            <ChevronsLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => can(capabilities, i.capability));
          if (!items.length) return null;
          return (
            <div key={group.label} className="mb-6">
              {!collapsed ? <p className="mb-2 px-3 text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-ink-muted">{group.label}</p> : null}
              <ul className="space-y-0.5">
                {items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-xs px-3 py-2 text-sm transition-colors',
                          collapsed && 'justify-center px-0',
                          isActive ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-soft hover:bg-ink/5 hover:text-ink',
                        )
                      }
                    >
                      <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
                      <span className={cn(collapsed && 'sr-only')}>{label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-line p-3">
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className={cn('flex items-center gap-3 rounded-xs px-3 py-2 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink', collapsed && 'justify-center px-0')}
          title="View storefront"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className={cn(collapsed && 'sr-only')}>View storefront</span>
        </a>
        {onToggle && collapsed ? (
          <button type="button" onClick={onToggle} aria-label="Expand sidebar" className="mt-1 flex w-full justify-center rounded-xs py-2 text-ink-muted hover:bg-ink/5 hover:text-ink">
            <ChevronsLeft className="h-4 w-4 rotate-180" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
