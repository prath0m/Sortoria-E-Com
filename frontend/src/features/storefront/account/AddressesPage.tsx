import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAddresses, useDeleteAddress, useSaveAddress, useSetDefaultAddress } from '@/api/hooks/account';
import type { Address } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { AddressForm } from './AddressForm';

export default function AddressesPage() {
  const { data: addresses, isLoading } = useAddresses();
  const save = useSaveAddress();
  const remove = useDeleteAddress();
  const setDefault = useSetDefaultAddress();
  const [editing, setEditing] = useState<Partial<Address> | null>(null);

  return (
    <section aria-labelledby="addresses-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="addresses-heading" className="text-display-sm">Address book</h2>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>
          Add address
        </Button>
      </div>
      {isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : !addresses?.length ? (
        <EmptyState
          illustration="box"
          title="No addresses yet"
          description="Save where you'd like things delivered, and checkout becomes a single tap."
          action={<Button onClick={() => setEditing({})}>Add your first address</Button>}
        />
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col rounded-sm border border-line bg-surface-raised p-5">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{a.full_name}</p>
                {a.label ? <Badge tone="outline">{a.label}</Badge> : null}
                {a.is_default_shipping ? <Badge tone="new">Default</Badge> : null}
              </div>
              <address className="mt-2 flex-1 text-sm not-italic leading-relaxed text-ink-soft">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ''}
                <br />
                {a.landmark ? `Near ${a.landmark}, ` : ''}
                {a.city}, {a.state} {a.pincode}
                <br />
                +91 {a.phone}
              </address>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <button type="button" className="inline-flex min-h-11 items-center text-charcoal-800 underline-offset-4 hover:underline" onClick={() => setEditing(a)}>
                  Edit
                </button>
                {!a.is_default_shipping ? (
                  <button type="button" className="text-charcoal-800 link-underline" onClick={() => setDefault.mutate(a.id)}>
                    Set as default
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:text-danger hover:underline"
                  onClick={() => {
                    if (window.confirm('Remove this address?')) remove.mutate(a.id, { onSuccess: () => toast.success('Address removed') });
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit address' : 'New address'} className="max-w-2xl">
        {editing ? (
          <div className="p-5 sm:p-6">
            <AddressForm
              initial={editing}
              onCancel={() => setEditing(null)}
              onSubmit={async (values) => {
                await save.mutateAsync({ ...values, id: editing.id });
                toast.success('Address saved');
                setEditing(null);
              }}
            />
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
