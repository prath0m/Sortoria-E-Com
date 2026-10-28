import { act } from '@testing-library/react';
import { itemCount, useGuestCart, type CartLine } from './cart';

const line = (variantId: number, max = 5): Omit<CartLine, 'quantity' | 'savedForLater'> => ({
  variantId,
  productId: 1,
  slug: 'linen-shirt',
  name: 'Linen Shirt',
  brand: 'Weave & Co',
  variantLabel: 'White / M',
  image: null,
  pricePaise: 349900,
  mrpPaise: 349900,
  maxQuantity: max,
});

beforeEach(() => act(() => useGuestCart.setState({ lines: [] })));

describe('guest cart', () => {
  it('adds new lines and merges repeat adds', () => {
    act(() => {
      useGuestCart.getState().add(line(1), 2);
      useGuestCart.getState().add(line(1), 1);
      useGuestCart.getState().add(line(2));
    });
    const { lines } = useGuestCart.getState();
    expect(lines).toHaveLength(2);
    expect(lines[0].quantity).toBe(3);
    expect(itemCount(lines)).toBe(4);
  });

  it('caps quantity at available stock and never drops below one', () => {
    act(() => {
      useGuestCart.getState().add(line(1, 3), 9);
    });
    expect(useGuestCart.getState().lines[0].quantity).toBe(3);
    act(() => useGuestCart.getState().setQuantity(1, 0));
    expect(useGuestCart.getState().lines[0].quantity).toBe(1);
  });

  it('excludes saved-for-later lines from the count and restores them on re-add', () => {
    act(() => {
      useGuestCart.getState().add(line(1), 2);
      useGuestCart.getState().setSaved(1, true);
    });
    expect(itemCount(useGuestCart.getState().lines)).toBe(0);
    act(() => useGuestCart.getState().add(line(1)));
    expect(useGuestCart.getState().lines[0].savedForLater).toBe(false);
  });

  it('persists to localStorage', () => {
    act(() => useGuestCart.getState().add(line(7)));
    expect(localStorage.getItem('sartoria-cart')).toContain('"variantId":7');
  });
});
