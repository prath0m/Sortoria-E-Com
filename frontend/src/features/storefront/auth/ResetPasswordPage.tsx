import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { useResetPassword } from '@/api/hooks/account';
import { Button, ButtonLink } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { applyServerErrors } from '@/lib/forms';
import { Seo } from '@/lib/seo';
import { AuthLayout } from './AuthLayout';

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.').regex(/\d/, 'Include at least one number.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: "The passwords don't match." });
type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { uid = '', token = '' } = useParams();
  const reset = useResetPassword();
  const { register, handleSubmit, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await reset.mutateAsync({ uid, token, password });
    } catch (err) {
      applyServerErrors(err, setError, ['password']);
    }
  });

  return (
    <AuthLayout eyebrow="Account" title="Choose a new password">
      <Seo title="Choose a new password" noindex />
      {reset.isSuccess ? (
        <div className="text-center" role="status">
          <p className="text-ink">Your password has been updated.</p>
          <ButtonLink to="/login" className="mt-6">
            Sign in
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <TextField label="New password" type="password" autoComplete="new-password" {...register('password')} error={formState.errors.password?.message} />
          <TextField label="Confirm password" type="password" autoComplete="new-password" {...register('confirm')} error={formState.errors.confirm?.message} />
          <Button type="submit" block size="lg" loading={formState.isSubmitting}>
            Update password
          </Button>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-charcoal-800 link-underline">
              Request a new link
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
