import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { useLogin } from '@/api/hooks/account';
import { useStoreSettings } from '@/api/hooks/store';
import { Monogram } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { applyServerErrors } from '@/lib/forms';
import { Seo } from '@/lib/seo';
import { useAuth } from '@/stores/auth';
import { can } from './layout/nav';

const schema = z.object({ email: z.string().email('Enter your work email.'), password: z.string().min(1, 'Enter your password.') });

export default function AdminLogin() {
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/admin-panel') ? params.get('next')! : '/admin-panel';
  const { status, user } = useAuth();
  const { data: store } = useStoreSettings();
  const login = useLogin();
  const navigate = useNavigate();
  const { register, handleSubmit, setError, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  if (status === 'authenticated' && can(user?.capabilities, 'dashboard.view') && !login.isPending) return <Navigate to={next} replace />;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const data = await login.mutateAsync(values);
      if (!can(data.user.capabilities, 'dashboard.view')) {
        toast.error("This account doesn't have admin access.");
        await useAuth.getState().logout();
        return;
      }
      navigate(next, { replace: true });
    } catch (err) {
      applyServerErrors(err, setError, ['email', 'password']);
    }
  });

  return (
    <div className="grain flex min-h-screen items-center justify-center bg-burgundy-900 px-4">
      <Seo title="Admin sign in" noindex />
      <div className="relative z-[2] w-full max-w-sm rounded-sm bg-surface-raised p-8 shadow-lift">
        <Monogram className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-center text-display-sm">{store?.name ?? 'Sartoria'} Admin</h1>
        <p className="mt-1 text-center text-sm text-ink-muted">Sign in with your team account.</p>
        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
          <TextField label="Email" type="email" autoComplete="username" {...register('email')} error={formState.errors.email?.message} />
          <TextField label="Password" type="password" autoComplete="current-password" {...register('password')} error={formState.errors.password?.message} />
          <Button type="submit" block size="lg" loading={formState.isSubmitting}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
