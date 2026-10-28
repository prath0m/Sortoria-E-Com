import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/cn';

/** A chosen file, '' to clear the stored image, or null for "leave as is". */
export type FileChange = File | '' | null;

/** Single image picker that previews the current or newly chosen file. */
export function ImageInput({
  label,
  current,
  file,
  onChange,
  hint,
  aspect = 'aspect-[4/3]',
  clearable,
  fit = 'cover',
}: {
  label: string;
  current?: string | null;
  file: FileChange;
  onChange: (f: FileChange) => void;
  hint?: string;
  aspect?: string;
  clearable?: boolean;
  fit?: 'cover' | 'contain';
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!(file instanceof File)) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const src = file === '' ? null : (preview ?? current ?? null);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{label}</p>
        {clearable && src ? (
          <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-danger">
            <Trash2 className="h-3 w-3" aria-hidden="true" /> Remove
          </button>
        ) : null}
      </div>
      <label htmlFor={id} className={cn('group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xs border border-dashed border-line bg-surface hover:border-line-strong', aspect)}>
        {src ? <img src={src} alt="" className={cn('h-full w-full', fit === 'contain' ? 'object-contain p-2' : 'object-cover')} /> : <ImagePlus className="h-6 w-6 text-ink-muted" aria-hidden="true" />}
        <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-center text-xs text-cream-50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {src ? 'Replace' : 'Choose image'}
        </span>
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/** Build multipart data from a map of file changes, or null when there's nothing to send. */
export function filesForm(files: Record<string, FileChange>) {
  const entries = Object.entries(files).filter(([, f]) => f !== null) as [string, File | ''][];
  if (!entries.length) return null;
  const form = new FormData();
  entries.forEach(([k, f]) => form.append(k, f));
  return form;
}
