import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { settings } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import HomePage from './HomePage';

const base = { eyebrow: '', subtitle: '', body: '', image: null, cta_label: '', cta_url: '' };

describe('homepage', () => {
  it('renders admin-ordered sections and subscribes to the newsletter', async () => {
    let subscribed: unknown;
    server.use(
      http.get('/api/v1/store/settings/', () => HttpResponse.json(settings)),
      http.get('/api/v1/home/', () =>
        HttpResponse.json({
          sections: [
            {
              ...base, id: 1, type: 'hero', title: '',
              data: [{ id: 1, eyebrow: 'The Autumn Edit', headline: 'Rooms that feel like you', subtext: '', image: '/h.jpg', mobile_image: null, image_alt: '', cta_label: 'Shop home', cta_url: '/shop', secondary_cta_label: '', secondary_cta_url: '', text_theme: 'dark', text_align: 'left' }],
            },
            { ...base, id: 2, type: 'trust_badges', title: '', data: [{ icon: 'truck', title: 'Complimentary shipping', text: '' }] },
            { ...base, id: 3, type: 'newsletter', title: 'Considered news', data: {} },
          ],
        }),
      ),
      http.post('/api/v1/newsletter/subscribe/', async ({ request }) => {
        subscribed = await request.json();
        return HttpResponse.json({ detail: 'Almost there: please confirm your subscription.' }, { status: 202 });
      }),
    );
    renderWithProviders(<HomePage />);
    const headline = await screen.findByRole('heading', { level: 1 });
    expect(headline).toHaveTextContent('Rooms that feel like you');
    const order = [
      headline,
      screen.getByText('Complimentary shipping'),
      screen.getByRole('heading', { level: 2, name: 'Considered news' }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Almost there');
    expect(subscribed).toEqual({ email: 'ada@example.com', source: 'homepage' });
  });
});
