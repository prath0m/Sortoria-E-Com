const pad = (n: number) => String(n).padStart(2, '0');
/** ISO string -> value for <input type="datetime-local"> in the viewer's timezone. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
