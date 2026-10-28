import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/stores/auth';
import { api } from '../client';
import { qk } from '../queryKeys';
import type { Address, AuthResponse, User } from '../types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  first_name: string;
  last_name?: string;
  phone?: string;
  marketing_opt_in?: boolean;
}

export function useLogin() {
  const setSession = useAuth((s) => s.setSession);
  return useMutation({
    mutationFn: (input: LoginInput) =>
      api<AuthResponse>('/auth/login/', { method: 'POST', body: input, noRetry: true }),
    onSuccess: setSession,
  });
}

export function useRegister() {
  const setSession = useAuth((s) => s.setSession);
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api<AuthResponse>('/auth/register/', { method: 'POST', body: input, noRetry: true }),
    onSuccess: setSession,
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ detail: string }>('/auth/password/forgot/', { method: 'POST', body: { email } }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { uid: string; token: string; password: string }) =>
      api<{ detail: string }>('/auth/password/reset/', { method: 'POST', body: input }),
  });
}

export function useChangePassword() {
  const setSession = useAuth((s) => s.setSession);
  return useMutation({
    mutationFn: (input: { current_password: string; new_password: string }) =>
      api<AuthResponse>('/auth/password/change/', { method: 'POST', body: input }),
    onSuccess: setSession,
  });
}

export function useUpdateProfile() {
  const setUser = useAuth((s) => s.setUser);
  return useMutation({
    mutationFn: (input: Partial<Pick<User, 'first_name' | 'last_name' | 'phone' | 'marketing_opt_in'>>) =>
      api<User>('/auth/me/', { method: 'PATCH', body: input }),
    onSuccess: setUser,
  });
}

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: qk.addresses,
    queryFn: () => api<Address[]>('/account/addresses/'),
    enabled,
  });
}

export type AddressInput = Omit<Address, 'id' | 'state_code' | 'country'>;

export function useSaveAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<AddressInput> & { id?: number }) =>
      id
        ? api<Address>(`/account/addresses/${id}/`, { method: 'PATCH', body: input })
        : api<Address>('/account/addresses/', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.addresses }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/account/addresses/${id}/`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.addresses }),
  });
}

export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<Address>(`/account/addresses/${id}/set-default/`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.addresses }),
  });
}
