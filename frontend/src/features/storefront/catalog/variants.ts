import type { Axis, ProductImage, Variant } from '@/api/types';

export type Selection = Record<string, string>;

/** Start from the first in-stock variant (or the first variant) so the page opens on something buyable. */
export function initialSelection(variants: Variant[]): Selection {
  const start = variants.find((v) => v.stock > 0) ?? variants[0];
  return start ? { ...start.options } : {};
}

export function findVariant(variants: Variant[], axes: Axis[], selection: Selection): Variant | undefined {
  return variants.find((v) => axes.every((axis) => v.options[axis.slug] === selection[axis.slug]));
}

export type ValueState = 'available' | 'out_of_stock' | 'unavailable';

/**
 * State of one option value given the other current choices:
 * - available: a variant with this value + the other selections exists and has stock
 * - out_of_stock: that combination exists but is sold out
 * - unavailable: no such combination (selecting it will re-pick the other options)
 */
export function valueState(variants: Variant[], axes: Axis[], selection: Selection, axisSlug: string, value: string): ValueState {
  const candidate = { ...selection, [axisSlug]: value };
  const exact = findVariant(variants, axes, candidate);
  if (exact) return exact.stock > 0 ? 'available' : 'out_of_stock';
  return 'unavailable';
}

/** Choose a value; if the resulting combination doesn't exist, fall back to the closest real variant. */
export function selectValue(variants: Variant[], axes: Axis[], selection: Selection, axisSlug: string, value: string): Selection {
  const candidate = { ...selection, [axisSlug]: value };
  if (findVariant(variants, axes, candidate)) return candidate;
  const withValue = variants.filter((v) => v.options[axisSlug] === value);
  const best =
    withValue.find((v) => v.stock > 0 && axes.every((a) => a.slug === axisSlug || v.options[a.slug] === selection[a.slug])) ??
    withValue.find((v) => v.stock > 0) ??
    withValue[0];
  return best ? { ...best.options } : candidate;
}

/** Images for the chosen colour (or finish) first, then general shots; other colours' photos are hidden. */
export function imagesForSelection(images: ProductImage[], selection: Selection): ProductImage[] {
  const chosen = new Set(Object.values(selection));
  const matching = images.filter((img) => img.option_value && chosen.has(img.option_value));
  const general = images.filter((img) => !img.option_value);
  const result = [...matching, ...general];
  return result.length ? result : images;
}
