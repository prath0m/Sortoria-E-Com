import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useAuth } from '@/stores/auth';
import { useGuestCart } from '@/stores/cart';
import { useCheckoutPrefs } from '@/stores/checkoutPrefs';
import { makeQuote, quoteLine, settings } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import CartPage from './CartPage';

const guestLine = {
  variantId: 11,
  productId: 1,
  slug: 'linen-shirt',
  name: 'Linen Camp Shirt',
  brand: 'Weave & Co',
  variantLabel: 'White / M',
  image: null,
  pricePaise: 349900,
  mrpPaise: 349900,
  maxQuantity: 5,
};

beforeEach(() => {
  act(() => {
    useAuth.setState({ status: 'anonymous', user: null });
    useGuestCart.setState({ lines: [] });
    useCheckoutPrefs.setState({ pincode: '', shippingMethod: 'standard', guestCoupon: '' });
  });
  server.use(http.get('/api/v1/store/settings/', () => HttpResponse.json(settings)));
});

describe('cart page (guest)', () => {
  it('shows the designed empty state', async () => {
    renderWithProviders(<CartPage />);
    expect(await screen.findByText('Your bag is waiting to be filled')).toBeInTheDocument();
  });

  it('prices the guest bag on the server and never shows client prices as totals', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/v1/cart/quote/', async ({ request }) => {
        const body = (await request.json()) as { lines: { quantity: number }[] };
        bodies.push(body);
        const qty = body.lines[0].quantity;
        return HttpResponse.json(makeQuote([quoteLine({ quantity: qty, line_total_paise: 349900 * qty })]));
      }),
    );
    act(() => useGuestCart.getState().add(guestLine, 1));
    renderWithProviders(<CartPage />);

    expect(await screen.findByText('Linen Camp Shirt')).toBeInTheDocument();
    expect(screen.getAllByText('₹3,499').length).toBeGreaterThan(0);
    expect(bodies[0]).toMatchObject({ lines: [{ variant_id: 11, quantity: 1 }] });
    expect(JSON.stringify(bodies[0])).not.toContain('price');

    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await waitFor(() => expect(screen.getAllByText('₹6,998').length).toBeGreaterThan(0));
    expect(useGuestCart.getState().lines[0].quantity).toBe(2);
  });

  it('moves a line to saved for later and back', async () => {
    server.use(
      http.post('/api/v1/cart/quote/', async ({ request }) => {
        const body = (await request.json()) as { lines: unknown[] };
        return HttpResponse.json(makeQuote(body.lines.length ? [quoteLine()] : []));
      }),
    );
    act(() => useGuestCart.getState().add(guestLine, 1));
    renderWithProviders(<CartPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Save for later' }));
    expect(await screen.findByText(/Saved for later \(1\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Move to bag' }));
    await waitFor(() => expect(useGuestCart.getState().lines[0].savedForLater).toBe(false));
  });

  it('shows why a coupon was rejected', async () => {
    server.use(
      http.post('/api/v1/cart/quote/', async ({ request }) => {
        const body = (await request.json()) as { coupon_code?: string };
        return HttpResponse.json(
          makeQuote([quoteLine()], {
            coupon: body.coupon_code
              ? { code: body.coupon_code, applied: false, discount_paise: 0, message: 'FESTIVE15 applies to orders of ₹2,999 or more.' }
              : null,
          }),
        );
      }),
    );
    act(() => useGuestCart.getState().add(guestLine, 1));
    renderWithProviders(<CartPage />);
    await userEvent.type(await screen.findByLabelText('Gift or promo code'), 'festive15');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('applies to orders of ₹2,999 or more');
    expect(useCheckoutPrefs.getState().guestCoupon).toBe('');
  });
});

describe('session sync', () => {
  it('merges the guest bag and wishlist into the account on sign-in', async () => {
    const { installSessionSync } = await import('@/app/sessionSync');
    const { QueryClient } = await import('@tanstack/react-query');
    const merged: unknown[] = [];
    server.use(
      http.post('/api/v1/cart/merge/', async ({ request }) => {
        merged.push(await request.json());
        return HttpResponse.json(makeQuote([]));
      }),
      http.post('/api/v1/wishlist/merge/', () => HttpResponse.json({ product_ids: [7], products: [] })),
    );
    const { useGuestWishlist } = await import('@/stores/wishlist');
    act(() => {
      useGuestCart.getState().add(guestLine, 2);
      useGuestWishlist.setState({ ids: [7] });
    });
    const off = installSessionSync(new QueryClient());
    act(() =>
      useAuth.getState().setSession({
        access: 'token',
        user: { id: 1, email: 'ada@example.com', first_name: 'Ada', last_name: '', full_name: 'Ada', phone: '', role: 'customer', marketing_opt_in: false, date_joined: '', capabilities: [] },
      }),
    );
    await waitFor(() => expect(useGuestCart.getState().lines).toHaveLength(0));
    expect(merged[0]).toEqual({ lines: [{ variant_id: 11, quantity: 2, saved_for_later: false }] });
    expect(useGuestWishlist.getState().ids).toEqual([]);
    off();
  });
});
