import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';

/** Map DRF validation errors onto form fields; anything else becomes a toast. */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: string[]) {
  if (error instanceof ApiError) {
    const fieldErrors = error.fieldErrors;
    let mapped = false;
    for (const [key, messages] of Object.entries(fieldErrors)) {
      if (fields.includes(key)) {
        setError(key as Path<T>, { type: 'server', message: messages[0] });
        mapped = true;
      }
    }
    if (!mapped) toast.error(error.message);
    return;
  }
  toast.error('Something went wrong. Please try again.');
}

export const PHONE_RE = /^[6-9]\d{9}$/;
export const PINCODE_RE = /^[1-9]\d{5}$/;
