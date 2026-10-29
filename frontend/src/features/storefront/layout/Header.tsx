import { Moon, Search, Sun, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useStoreSettings } from '@/api/hooks/store';
import { Logo } from '@/components/brand/Logo';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useColorTheme } from '@/lib/theme';
import { useAuth } from '@/stores/auth';
import { useUI } from '@/stores/ui';
import { HeaderActions } from '../cart/HeaderActions';

const pill = 'inline-flex h-9 items-center rounded-full px-3.5 text-[0.8125rem] font-medium transition-colors';

/**
 * Floating glass navigation. A zero-height sticky wrapper so content (the homepage hero included)
 * runs underneath; "Shop" opens the full-screen department index.
 */
export function Header() {
  const { data: store } = useStoreSettings();
  const user = useAuth((s) => s.user);
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  const menuOpen = useUI((s) => s.mobileNavOpen);
  const setMenuOpen = useUI((s) => s.setMobileNavOpen);
  const { theme, toggle: toggleTheme } = useColorTheme('store');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // "/" opens search, unless someone is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || target.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen]);

  const name = store?.name ?? 'Sartoria';

  return (
    <header className="sticky top-0 z-header h-0">
      <div className="container-page pt-3">
        <div
          className={cn(
            'flex h-14 items-center gap-1 rounded-full border pl-5 pr-1.5 backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-500 ease-luxe',
            scrolled ? 'border-line bg-surface-raised/85 shadow-lift' : 'border-white/40 bg-surface-raised/60 dark:border-white/10',
          )}
        >
          <Link to="/" aria-label={`${name} home`} className="mr-3 flex h-11 shrink-0 items-center">
            <Logo src={store?.logo} label={name} className="h-3.5 w-auto sm:h-4" />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              className={cn(pill, 'text-ink hover:bg-ink/5')}
            >
              Shop
            </button>
            <NavLink to="/shop?sort=newest" className={cn(pill, 'text-ink-soft hover:bg-ink/5 hover:text-ink')}>
              New in
            </NavLink>
            <NavLink to="/offers" className={({ isActive }) => cn(pill, 'hover:bg-ink/5', isActive ? 'text-ink' : 'text-ink-soft hover:text-ink')}>
              Offers
            </NavLink>
          </nav>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-auto hidden h-10 w-64 items-center gap-2.5 rounded-full bg-ink/[0.05] px-4 text-left text-[0.8125rem] text-ink-muted transition-colors hover:bg-ink/[0.08] md:flex xl:w-72"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
            <kbd className="ml-auto rounded-md border border-line-strong px-1.5 font-sans text-[0.6875rem]">/</kbd>
          </button>

          <div className="ml-auto flex items-center md:ml-1">
            <IconButton label="Search" onClick={() => setSearchOpen(true)} className="md:hidden">
              <Search className="h-[1.125rem] w-[1.125rem]" />
            </IconButton>
            <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-[1.125rem] w-[1.125rem]" /> : <Moon className="h-[1.125rem] w-[1.125rem]" />}
            </IconButton>
            <Link
              to={user ? '/account' : '/login'}
              aria-label={user ? 'Your account' : 'Sign in'}
              title={user ? 'Your account' : 'Sign in'}
              className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5 sm:inline-flex"
            >
              <User className="h-[1.125rem] w-[1.125rem]" />
            </Link>
            <HeaderActions />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              className="ml-1 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-[0.8125rem] font-medium text-primary-on lg:hidden"
            >
              Menu
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
