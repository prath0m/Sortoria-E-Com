import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { qk } from '../queryKeys';
import type { NavNode, StoreSettings } from '../types';

declare global {
  interface Window {
    /** Inlined by Django in production to skip the first round-trip. */
    __SARTORIA_SETTINGS__?: StoreSettings;
  }
}

export function useStoreSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: () => api<StoreSettings>('/store/settings/'),
    initialData: typeof window !== 'undefined' ? window.__SARTORIA_SETTINGS__ : undefined,
    staleTime: 5 * 60_000,
  });
}

export function useNavigation() {
  return useQuery({
    queryKey: qk.navigation,
    queryFn: () => api<{ categories: NavNode[] }>('/store/navigation/').then((r) => r.categories),
    staleTime: 10 * 60_000,
  });
}
