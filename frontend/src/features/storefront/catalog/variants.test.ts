import type { Axis, Variant } from '@/api/types';
import { findVariant, initialSelection, selectValue, valueState } from './variants';

const axes: Axis[] = [
  { slug: 'colour', name: 'Colour', kind: 'swatch', values: [] },
  { slug: 'storage', name: 'Storage', kind: 'numeric', values: [] },
];

const v = (id: number, colour: string, storage: string, stock: number): Variant => ({
  id,
  sku: `SKU${id}`,
  label: `${colour} / ${storage}`,
  options: { colour, storage },
  price_paise: 1000,
  mrp_paise: 1000,
  stock,
  is_low_stock: false,
});

const variants = [v(1, 'black', '128', 0), v(2, 'black', '256', 4), v(3, 'white', '128', 2)];

describe('variant selection', () => {
  it('opens on the first in-stock variant', () => {
    expect(initialSelection(variants)).toEqual({ colour: 'black', storage: '256' });
  });

  it('finds the exact variant', () => {
    expect(findVariant(variants, axes, { colour: 'white', storage: '128' })?.id).toBe(3);
  });

  it('reports value availability relative to the other choices', () => {
    const sel = { colour: 'black', storage: '256' };
    expect(valueState(variants, axes, sel, 'storage', '128')).toBe('out_of_stock');
    expect(valueState(variants, axes, sel, 'colour', 'white')).toBe('unavailable');
    expect(valueState(variants, axes, { colour: 'white', storage: '128' }, 'colour', 'black')).toBe('out_of_stock');
  });

  it('re-picks other options when a combination does not exist', () => {
    expect(selectValue(variants, axes, { colour: 'black', storage: '256' }, 'colour', 'white')).toEqual({
      colour: 'white',
      storage: '128',
    });
  });
});
