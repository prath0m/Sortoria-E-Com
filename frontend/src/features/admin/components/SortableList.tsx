import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

function Row({ id, label, children }: { id: number; label: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('flex items-center gap-3 border-b border-line/60 bg-surface-raised px-3 py-3 last:border-0', isDragging && 'relative z-10 shadow-lift')}>
      <button type="button" {...attributes} {...listeners} aria-label={`Drag to reorder ${label}`} className="cursor-grab rounded-xs p-1 text-ink-muted hover:text-ink active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
    </li>
  );
}

/** Vertical drag-to-reorder list (pointer and keyboard: Space to lift, arrows to move, Space to drop). */
export function SortableList<T extends { id: number }>({ items, onReorder, label, render }: { items: T[]; onReorder: (next: T[]) => void; label: (item: T) => string; render: (item: T) => ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(items, items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="rounded-sm border border-line bg-surface-raised">
          {items.map((item) => (
            <Row key={item.id} id={item.id} label={label(item)}>
              {render(item)}
            </Row>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
