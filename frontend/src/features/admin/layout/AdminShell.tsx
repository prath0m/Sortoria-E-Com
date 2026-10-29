import { LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { IconButton } from '@/components/ui/Button';
import { LeftDrawer } from '@/components/ui/Overlay';
import { PageLoader } from '@/components/ui/PageLoader';
import { cn } from '@/lib/cn';
import { Seo } from '@/lib/seo';
import { useAuth } from '@/stores/auth';
import { CommandSearch } from './CommandSearch';
import { NotificationsMenu } from './NotificationsMenu';
import { RequireStaff } from './RequireStaff';
import { Sidebar } from './Sidebar';
import { useAdminTheme } from './useAdminTheme';

const COLLAPSE_KEY = 'sartoria-admin-sidebar';

export default function AdminShell() {
  const { theme, toggle } = useAdminTheme();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <RequireStaff>
      <Seo title="Admin" noindex />
      <div className="min-h-screen bg-surface text-ink">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-header hidden border-r border-line bg-surface-raised transition-[width] duration-400 ease-luxe lg:block',
            collapsed ? 'w-[4.5rem]' : 'w-64',
          )}
        >
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </aside>
        <LeftDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Admin menu" hideTitle>
          <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </LeftDrawer>

        <div className={cn('transition-[padding] duration-400 ease-luxe', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64')}>
          <header className="sticky top-0 z-header flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
            <IconButton label="Open menu" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </IconButton>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-10 flex-1 items-center gap-3 rounded-xs border border-line px-3 text-left text-sm text-ink-muted hover:border-line-strong sm:max-w-md"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1 truncate">
                <span className="sm:hidden">Search</span>
                <span className="hidden sm:inline">Search orders, products, customers</span>
              </span>
              <kbd className="hidden rounded-xs border border-line px-1.5 text-[0.6875rem] sm:inline">⌘K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </IconButton>
              <NotificationsMenu />
              <div className="ml-2 hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight text-ink">{user?.full_name || user?.email}</p>
                <p className="text-xs capitalize leading-tight text-ink-muted">{user?.role}</p>
              </div>
              <IconButton
                label="Sign out"
                onClick={async () => {
                  await logout();
                  navigate('/admin/login');
                }}
              >
                <LogOut className="h-5 w-5" />
              </IconButton>
            </div>
          </header>
          <main id="main" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </RequireStaff>
  );
}
