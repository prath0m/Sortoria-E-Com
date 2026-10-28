import { Menu, Search, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigation, useStoreSettings } from '@/api/hooks/store';
import { Logo, Monogram } from '@/components/brand/Logo';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
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
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
          'container-page grid grid-cols-[1fr_auto_1fr] items-center transition-[padding] duration-400 ease-luxe',
          scrolled ? 'py-2' : 'py-3 lg:py-5',
        )}
      >
        <div className="flex items-center gap-1">
          <IconButton label="Open menu" className="xl:hidden" onClick={() => setMobileNavOpen(true)}>
            <Menu className="h-5 w-5" />
          </IconButton>
          <IconButton label="Search" onClick={() => setSearchOpen(true)} className="lg:hidden">
            <Search className="h-5 w-5" />
          </IconButton>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-10 w-56 items-center gap-3 rounded-full border border-line-strong/70 px-4 text-left text-sm text-ink-muted transition-colors hover:border-burgundy-800 lg:flex"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search {name}
          </button>
        </div>

        <Link to="/" aria-label={`${name} home`} className="justify-self-center">
          <Monogram src={store?.logo_monogram} label={name} className="h-9 w-9 sm:hidden" />
          <Logo
            src={store?.logo}
            label={name}
            className={cn('hidden w-auto transition-[height] duration-400 ease-luxe sm:block', scrolled ? 'h-6' : 'h-7 lg:h-9')}
          />
        </Link>

        <div className="flex items-center justify-end gap-0.5">
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
        <div className={cn('hidden border-t border-line/70 xl:block', scrolled && 'border-transparent')}>
          <MegaMenu categories={categories} />
        </div>
      ) : null}
    </header>
  );
}
