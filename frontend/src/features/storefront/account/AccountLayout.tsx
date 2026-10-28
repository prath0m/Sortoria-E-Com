import { LogOut } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Seo } from '@/lib/seo';
import { useAuth } from '@/stores/auth';
import { RequireAuth } from './RequireAuth';

export const ACCOUNT_LINKS = [
  { to: '/account', label: 'Overview', end: true },
  { to: '/account/orders', label: 'Orders' },
  { to: '/account/returns', label: 'Returns' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/account/profile', label: 'Profile & security' },
  { to: '/account/addresses', label: 'Addresses' },
];

export default function AccountLayout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  return (
    <RequireAuth>
      <Seo title="Your account" noindex />
      <div className="container-page py-10 lg:py-14">
        <header className="mb-10">
          <p className="eyebrow">Your account</p>
          <h1 className="mt-2 text-display-lg">Hello{user?.first_name ? `, ${user.first_name}` : ''}</h1>
        </header>
        <div className="grid gap-10 lg:grid-cols-[14rem_1fr] lg:gap-16">
          <nav aria-label="Account">
            <ul className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.to} className="shrink-0">
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-xs px-3 py-2 text-sm transition-colors',
                        isActive ? 'bg-burgundy-800 text-cream-50' : 'text-ink-soft hover:bg-cream-200 hover:text-ink',
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
              <li className="shrink-0 lg:mt-4 lg:border-t lg:border-line lg:pt-4">
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  className="flex items-center gap-2 rounded-xs px-3 py-2 text-sm text-ink-soft hover:text-burgundy-800"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </li>
            </ul>
          </nav>
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
