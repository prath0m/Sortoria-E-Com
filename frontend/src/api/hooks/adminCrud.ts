import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, getAccessToken } from '../client';
import type { Paginated } from '../types';

type Params = Record<string, string | number | boolean | undefined | null>;

/** Paginated admin list, keyed by resource + params. */
export function useAdminList<T>(resource: string, params: Params) {
  return useQuery({
    queryKey: ['admin', resource, 'list', params],
    queryFn: ({ signal }) => api<Paginated<T>>(`/admin/${resource}/`, { query: params as Record<string, string>, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminItem<T>(resource: string, id: string | number | undefined) {
  return useQuery({
    queryKey: ['admin', resource, 'item', String(id)],
    queryFn: () => api<T>(`/admin/${resource}/${id}/`),
    enabled: id !== undefined && id !== 'new',
  });
}

export function useAdminAll<T>(resource: string) {
  return useQuery({ queryKey: ['admin', resource, 'all'], queryFn: () => api<T[]>(`/admin/${resource}/`) });
}

/** Any admin write; invalidates the resource's queries and toasts errors. */
export function useAdminMutation<TBody, TResult = unknown>(
  resource: string,
  fn: (body: TBody) => Promise<TResult>,
  options: { success?: string; invalidate?: string[] } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [resource, ...(options.invalidate ?? [])]) qc.invalidateQueries({ queryKey: ['admin', key] });
      if (options.success) toast.success(options.success);
    },
    onError: (err) => {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) return; // forms show these inline
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong.');
    },
  });
}

export const adminApi = {
  create: <T>(resource: string, body: unknown) => api<T>(`/admin/${resource}/`, { method: 'POST', body }),
  update: <T>(resource: string, id: string | number, body: unknown, method: 'PATCH' | 'PUT' = 'PATCH') =>
    api<T>(`/admin/${resource}/${id}/`, { method, body }),
  remove: (resource: string, id: string | number) => api<void>(`/admin/${resource}/${id}/`, { method: 'DELETE' }),
  post: <T>(path: string, body?: unknown) => api<T>(`/admin/${path}`, { method: 'POST', body }),
};

/** Download an authenticated file (invoices, merged PDFs) and hand it to the browser. */
export async function downloadFile(path: string, filename: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'X-Sartoria-Client': '1' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
