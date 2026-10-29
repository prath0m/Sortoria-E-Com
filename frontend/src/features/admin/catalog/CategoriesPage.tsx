import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FolderTree, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { adminApi, useAdminAll } from '@/api/hooks/adminCrud';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextArea, TextField } from '@/components/ui/Field';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { ImageInput } from '../components/ImageInput';
import { filesForm, type FileChange } from '../components/files';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useCatalogOptions } from '../products/useCatalogOptions';

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  depth: number;
  description: string;
  image: string | null;
  banner_image: string | null;
  banner_mobile_image: string | null;
  banner_headline: string;
  banner_subtext: string;
  menu_image: string | null;
  show_in_menu: boolean;
  is_active: boolean;
  position: number;
  return_policy: 'returnable' | 'replacement_only' | 'non_returnable';
  return_window_days: number | null;
  filterable_attributes: number[];
  seo_title: string;
  seo_description: string;
  product_count: number;
}

type Draft = Omit<Category, 'id' | 'depth' | 'product_count' | 'image' | 'banner_image' | 'banner_mobile_image' | 'menu_image'> & { id?: number };
type ImageField = 'image' | 'banner_image' | 'banner_mobile_image' | 'menu_image';

const blank = (parent: number | null): Draft => ({
  name: '', slug: '', parent_id: parent, description: '', banner_headline: '', banner_subtext: '', show_in_menu: true, is_active: true, position: 0,
  return_policy: 'returnable', return_window_days: null, filterable_attributes: [], seo_title: '', seo_description: '',
});

function Editor({ category, all, onClose }: { category: Category | Draft; all: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: options } = useCatalogOptions();
  const [draft, setDraft] = useState<Draft>(() => {
    const { depth: _d, product_count: _p, image: _i, banner_image: _b, banner_mobile_image: _m, menu_image: _mi, ...rest } = category as Category;
    return rest;
  });
  const [files, setFiles] = useState<Record<ImageField, FileChange>>({ image: null, banner_image: null, banner_mobile_image: null, menu_image: null });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const existing = 'image' in category ? (category as Category) : null;

  // A category can't be moved under itself or its own descendants.
  const self = existing ? all.find((c) => c.id === existing.id) : null;
  const parentChoices = all.filter((c) => !self || !isDescendant(all, c, self.id));

  const save = async () => {
    setSaving(true);
    setErrors({});
    const { parent_id, ...body } = draft;
    try {
      const saved = draft.id
        ? await adminApi.update<Category>('categories', draft.id, { ...body, parent: parent_id })
        : await adminApi.create<Category>('categories', { ...body, parent: parent_id });
      const form = filesForm(files);
      if (form) await adminApi.update('categories', saved.id, form);
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      qc.invalidateQueries({ queryKey: ['admin', 'catalog-options'] });
      toast.success(draft.id ? 'Category saved' : 'Category created');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else toast.error(err instanceof ApiError ? err.message : 'Could not save the category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={draft.id ? `Edit ${draft.name}` : 'New category'}
      className="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{draft.id ? 'Save' : 'Create'}</Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <TextField label="Name" value={draft.name} error={errors.name?.[0]} onChange={(e) => set('name', e.target.value)} />
        <TextField label="URL slug" optional value={draft.slug} error={errors.slug?.[0]} hint="Leave blank to generate from the name." onChange={(e) => set('slug', e.target.value)} />
        <SelectField
          label="Parent"
          value={draft.parent_id ? String(draft.parent_id) : ''}
          error={errors.parent?.[0] ?? errors.detail?.[0]}
          options={[{ value: '', label: 'None (top level)' }, ...parentChoices.map((c) => ({ value: String(c.id), label: `${'— '.repeat(c.depth - 1)}${c.name}` }))]}
          onChange={(e) => set('parent_id', e.target.value ? Number(e.target.value) : null)}
        />
        <TextArea label="Description" optional rows={3} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox label="Active" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          <Checkbox label="Show in menu" checked={draft.show_in_menu} onChange={(e) => set('show_in_menu', e.target.checked)} />
        </div>
        <TextField label="Menu order" type="number" min={0} value={draft.position} onChange={(e) => set('position', Number(e.target.value))} hint="Lower numbers appear first." />

        <fieldset className="space-y-4 border-t border-line pt-5">
          <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Imagery</legend>
          <div className="grid grid-cols-2 gap-4">
            <ImageInput clearable label="Tile image" current={existing?.image} file={files.image} onChange={(f) => setFiles((x) => ({ ...x, image: f }))} aspect="aspect-[4/5]" />
            <ImageInput clearable label="Menu image" current={existing?.menu_image} file={files.menu_image} onChange={(f) => setFiles((x) => ({ ...x, menu_image: f }))} aspect="aspect-[4/5]" />
          </div>
          <ImageInput clearable label="Banner" current={existing?.banner_image} file={files.banner_image} onChange={(f) => setFiles((x) => ({ ...x, banner_image: f }))} aspect="aspect-[3/1]" hint="Wide image at the top of the category page, at least 2000px across." />
          <ImageInput clearable label="Banner on phones" current={existing?.banner_mobile_image} file={files.banner_mobile_image} onChange={(f) => setFiles((x) => ({ ...x, banner_mobile_image: f }))} aspect="aspect-[4/3]" hint="Optional. Falls back to the banner." />
          <TextField label="Banner headline" optional value={draft.banner_headline} onChange={(e) => set('banner_headline', e.target.value)} />
          <TextField label="Banner text" optional value={draft.banner_subtext} onChange={(e) => set('banner_subtext', e.target.value)} />
        </fieldset>

        <fieldset className="space-y-4 border-t border-line pt-5">
          <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Returns</legend>
          <SelectField
            label="Return policy"
            value={draft.return_policy}
            options={[{ value: 'returnable', label: 'Returnable' }, { value: 'replacement_only', label: 'Replacement only' }, { value: 'non_returnable', label: 'Non-returnable' }]}
            onChange={(e) => set('return_policy', e.target.value as Draft['return_policy'])}
          />
          <TextField label="Return window (days)" type="number" min={0} optional value={draft.return_window_days ?? ''} hint="Leave blank to use the store default." onChange={(e) => set('return_window_days', e.target.value === '' ? null : Number(e.target.value))} />
        </fieldset>

        <fieldset className="border-t border-line pt-5">
          <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Filters shown on this category</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(options?.attributes ?? []).map((a) => (
              <Checkbox
                key={a.id}
                label={a.name}
                checked={draft.filterable_attributes.includes(a.id)}
                onChange={(e) => set('filterable_attributes', e.target.checked ? [...draft.filterable_attributes, a.id] : draft.filterable_attributes.filter((x) => x !== a.id))}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">Price, brand, rating and availability are always available.</p>
        </fieldset>

        <fieldset className="space-y-4 border-t border-line pt-5">
          <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Search engines</legend>
          <TextField label="Meta title" optional maxLength={120} value={draft.seo_title} onChange={(e) => set('seo_title', e.target.value)} />
          <TextArea label="Meta description" optional rows={2} maxLength={300} value={draft.seo_description} onChange={(e) => set('seo_description', e.target.value)} />
        </fieldset>
      </div>
    </Drawer>
  );
}

function isDescendant(all: Category[], node: Category, ancestorId: number): boolean {
  let current: Category | undefined = node;
  while (current) {
    if (current.id === ancestorId) return true;
    current = all.find((c) => c.id === current!.parent_id);
  }
  return false;
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useAdminAll<Category>('categories');
  const [editing, setEditing] = useState<Category | Draft | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<Category | null>(null);

  const visible = useMemo(() => {
    if (!data) return [];
    const hidden = new Set<number>();
    return data.filter((c) => {
      if (c.parent_id && (hidden.has(c.parent_id) || collapsed.has(c.parent_id))) {
        hidden.add(c.id);
        return false;
      }
      return true;
    });
  }, [data, collapsed]);
  const hasChildren = useMemo(() => new Set((data ?? []).map((c) => c.parent_id).filter(Boolean) as number[]), [data]);

  const remove = async () => {
    if (!deleting) return;
    try {
      await adminApi.remove('categories', deleting.id);
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      qc.invalidateQueries({ queryKey: ['admin', 'catalog-options'] });
      toast.success('Category deleted');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the category.');
    }
    setDeleting(null);
  };

  return (
    <>
      <PageHeader title="Categories" eyebrow="Catalogue" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(blank(null))}>New category</Button>} />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="rounded-sm border border-line bg-surface-raised">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !data?.length ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <FolderTree className="h-8 w-8 text-ink-muted" aria-hidden="true" />
              <p className="text-sm text-ink-soft">No categories yet. Start with a department such as Electronics or Home.</p>
            </div>
          ) : (
            <ul role="tree" aria-label="Category tree">
              {visible.map((c) => (
                <li key={c.id} role="treeitem" aria-level={c.depth} aria-expanded={hasChildren.has(c.id) ? !collapsed.has(c.id) : undefined} aria-selected={false} className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5 last:border-0">
                  <span style={{ width: `${(c.depth - 1) * 1.5}rem` }} className="shrink-0" aria-hidden="true" />
                  {hasChildren.has(c.id) ? (
                    <button
                      type="button"
                      aria-label={collapsed.has(c.id) ? `Expand ${c.name}` : `Collapse ${c.name}`}
                      onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                      className="text-ink-muted hover:text-ink"
                    >
                      <ChevronRight className={cn('h-4 w-4 transition-transform', !collapsed.has(c.id) && 'rotate-90')} />
                    </button>
                  ) : (
                    <span className="w-4" aria-hidden="true" />
                  )}
                  <button type="button" onClick={() => setEditing(c)} className={cn('min-w-0 truncate text-left text-sm hover:text-accent', c.depth === 1 ? 'font-semibold text-ink' : 'text-ink-soft')}>
                    {c.name}
                  </button>
                  <span className="text-xs tabular-nums text-ink-muted">{c.product_count}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {!c.is_active ? <StatusBadge status="inactive" /> : null}
                    {c.return_policy !== 'returnable' ? <StatusBadge status="manual" label={c.return_policy === 'replacement_only' ? 'Replacement only' : 'No returns'} /> : null}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(blank(c.id))} aria-label={`Add a subcategory to ${c.name}`}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" disabled={c.product_count > 0} title={c.product_count > 0 ? 'Move its products first' : undefined} onClick={() => setDeleting(c)}>
                      Delete
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {editing ? <Editor key={'id' in editing ? editing.id : 'new'} category={editing} all={data ?? []} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.name}?`} danger confirmLabel="Delete" onConfirm={remove} onClose={() => setDeleting(null)}>
        Its subcategories are deleted too. This can't be undone.
      </ConfirmDialog>
    </>
  );
}
