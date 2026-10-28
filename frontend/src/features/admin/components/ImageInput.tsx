import { ImagePlus } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/cn';

/** Single image picker that previews the current or newly chosen file. */
export function ImageInput({ label, current, file, onChange, hint, aspect = 'aspect-[4/3]' }: { label: string; current?: string | null; file: File | null; onChange: (f: File | null) => void; hint?: string; aspect?: string }) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const src = preview ?? current ?? null;
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      <label htmlFor={id} className={cn('group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xs border border-dashed border-line bg-surface hover:border-line-strong', aspect)}>
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-ink-muted" aria-hidden="true" />}
        <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-center text-xs text-cream-50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {src ? 'Replace' : 'Choose image'}
        </span>
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/** Build multipart data from a map of chosen files, or null when there's nothing to upload. */
export function filesForm(files: Record<string, File | null>) {
  const entries = Object.entries(files).filter((e): e is [string, File] => !!e[1]);
  if (!entries.length) return null;
  const form = new FormData();
  entries.forEach(([k, f]) => form.append(k, f));
  return form;
}
