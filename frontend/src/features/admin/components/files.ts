/** A chosen file, '' to clear the stored image, or null for "leave as is". */
export type FileChange = File | '' | null;

/** Build multipart data from a map of file changes, or null when there's nothing to send. */
export function filesForm(files: Record<string, FileChange>) {
  const entries = Object.entries(files).filter(([, f]) => f !== null) as [string, File | ''][];
  if (!entries.length) return null;
  const form = new FormData();
  entries.forEach(([k, f]) => form.append(k, f));
  return form;
}
