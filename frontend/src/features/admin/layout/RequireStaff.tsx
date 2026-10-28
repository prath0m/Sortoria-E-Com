import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Monogram } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/PageLoader';
import { useAuth } from '@/stores/auth';
import { can } from './nav';

export function RequireStaff({ children }: { children: ReactNode }) {
  const { status, user, logout } = useAuth();
  const location = useLocation();
  if (status === 'unknown') return <PageLoader />;
  if (status === 'anonymous') {
    return <Navigate to={`/admin-panel/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (!can(user?.capabilities, 'dashboard.view')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-6 text-center">
        <Monogram className="h-12 w-12" />
        <h1 className="text-display-sm">This area is for the Sartoria team</h1>
        <p className="max-w-sm text-ink-soft">You're signed in as {user?.email}, which doesn't have admin access.</p>
        <Button variant="secondary" onClick={() => logout()}>
          Sign in with a different account
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
