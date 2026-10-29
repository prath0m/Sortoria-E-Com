import { MapPin, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAddresses } from '@/api/hooks/account';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/stores/auth';

export default function OverviewPage() {
  const user = useAuth((s) => s.user)!;
  const { data: addresses, isLoading } = useAddresses();
  const primary = addresses?.find((a) => a.is_default_shipping) ?? addresses?.[0];
  const card = 'rounded-sm border border-line bg-surface-raised p-6 transition-shadow hover:shadow-soft';
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Link to="/account/profile" className={card}>
        <User className="h-5 w-5 text-charcoal-800" aria-hidden="true" />
        <h2 className="mt-4 text-display-sm">Profile</h2>
        <p className="mt-2 text-sm text-ink-soft">{user.full_name || user.email}</p>
        <p className="text-sm text-ink-muted">{user.email}</p>
        {user.phone ? <p className="text-sm text-ink-muted">+91 {user.phone}</p> : null}
      </Link>
      <Link to="/account/addresses" className={card}>
        <MapPin className="h-5 w-5 text-charcoal-800" aria-hidden="true" />
        <h2 className="mt-4 text-display-sm">Default address</h2>
        {isLoading ? (
          <Skeleton className="mt-3 h-12 w-3/4" />
        ) : primary ? (
          <p className="mt-2 text-sm text-ink-soft">
            {primary.full_name}, {primary.line1}, {primary.city} {primary.pincode}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">Add an address for faster checkout.</p>
        )}
      </Link>
    </div>
  );
}
