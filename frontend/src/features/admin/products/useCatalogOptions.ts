import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { CatalogOptions } from './types';

export function useCatalogOptions() {
  return useQuery({ queryKey: ['admin', 'catalog-options'], queryFn: () => api<CatalogOptions>('/admin/catalog/options/'), staleTime: 60_000 });
}

/** Indented labels for a category <select>. */
export function categoryOptions(options: CatalogOptions | undefined, leavesOnly = false) {
  return (options?.categories ?? []).map((c) => ({
    value: String(c.id),
    label: `${'— '.repeat(c.depth - 1)}${c.name}`,
    disabled: leavesOnly && !c.is_leaf,
  }));
}
