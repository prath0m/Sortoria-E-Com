import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useRegister } from '@/api/hooks/account';
import { Button } from '@/components/ui/Button';
import { Checkbox, TextField } from '@/components/ui/Field';
import { applyServerErrors, PHONE_RE } from '@/lib/forms';
import { Seo } from '@/lib/seo';
import { AuthLayout } from './AuthLayout';
import { safeNext } from './LoginPage';

const schema = z.object({
  first_name: z.string().trim().min(1, 'Please tell us your first name.'),
  last_name: z.string().trim().optional(),
  email: z.string().email('Please enter a valid email address.'),
  phone: z.string().regex(PHONE_RE, 'Enter a 10-digit mobile number.').or(z.literal('')).optional(),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
  marketing_opt_in: z.boolean().optional(),
});
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const registerUser = useRegister();
  const { register, handleSubmit, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser.mutateAsync(values);
      navigate(safeNext(new URLSearchParams(location.search).get('next')), { replace: true });
    } catch (err) {
      applyServerErrors(err, setError, ['first_name', 'last_name', 'email', 'phone', 'password']);
    }
  });

  return (
    <AuthLayout eyebrow="Join us" title="Create your account" intro="Save addresses, track orders and keep a wishlist that follows you.">
      <Seo title="Create an account" noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="First name" autoComplete="given-name" {...register('first_name')} error={formState.errors.first_name?.message} />
          <TextField label="Last name" autoComplete="family-name" optional {...register('last_name')} />
        </div>
        <TextField label="Email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
        <TextField
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          optional
          hint="For delivery updates only."
          {...register('phone')}
          error={formState.errors.phone?.message}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          {...register('password')}
          error={formState.errors.password?.message}
        />
        <Checkbox label="Send me new arrivals and private offers" description="A few considered emails a month. Unsubscribe anytime." {...register('marketing_opt_in')} />
        <Button type="submit" block size="lg" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{' '}
        <Link to={`/login${location.search}`} className="font-semibold text-charcoal-800 link-underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
