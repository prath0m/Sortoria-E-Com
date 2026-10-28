import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { Address } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextField } from '@/components/ui/Field';
import { applyServerErrors, PHONE_RE, PINCODE_RE } from '@/lib/forms';
import { INDIAN_STATES } from '@/lib/states';

export const addressSchema = z.object({
  full_name: z.string().trim().min(2, 'Please enter the full name.'),
  phone: z.string().regex(PHONE_RE, 'Enter a 10-digit mobile number.'),
  line1: z.string().trim().min(3, 'Please enter the house number and street.'),
  line2: z.string().trim(),
  landmark: z.string().trim(),
  city: z.string().trim().min(2, 'Please enter the city.'),
  state: z.string().min(1, 'Please choose a state.'),
  pincode: z.string().regex(PINCODE_RE, 'Enter a valid 6-digit pincode.'),
  label: z.string().trim(),
  is_default_shipping: z.boolean(),
});
export type AddressValues = z.infer<typeof addressSchema>;

interface AddressFormProps {
  initial?: Partial<Address>;
  submitLabel?: string;
  onSubmit: (values: AddressValues) => Promise<unknown>;
  onCancel?: () => void;
  showDefault?: boolean;
}

export function AddressForm({ initial, submitLabel = 'Save address', onSubmit, onCancel, showDefault = true }: AddressFormProps) {
  const { register, handleSubmit, setError, formState } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      full_name: initial?.full_name ?? '',
      phone: initial?.phone ?? '',
      line1: initial?.line1 ?? '',
      line2: initial?.line2 ?? '',
      landmark: initial?.landmark ?? '',
      city: initial?.city ?? '',
      state: initial?.state ?? '',
      pincode: initial?.pincode ?? '',
      label: initial?.label ?? '',
      is_default_shipping: initial?.is_default_shipping ?? false,
    },
  });
  const e = formState.errors;
  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (err) {
      applyServerErrors(err, setError, Object.keys(addressSchema.shape));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Full name" autoComplete="name" {...register('full_name')} error={e.full_name?.message} />
        <TextField label="Mobile number" type="tel" inputMode="numeric" autoComplete="tel-national" {...register('phone')} error={e.phone?.message} />
      </div>
      <TextField label="House, flat and street" autoComplete="address-line1" {...register('line1')} error={e.line1?.message} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Area or locality" optional autoComplete="address-line2" {...register('line2')} />
        <TextField label="Landmark" optional {...register('landmark')} />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField label="Pincode" inputMode="numeric" autoComplete="postal-code" {...register('pincode')} error={e.pincode?.message} />
        <TextField label="City" autoComplete="address-level2" {...register('city')} error={e.city?.message} />
        <SelectField
          label="State"
          autoComplete="address-level1"
          placeholder="Choose…"
          options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
          {...register('state')}
          error={e.state?.message}
        />
      </div>
      {showDefault ? (
        <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
          <TextField label="Label" optional placeholder="Home, Studio…" {...register('label')} />
          <Checkbox label="Make this my default address" {...register('is_default_shipping')} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" loading={formState.isSubmitting}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
