import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** List state (search, filters, ordering, page) kept in the URL so views are shareable and survive refresh. */
export function useTableState(defaults: { ordering: string }) {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  const state = useMemo(() => {
    const out: Record<string, string> = { ordering: defaults.ordering, page: '1' };
    params.forEach((value, key) => {
      out[key] = value;
    });
    return out as Record<string, string | undefined> & { ordering: string; page: string };
  }, [params, defaults.ordering]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
    setSelected(new Set());
  };

  return {
    state,
    query: { ...state, page: Number(state.page) },
    set,
    selected,
    setSelected,
  };
}
