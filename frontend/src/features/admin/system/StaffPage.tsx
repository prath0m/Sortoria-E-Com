import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/api/client';
import { adminApi, useAdminAll } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/stores/auth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { dateTime } from '../orders/types';

interface Staff {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: 'manager' | 'admin';
  is_active: boolean;
  last_login: string | null;
  invited: boolean;
}

const CAPABILITY_LABEL: Record<string, string> = {
  'dashboard.view': 'Dashboard', 'orders.view': 'See orders', 'orders.manage': 'Update orders', 'orders.refund': 'Refunds', 'returns.manage': 'Returns',
  'customers.view': 'See customers', 'customers.manage': 'Deactivate customers', 'reviews.manage': 'Reviews', 'inventory.manage': 'Stock',
  'catalog.edit': 'Edit catalogue', 'catalog.delete': 'Delete products', 'offers.manage': 'Offers', 'cms.manage': 'Content', 'export.run': 'Exports',
  'import.run': 'Product imports', 'shipping.manage': 'Shipping', 'settings.manage': 'Store settings', 'staff.manage': 'Staff', 'audit.view': 'Activity log',
};

function Invite({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', role: 'manager' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const created = await adminApi.create<Staff>('staff', form);
      qc.invalidateQueries({ queryKey: ['admin', 'staff'] });
      toast.success(created.invited ? `Invitation sent to ${created.email}` : `${created.email} now has ${created.role} access`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else toast.error(err instanceof ApiError ? err.message : 'Could not send the invitation.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Invite a colleague">
      <div className="space-y-4 p-5 sm:p-6">
        <TextField label="Email" type="email" data-autofocus value={form.email} error={errors.email?.[0]} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="First name" optional value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          <TextField label="Last name" optional value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        </div>
        <SelectField label="Role" value={form.role} options={[{ value: 'manager', label: 'Manager: runs orders, catalogue and content' }, { value: 'admin', label: 'Admin: everything, including settings and staff' }]} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        <p className="text-xs text-ink-muted">They'll get an email with a link to set a password. If they already shop with you, they keep their account and sign in as usual.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={submit}>Send invitation</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function StaffPage() {
  const qc = useQueryClient();
  const me = useAuth((s) => s.user?.id);
  const { data, isLoading, isError, refetch } = useAdminAll<Staff>('staff');
  const { data: roles } = useQuery({ queryKey: ['admin', 'staff', 'roles'], queryFn: () => api<Record<string, string[]>>('/admin/staff/roles/') });
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<Staff | null>(null);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ['admin', 'staff'] });
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  return (
    <>
      <PageHeader title="Staff" eyebrow="Store" actions={<Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviting(true)}>Invite</Button>} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <ul className="divide-y divide-line/60 rounded-sm border border-line bg-surface-raised">
              {data?.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-on" aria-hidden="true">
                    {(s.first_name || s.email)[0].toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">
                      {s.full_name || s.email} {s.id === me ? <span className="text-xs font-normal text-ink-muted">(you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {s.email} · {s.invited ? 'Invitation not yet accepted' : `Last signed in ${s.last_login ? dateTime(s.last_login) : 'never'}`}
                    </p>
                  </div>
                  {!s.is_active ? <StatusBadge status="inactive" label="Suspended" /> : s.invited ? <StatusBadge status="pending" label="Invited" /> : null}
                  <select
                    aria-label={`Role for ${s.email}`}
                    value={s.role}
                    disabled={s.id === me}
                    onChange={(e) => act(() => adminApi.update('staff', s.id, { role: e.target.value }), 'Role updated')}
                    className="h-9 rounded-xs border border-line bg-surface px-2 text-sm disabled:opacity-60"
                  >
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  {s.id !== me ? (
                    <div className="flex gap-1">
                      {s.invited ? <Button size="sm" variant="ghost" onClick={() => act(() => adminApi.post(`staff/${s.id}/resend/`), 'Invitation sent again')}>Resend</Button> : null}
                      <Button size="sm" variant="ghost" onClick={() => act(() => adminApi.update('staff', s.id, { is_active: !s.is_active }), s.is_active ? 'Access suspended' : 'Access restored')}>
                        {s.is_active ? 'Suspend' : 'Restore'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRevoking(s)}>Remove</Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="space-y-4">
          {(['manager', 'admin'] as const).map((role) => (
            <section key={role} className="rounded-sm border border-line bg-surface-raised p-4">
              <h2 className="font-sans text-sm font-semibold capitalize text-ink">{role}s can</h2>
              <ul className="mt-2 flex flex-wrap gap-1">
                {(roles?.[role] ?? []).map((cap) => (
                  <li key={cap} className="rounded-xs bg-ink/5 px-1.5 py-0.5 text-xs text-ink-soft">{CAPABILITY_LABEL[cap] ?? cap}</li>
                ))}
              </ul>
            </section>
          ))}
        </aside>
      </div>
      {inviting ? <Invite onClose={() => setInviting(false)} /> : null}
      <ConfirmDialog
        open={!!revoking}
        title={`Remove ${revoking?.email}?`}
        danger
        confirmLabel="Remove access"
        onConfirm={() => { act(() => adminApi.post(`staff/${revoking!.id}/revoke/`), 'Admin access removed'); setRevoking(null); }}
        onClose={() => setRevoking(null)}
      >
        They're signed out everywhere and lose admin access. Their customer account and orders stay.
      </ConfirmDialog>
    </>
  );
}
