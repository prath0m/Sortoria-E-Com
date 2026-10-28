import { PackageSearch } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useTrackOrder } from '@/api/hooks/orders';
import { BotanicalBranch } from '@/components/brand/Illustrations';
import { Reveal } from '@/components/motion/Reveal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Seo } from '@/lib/seo';

export default function TrackOrderPage() {
  const track = useTrackOrder();
  const navigate = useNavigate();
  const [number, setNumber] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="relative overflow-hidden">
      <Seo title="Track your order" description="Follow your Sartoria order with your order number and email or mobile." path="/track-order" />
      <BotanicalBranch className="absolute -right-10 top-10 hidden h-48 w-72 opacity-60 md:block" />
      <div className="container-page flex justify-center py-14 md:py-20">
        <Reveal className="w-full max-w-md">
          <PackageSearch className="mx-auto h-10 w-10 text-burgundy-800" aria-hidden="true" />
          <h1 className="mt-4 text-center text-display-lg">Track your order</h1>
          <p className="mt-3 text-center text-ink-soft">Enter your order number and the email or mobile number you used at checkout.</p>
          <form
            className="mt-10 space-y-5 rounded-sm border border-line bg-surface-raised p-6 shadow-soft sm:p-8"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              try {
                const order = await track.mutateAsync({ number: number.trim(), contact: contact.trim() });
                navigate(`/order/${order.number}?token=${encodeURIComponent(order.access_token)}`);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
              }
            }}
          >
            <TextField label="Order number" placeholder="SRT-2026-001042" value={number} onChange={(e) => setNumber(e.target.value)} required autoComplete="off" />
            <TextField label="Email or mobile number" value={contact} onChange={(e) => setContact(e.target.value)} required autoComplete="email" />
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" block size="lg" loading={track.isPending}>
              Find my order
            </Button>
          </form>
        </Reveal>
      </div>
    </div>
  );
}
