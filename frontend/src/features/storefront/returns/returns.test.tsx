import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useAuth } from '@/stores/auth';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { ReviewsSection } from '../product/ReviewsSection';
import NewReturnPage from './NewReturnPage';

const item = {
  order_item_id: 7,
  product_name: 'Linen Camp Shirt',
  variant_label: 'White / M',
  image_url: '',
  quantity: 2,
  returnable_quantity: 2,
  policy: 'returnable',
  window_days: 15,
  eligible: true,
  note: '',
};

describe('return request form', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/orders/SRT-1/returnable-items/', () =>
        HttpResponse.json({ order_number: 'SRT-1', payment_method: 'cod', items: [item] }),
      ),
    );
  });

  it('asks for photos when something arrived damaged, and for a UPI ID on cash orders', async () => {
    let sent: FormData | undefined;
    server.use(
      http.post('/api/v1/returns/', async ({ request }) => {
        sent = await request.formData();
        return HttpResponse.json({ number: 'RET-1', order_number: 'SRT-1' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<NewReturnPage />, { route: '/returns/new?order=SRT-1&token=t' });
    await user.click(await screen.findByRole('button', { name: 'Increase quantity' }));
    await user.click(screen.getByLabelText('Arrived damaged'));
    expect(screen.getByLabelText('UPI ID for your refund')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('add a photo');

    await user.click(screen.getByLabelText("Doesn't fit"));
    await user.type(screen.getByLabelText('UPI ID for your refund'), 'ada@okbank');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    await vi.waitFor(() => expect(sent).toBeDefined());
    expect(JSON.parse(String(sent!.get('items')))).toEqual([{ order_item_id: 7, quantity: 1 }]);
    expect(sent!.get('refund_upi_id')).toBe('ada@okbank');
    expect(sent!.get('token')).toBe('t');
  });

  it('explains when nothing is returnable', async () => {
    server.use(
      http.get('/api/v1/orders/SRT-1/returnable-items/', () =>
        HttpResponse.json({
          order_number: 'SRT-1',
          payment_method: 'razorpay',
          items: [{ ...item, eligible: false, note: 'The 15-day return window has closed.' }],
        }),
      ),
    );
    renderWithProviders(<NewReturnPage />, { route: '/returns/new?order=SRT-1' });
    expect(await screen.findByText('The 15-day return window has closed.')).toBeInTheDocument();
  });
});

describe('reviews', () => {
  const page = {
    count: 1, page: 1, page_size: 6, total_pages: 1, next: null, previous: null,
    results: [{ id: 1, rating: 5, title: 'Lovely', body: 'Really lovely piece, beautifully made.', author: 'Ada L.', is_verified_buyer: true, photos: [], admin_reply: '', created_at: '2026-10-01T10:00:00Z' }],
    summary: { average: 5, count: 1, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } },
    viewer: { status: null, verified_buyer: true },
  };

  it('shows verified badges and validates a new review before sending', async () => {
    act(() => useAuth.setState({ status: 'authenticated' }));
    let posted = false;
    server.use(
      http.get('/api/v1/products/shirt/reviews/', () => HttpResponse.json(page)),
      http.post('/api/v1/products/shirt/reviews/', () => {
        posted = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ReviewsSection slug="shirt" productName="Linen Shirt" />);
    expect(await screen.findByText('Verified buyer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Write a review' }));
    await user.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText('Please choose a rating.')).toBeInTheDocument();
    expect(posted).toBe(false);
    await user.click(screen.getByLabelText('4 stars: Very good'));
    await user.type(screen.getByLabelText('Title'), 'Very good');
    await user.type(screen.getByLabelText('Your review'), 'Soft, well cut, and true to size.');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));
    await vi.waitFor(() => expect(posted).toBe(true));
  });
});
