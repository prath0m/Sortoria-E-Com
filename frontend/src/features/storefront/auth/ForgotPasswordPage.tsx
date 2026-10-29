import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useForgotPassword } from '@/api/hooks/account';
import { Illustration } from '@/components/brand/Illustrations';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { applyServerErrors } from '@/lib/forms';
import { Seo } from '@/lib/seo';
import { AuthLayout } from './AuthLayout';

const schema = z.object({ email: z.string().email('Please enter a valid email address.') });

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const { register, handleSubmit, setError, formState, getValues } = useForm<{ email: string }>({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await forgot.mutateAsync(email);
    } catch (err) {
      applyServerErrors(err, setError, ['email']);
    }
  });

  return (
    <AuthLayout eyebrow="Account" title="Reset your password" intro="We'll email you a link to choose a new one.">
      <Seo title="Reset password" noindex />
      {forgot.isSuccess ? (
        <div className="text-center" role="status">
          <Illustration name="letter" className="mx-auto h-24 w-24" />
          <p className="mt-4 text-ink">If an account exists for {getValues('email')}, a reset link is on its way.</p>
          <p className="mt-2 text-sm text-ink-muted">It can take a minute or two. Do check your spam folder.</p>
          <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-charcoal-800 link-underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <TextField label="Email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
          <Button type="submit" block size="lg" loading={formState.isSubmitting}>
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-charcoal-800 link-underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
