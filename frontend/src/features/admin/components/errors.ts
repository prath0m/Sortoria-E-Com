/** Flatten DRF's nested error payloads (lists of objects) into readable lines. */
export function flattenErrors(data: unknown, prefix = ''): string[] {
  if (data == null) return [];
  if (typeof data === 'string') return [prefix ? `${prefix}: ${data}` : data];
  if (Array.isArray(data)) {
    if (data.every((d) => typeof d === 'string')) return data.map((d) => (prefix ? `${prefix}: ${d}` : d));
    return data.flatMap((d, i) => flattenErrors(d, `${prefix} ${i + 1}`.trim()));
  }
  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      .filter(([k]) => k !== 'code')
      .flatMap(([k, v]) => flattenErrors(v, k === 'detail' || k === 'non_field_errors' ? prefix : `${prefix ? `${prefix} ` : ''}${k.replace(/_/g, ' ')}`));
  }
  return [];
}
