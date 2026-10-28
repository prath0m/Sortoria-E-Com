import { activeFilterCount, clearFilters, listValues, setValue, toggleValue } from './filters';

describe('filter URL helpers', () => {
  it('toggles values in a comma list and resets the page', () => {
    let p = new URLSearchParams('page=3&brand=lumen');
    p = toggleValue(p, 'brand', 'aria-audio');
    expect(listValues(p, 'brand')).toEqual(['lumen', 'aria-audio']);
    expect(p.get('page')).toBeNull();
    p = toggleValue(p, 'brand', 'lumen');
    p = toggleValue(p, 'brand', 'aria-audio');
    expect(p.has('brand')).toBe(false);
  });

  it('sets and clears single values', () => {
    let p = setValue(new URLSearchParams(), 'price_max', 5000);
    expect(p.get('price_max')).toBe('5000');
    p = setValue(p, 'price_max', '');
    expect(p.has('price_max')).toBe(false);
  });

  it('keeps the page param when setting the page itself', () => {
    expect(setValue(new URLSearchParams('q=tee'), 'page', 2).toString()).toBe('q=tee&page=2');
  });

  it('clears filters but keeps search, sort and view', () => {
    const p = new URLSearchParams('q=shirt&sort=newest&view=list&brand=weave-co&attr.size=m,l&price_min=500&page=2');
    expect(clearFilters(p).toString()).toBe('q=shirt&sort=newest&view=list');
  });

  it('counts active filters, treating the price range as one', () => {
    const p = new URLSearchParams('brand=a,b&attr.colour=black&price_min=1&price_max=9&in_stock=1&sort=newest');
    expect(activeFilterCount(p)).toBe(5);
  });
});
