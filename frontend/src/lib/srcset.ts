import type { Srcset } from '@/api/types';

/** "url 400w, url 800w" from server renditions, or undefined when there are none. */
export function toSrcSet(set: Srcset | undefined | null) {
  const entries = Object.entries(set ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  return entries.length ? entries.map(([w, url]) => `${url} ${w}w`).join(', ') : undefined;
}
