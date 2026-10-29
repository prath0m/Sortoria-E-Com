import { api } from '@/api/client';
import { filesForm, type FileChange } from './files';

function toForm(body: Record<string, unknown>, files: Record<string, FileChange>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => form.append(key, String(v)));
    else form.append(key, value === null ? '' : String(value));
  }
  for (const [key, file] of Object.entries(files)) if (file !== null) form.append(key, file);
  return form;
}

/**
 * Create or update an admin resource that has image fields.
 * New records with an image go up as one multipart request (some require the image);
 * otherwise the fields are sent as JSON and any image changes follow as a multipart PATCH.
 */
export async function saveWithFiles<T extends { id: number }>(resource: string, id: number | undefined, body: Record<string, unknown>, files: Record<string, FileChange>): Promise<T> {
  const hasFiles = Object.values(files).some((f) => f !== null);
  // Nested lists (sale items, bundle items) can't travel as form fields, so those always go as JSON first.
  const nested = Object.values(body).some((v) => Array.isArray(v) && v.some((x) => typeof x === 'object'));
  if (!id && hasFiles && !nested) return api<T>(`/admin/${resource}/`, { method: 'POST', body: toForm(body, files) });
  const saved = id ? await api<T>(`/admin/${resource}/${id}/`, { method: 'PATCH', body }) : await api<T>(`/admin/${resource}/`, { method: 'POST', body });
  const form = filesForm(files);
  return form ? api<T>(`/admin/${resource}/${saved.id}/`, { method: 'PATCH', body: form }) : saved;
}
