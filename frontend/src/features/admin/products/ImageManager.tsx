import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { GripVertical, ImagePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, getAccessToken } from '@/api/client';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import type { AdminImage, CatalogOptions } from './types';

function Tile({ image, onAlt, onOption, onDelete, colours }: { image: AdminImage; onAlt: (v: string) => void; onOption: (v: number | null) => void; onDelete: () => void; colours: { id: number; value: string }[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('rounded-sm border border-line bg-surface-raised p-2', isDragging && 'z-10 shadow-lift')}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-xs bg-ink/5">
        <img src={image.thumb} alt={image.alt_text} className="h-full w-full object-cover" />
        <button type="button" {...attributes} {...listeners} aria-label={`Drag to reorder ${image.alt_text}`} className="absolute left-1.5 top-1.5 cursor-grab rounded-xs bg-surface-raised/90 p-1 text-ink active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${image.alt_text}`} className="absolute right-1.5 top-1.5 rounded-xs bg-surface-raised/90 p-1 text-ink hover:text-danger">
          <Trash2 className="h-4 w-4" />
        </button>
        {image.position === 0 ? <span className="absolute bottom-1.5 left-1.5 rounded-xs bg-primary px-1.5 py-0.5 text-[0.625rem] font-semibold text-primary-on">Main</span> : null}
      </div>
      <label className="mt-2 block text-xs">
        <span className="text-ink-muted">Alt text</span>
        <input defaultValue={image.alt_text} onBlur={(e) => e.target.value !== image.alt_text && onAlt(e.target.value)} className="mt-0.5 h-8 w-full rounded-xs border border-line bg-surface px-2 text-xs focus:border-accent focus:outline-none" />
      </label>
      {colours.length ? (
        <label className="mt-1.5 block text-xs">
          <span className="text-ink-muted">Shown for</span>
          <select value={image.option_value ?? ''} onChange={(e) => onOption(e.target.value ? Number(e.target.value) : null)} className="mt-0.5 h-8 w-full rounded-xs border border-line bg-surface px-1 text-xs">
            <option value="">Every option</option>
            {colours.map((c) => <option key={c.id} value={c.id}>{c.value}</option>)}
          </select>
        </label>
      ) : null}
    </li>
  );
}

/** Drag-and-drop upload with progress, drag-to-reorder (mouse and keyboard), alt text and colour linking. */
export function ImageManager({ productId, images, options, usedValueIds }: { productId: number; images: AdminImage[]; options: CatalogOptions; usedValueIds: number[] }) {
  const qc = useQueryClient();
  const [items, setItems] = useState(images);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const swatchValues = options.attributes.filter((a) => a.kind === 'swatch').flatMap((a) => a.values).filter((v) => usedValueIds.includes(v.id));
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'products'] });

  const upload = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    const form = new FormData();
    list.forEach((f) => form.append('files', f));
    // XHR rather than fetch so we can show upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/v1/admin/products/${productId}/images/`);
    {
      const access = getAccessToken();
      if (access) xhr.setRequestHeader('Authorization', `Bearer ${access}`);
      xhr.setRequestHeader('X-Sartoria-Client', '1');
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        setProgress(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          setItems((prev) => [...prev, ...(JSON.parse(xhr.responseText) as AdminImage[])]);
          toast.success(`${list.length} ${list.length === 1 ? 'image' : 'images'} added`);
          refresh();
        } else {
          toast.error(new ApiError(xhr.status, JSON.parse(xhr.responseText || 'null')).message);
        }
      };
      xhr.onerror = () => {
        setProgress(null);
        toast.error('Upload failed. Please check your connection.');
      };
      xhr.send(form);
    }
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex).map((img, position) => ({ ...img, position }));
    setItems(next);
    try {
      await api(`/admin/products/${productId}/images/reorder/`, { method: 'POST', body: { ids: next.map((i) => i.id) } });
      refresh();
    } catch (err) {
      setItems(items);
      toast.error(err instanceof ApiError ? err.message : 'Could not reorder images.');
    }
  };

  const patch = async (id: number, body: Partial<AdminImage>) => {
    const updated = await api<AdminImage>(`/admin/product-images/${id}/`, { method: 'PATCH', body });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
  };

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
        className={cn('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed px-6 py-10 text-center transition-colors', dragOver ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong')}
      >
        {progress !== null ? <Spinner /> : <ImagePlus className="h-8 w-8 text-ink-muted" aria-hidden="true" />}
        <span className="text-sm font-medium text-ink">{progress !== null ? `Uploading… ${progress}%` : 'Drop images here, or click to choose'}</span>
        <span className="text-xs text-ink-muted">JPEG, PNG or WebP up to 8 MB each. The first image is the main one.</span>
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ''; }} />
        {progress !== null ? <span className="mt-1 h-1 w-48 overflow-hidden rounded-full bg-ink/10"><span className="block h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></span> : null}
      </label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((image) => (
              <Tile
                key={image.id}
                image={image}
                colours={swatchValues}
                onAlt={(alt_text) => patch(image.id, { alt_text }).then(() => toast.success('Alt text saved'))}
                onOption={(option_value) => patch(image.id, { option_value })}
                onDelete={async () => {
                  if (!window.confirm('Delete this image?')) return;
                  await api(`/admin/product-images/${image.id}/`, { method: 'DELETE' });
                  setItems((prev) => prev.filter((i) => i.id !== image.id).map((img, position) => ({ ...img, position })));
                  refresh();
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
