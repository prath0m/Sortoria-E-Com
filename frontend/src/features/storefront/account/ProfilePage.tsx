import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useChangePassword, useUpdateProfile } from '@/api/hooks/account';
import { Button } from '@/components/ui/Button';
import { Checkbox, TextField } from '@/components/ui/Field';
import { applyServerErrors, PHONE_RE } from '@/lib/forms';
import { useAuth } from '@/stores/auth';

const profileSchema = z.object({
  first_name: z.string().trim().min(1, 'Please enter your first name.'),
  last_name: z.string().trim().optional(),
  phone: z.string().regex(PHONE_RE, 'Enter a 10-digit mobile number.').or(z.literal('')),
  marketing_opt_in: z.boolean(),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Please enter your current password.'),
    new_password: z.string().min(8, 'Use at least 8 characters.').regex(/\d/, 'Include at least one number.'),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: "The passwords don't match." });

export default function ProfilePage() {
  const user = useAuth((s) => s.user)!;
  const update = useUpdateProfile();
  const change = useChangePassword();
  const profile = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: user.first_name, last_name: user.last_name, phone: user.phone, marketing_opt_in: user.marketing_opt_in },
  });
  const password = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });

  const saveProfile = profile.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast.success('Your details are saved');
    } catch (err) {
      applyServerErrors(err, profile.setError, ['first_name', 'last_name', 'phone']);
    }
  });

  const savePassword = password.handleSubmit(async ({ current_password, new_password }) => {
    try {
      await change.mutateAsync({ current_password, new_password });
      password.reset();
      toast.success('Password updated. Other devices have been signed out.');
    } catch (err) {
      applyServerErrors(err, password.setError, ['current_password', 'new_password']);
    }
  });

  const pe = profile.formState.errors;
  const we = password.formState.errors;
  return (
    <div className="space-y-12">
      <section aria-labelledby="profile-heading" className="max-w-xl">
        <h2 id="profile-heading" className="text-display-sm">Your details</h2>
        <form onSubmit={saveProfile} noValidate className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="First name" autoComplete="given-name" {...profile.register('first_name')} error={pe.first_name?.message} />
            <TextField label="Last name" autoComplete="family-name" optional {...profile.register('last_name')} />
          </div>
          <TextField label="Email" value={user.email} disabled hint="Contact us to change the email on your account." readOnly />
          <TextField label="Mobile number" type="tel" inputMode="numeric" optional {...profile.register('phone')} error={pe.phone?.message} />
          <Checkbox label="Email me new arrivals and private offers" {...profile.register('marketing_opt_in')} />
          <Button type="submit" loading={profile.formState.isSubmitting}>
            Save details
          </Button>
        </form>
      </section>
      <section aria-labelledby="password-heading" className="max-w-xl border-t border-line pt-10">
        <h2 id="password-heading" className="text-display-sm">Password</h2>
        <form onSubmit={savePassword} noValidate className="mt-6 space-y-5">
          <TextField label="Current password" type="password" autoComplete="current-password" {...password.register('current_password')} error={we.current_password?.message} />
          <TextField label="New password" type="password" autoComplete="new-password" {...password.register('new_password')} error={we.new_password?.message} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" {...password.register('confirm')} error={we.confirm?.message} />
          <Button type="submit" variant="secondary" loading={password.formState.isSubmitting}>
            Update password
          </Button>
        </form>
      </section>
    </div>
  );
}
