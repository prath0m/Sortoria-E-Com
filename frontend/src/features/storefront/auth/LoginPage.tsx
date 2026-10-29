import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useLogin } from '@/api/hooks/account';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { applyServerErrors } from '@/lib/forms';
import { Seo } from '@/lib/seo';
import { useAuth } from '@/stores/auth';
import { AuthLayout } from './AuthLayout';

const schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
});
type Values = z.infer<typeof schema>;

export function safeNext(next: string | null | undefined) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
}

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useAuth((s) => s.status);
  const next = safeNext(new URLSearchParams(location.search).get('next'));
  const login = useLogin();
  const { register, handleSubmit, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  if (status === 'authenticated' && !login.isSuccess) return <Navigate to={next} replace />;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      navigate(next, { replace: true });
    } catch (err) {
      applyServerErrors(err, setError, ['email', 'password']);
    }
  });

  return (
    <AuthLayout eyebrow="Welcome back" title="Sign in" intro="Your bag, wishlist and orders, wherever you left them.">
      <Seo title="Sign in" noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextField label="Email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          error={formState.errors.password?.message}
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-charcoal-800 link-underline">
            Forgotten your password?
          </Link>
        </div>
        <Button type="submit" block size="lg" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        New to Sartoria?{' '}
        <Link to={`/register${location.search}`} className="font-semibold text-charcoal-800 link-underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
