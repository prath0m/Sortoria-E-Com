import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '@/stores/auth';

/** Per-screen guard; the API enforces the same capability. */
export function RequireCapability({ capability, children }: { capability: string; children: ReactNode }) {
  // Kept free of nav.ts so the router (in the storefront bundle) doesn't pull in the admin icon set.
  const allowed = useAuth((s) => !!s.user?.capabilities.includes(capability));
  if (allowed) return <>{children}</>;
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <Lock className="h-8 w-8 text-ink-muted" aria-hidden="true" />
      <h1 className="text-display-sm">Not part of your role</h1>
      <p className="max-w-sm text-sm text-ink-soft">Ask an administrator if you need access to this section.</p>
    </div>
  );
}
