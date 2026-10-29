import { Menu, Moon, Search, Sun, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigation, useStoreSettings } from '@/api/hooks/store';
import { Logo, Monogram } from '@/components/brand/Logo';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useColorTheme } from '@/lib/theme';
import { useAuth } from '@/stores/auth';
import { useUI } from '@/stores/ui';
import { HeaderActions } from '../cart/HeaderActions';
import { MegaMenu } from './MegaMenu';

export function Header() {
  const { data: store } = useStoreSettings();
  const { data: categories = [] } = useNavigation();
  const user = useAuth((s) => s.user);
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  const setMobileNavOpen = useUI((s) => s.setMobileNavOpen);
  const { theme, toggle: toggleTheme } = useColorTheme('store');
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef<HTMLElement>(null);

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

  // Publish the header's bottom edge so the mega-menu panel can sit flush beneath it.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () =>
      document.documentElement.style.setProperty('--header-bottom', `${node.getBoundingClientRect().bottom}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
    };
  }, []);

  const name = store?.name ?? 'Sartoria';

  return (
    <header
      ref={ref}
      className={cn(
        'sticky top-0 z-header border-b bg-surface/90 backdrop-blur-md transition-[box-shadow,border-color] duration-400',
        scrolled ? 'border-line shadow-soft' : 'border-transparent',
      )}
    >
      <div
        className={cn(
          'container-page flex items-center gap-3 transition-[padding] duration-400 ease-luxe lg:gap-8',
          scrolled ? 'py-2' : 'py-3 lg:py-4',
        )}
      >
        <div className="flex items-center gap-1 lg:gap-0">
          <IconButton label="Open menu" className="-ml-2 xl:hidden" onClick={() => setMobileNavOpen(true)}>
            <Menu className="h-5 w-5" />
          </IconButton>
          <Link to="/" aria-label={`${name} home`} className="shrink-0">
            <Monogram src={store?.logo_monogram} label={name} className="h-8 w-8 sm:hidden" />
            <Logo src={store?.logo} label={name} className="hidden h-[1.125rem] w-auto sm:block lg:h-5" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mx-auto hidden h-11 w-full max-w-xl items-center gap-3 rounded-full bg-surface-muted px-5 text-left text-sm text-ink-muted transition-colors hover:bg-surface-strong lg:flex"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search products, brands and categories
          <kbd className="ml-auto rounded-md border border-line-strong px-1.5 py-0.5 font-sans text-[0.6875rem] text-ink-muted">/</kbd>
        </button>

        <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
          <IconButton label="Search" onClick={() => setSearchOpen(true)} className="lg:hidden">
            <Search className="h-5 w-5" />
          </IconButton>
          <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </IconButton>
          <Link
            to={user ? '/account' : '/login'}
            aria-label={user ? 'Your account' : 'Sign in'}
            title={user ? 'Your account' : 'Sign in'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5"
          >
            <User className="h-5 w-5" />
          </Link>
          <HeaderActions />
        </div>
      </div>
      {categories.length ? (
        <div className="hidden xl:block">
          <MegaMenu categories={categories} />
        </div>
      ) : null}
    </header>
  );
}
