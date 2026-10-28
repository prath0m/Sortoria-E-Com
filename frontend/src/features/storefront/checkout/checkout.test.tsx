import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { OrderDetail } from '@/api/types';
import { useAuth } from '@/stores/auth';
import { useGuestCart } from '@/stores/cart';
import { useCheckoutPrefs } from '@/stores/checkoutPrefs';
import { makeQuote, quoteLine, settings } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import CheckoutPage from './CheckoutPage';

function Landing() {
  const location = useLocation();
  return <p>Landed on {location.pathname + location.search}</p>;
}

function App() {
  return (
    <Routes>
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/order/:number" element={<Landing />} />
      <Route path="/cart" element={<p>Cart page</p>} />
    </Routes>
  );
}

const line = {
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
    useGuestCart.getState().add(line, 1);
  });
  server.use(
    http.get('/api/v1/store/settings/', () => HttpResponse.json({ ...settings, cod_fee_paise: 4900 })),
    http.get('/api/v1/checkout/config/', () =>
      HttpResponse.json({ payment_methods: [{ code: 'cod', name: 'Cash on delivery', prepaid: false }] }),
    ),
    http.post('/api/v1/cart/quote/', async ({ request }) => {
      const body = (await request.json()) as { payment_method?: string };
      const cod = body.payment_method === 'cod' ? 4900 : 0;
      return HttpResponse.json(makeQuote([quoteLine()], { cod_fee_paise: cod, total_paise: 349900 + cod }));
    }),
  );
});

async function fillDetails() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
  await user.type(screen.getAllByLabelText('Mobile number')[0], '9876543210');
  await user.type(screen.getByLabelText('Full name'), 'Ada Lovelace');
  await user.type(screen.getAllByLabelText('Mobile number')[1], '9876543210');
  await user.type(screen.getByLabelText('House, flat and street'), '22 Residency Road');
  await user.type(screen.getByLabelText('Pincode'), '560025');
  await user.type(screen.getByLabelText('City'), 'Bengaluru');
  await user.selectOptions(screen.getByLabelText('State'), 'Karnataka');
  await user.click(screen.getByRole('button', { name: 'Use this address' }));
  await user.click(await screen.findByRole('button', { name: 'Continue to delivery' }));
  await user.click(await screen.findByRole('button', { name: 'Continue to payment' }));
  return user;
}

describe('guest checkout', () => {
  it('validates contact details before moving on', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/checkout' });
    await user.click(await screen.findByRole('button', { name: 'Use this address' }));
    expect(await screen.findByText('Please enter the full name.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to delivery' })).toBeDisabled();
  });

  it('places a cash-on-delivery order with ids and quantities only', async () => {
    let placed: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/v1/checkout/', async ({ request }) => {
        placed = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { order: { number: 'SRT-2026-001042', access_token: 'tok', status: 'placed' } as OrderDetail, payment: null },
          { status: 201 },
        );
      }),
    );
    renderWithProviders(<App />, { route: '/checkout' });
    const user = await fillDetails();
    await user.click(await screen.findByRole('button', { name: /Place order ₹3,548/ }));

    expect(await screen.findByText('Landed on /order/SRT-2026-001042?token=tok&placed=1')).toBeInTheDocument();
    expect(placed).toMatchObject({
      email: 'ada@example.com',
      payment_method: 'cod',
      expected_total_paise: 354800,
      lines: [{ variant_id: 11, quantity: 1 }],
      shipping_address: { pincode: '560025', state: 'Karnataka' },
    });
    expect(JSON.stringify(placed?.lines)).not.toContain('price');
    expect(useGuestCart.getState().lines).toHaveLength(0);
  });

  it('sends the shopper back to the bag when stock changed', async () => {
    server.use(
      http.post('/api/v1/checkout/', () =>
        HttpResponse.json(
          { detail: 'Some pieces in your bag have changed.', code: 'stock_changed', lines: [] },
          { status: 409 },
        ),
      ),
    );
    renderWithProviders(<App />, { route: '/checkout' });
    const user = await fillDetails();
    await user.click(await screen.findByRole('button', { name: /Place order/ }));
    await waitFor(() => expect(screen.getByText('Cart page')).toBeInTheDocument());
    expect(useGuestCart.getState().lines).toHaveLength(1);
  });
});
