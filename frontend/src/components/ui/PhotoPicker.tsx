import { ImagePlus, X } from 'lucide-react';
import { useEffect, useId, useMemo } from 'react';

/** Small multi-photo picker with previews. Validation of type/size also happens server-side. */
export function PhotoPicker({
  files,
  onChange,
  max,
  label = 'Add photos',
  hint,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max: number;
  label?: string;
  hint?: string;
}) {
  const id = useId();
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  return (
    <div>
      <p className="text-sm font-medium text-ink">{label}</p>
      {hint ? <p className="text-[0.8125rem] text-ink-muted">{hint}</p> : null}
      <ul className="mt-2 flex flex-wrap gap-3">
        {previews.map((url, i) => (
          <li key={url} className="relative h-20 w-20 overflow-hidden rounded-xs bg-paper-200">
            <img src={url} alt={`Upload ${i + 1} preview`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-shade/70 text-paper-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {files.length < max ? (
          <li>
            <label
              htmlFor={id}
              className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xs border border-dashed border-line-strong text-[0.6875rem] text-ink-muted hover:border-charcoal-800 hover:text-charcoal-800"
            >
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
              Add
            </label>
            <input
              id={id}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).filter((f) => f.size <= 8 * 1024 * 1024);
                onChange([...files, ...picked].slice(0, max));
                e.target.value = '';
              }}
            />
          </li>
        ) : null}
      </ul>
    </div>
  );
}
