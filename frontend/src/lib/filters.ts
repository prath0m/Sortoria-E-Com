/** Filter state lives in the URL so links are shareable and the back button just works. */

export const FILTER_KEYS_FIXED = ['brand', 'price_min', 'price_max', 'rating_min', 'in_stock', 'on_sale', 'discount_min'];

export function listValues(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  return raw ? raw.split(',').filter(Boolean) : [];
}

/** Add or remove one value from a comma-separated multi-select param. Resets pagination. */
export function toggleValue(params: URLSearchParams, key: string, value: string): URLSearchParams {
  const next = new URLSearchParams(params);
  const values = new Set(listValues(params, key));
  if (values.has(value)) values.delete(value);
  else values.add(value);
  if (values.size) next.set(key, [...values].join(','));
  else next.delete(key);
  next.delete('page');
  return next;
}

/** Set (or clear, when value is empty) a single-valued param. Resets pagination. */
export function setValue(params: URLSearchParams, key: string, value: string | number | null | undefined) {
  const next = new URLSearchParams(params);
  if (value === null || value === undefined || value === '') next.delete(key);
  else next.set(key, String(value));
  if (key !== 'page') next.delete('page');
  return next;
}

export function isFilterKey(key: string) {
  return FILTER_KEYS_FIXED.includes(key) || key.startsWith('attr.');
}

/** Drop every filter but keep search text, sort and view. */
export function clearFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of params) {
    if (!isFilterKey(key) && key !== 'page') next.set(key, value);
  }
  return next;
}

export function activeFilterCount(params: URLSearchParams): number {
  let count = 0;
  for (const [key, value] of params) {
    if (!isFilterKey(key)) continue;
    count += key === 'price_min' || key === 'price_max' ? 0 : value.split(',').filter(Boolean).length;
  }
  if (params.get('price_min') || params.get('price_max')) count += 1;
  return count;
}
