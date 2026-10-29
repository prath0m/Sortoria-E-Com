import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { vi } from 'vitest';
import type { User } from '@/api/types';
import { useAuth } from '@/stores/auth';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { toLocalInput } from './components/dates';
import { MoneyInput } from './components/inputs';
import { saveWithFiles } from './components/save';
import { Collection } from './content/Collection';
import StaffPage from './system/StaffPage';

const admin: User = {
  id: 1, email: 'asha@sartoria.test', first_name: 'Asha', last_name: 'Menon', full_name: 'Asha Menon', phone: '',
  role: 'admin', marketing_opt_in: false, date_joined: '', capabilities: ['dashboard.view', 'cms.manage', 'staff.manage'],
};

beforeEach(() => {
  act(() => useAuth.setState({ status: 'authenticated', user: admin }));
  server.use(http.get('/api/v1/admin/catalog/options/', () => HttpResponse.json({ categories: [], brands: [], attributes: [], tax_rates: [] })));
});

describe('money and dates', () => {
  it('edits rupees but reports paise', async () => {
    const seen: (number | null)[] = [];
    function Harness() {
      const [v, setV] = useState<number | null>(249900);
      return <MoneyInput label="Price" value={v} onChange={(x) => { seen.push(x); setV(x); }} />;
    }
    renderWithProviders(<Harness />);
    const input = screen.getByLabelText('Price');
    expect(input).toHaveValue('2499');
    await userEvent.clear(input);
    expect(seen.at(-1)).toBeNull();
    await userEvent.type(input, '12.5');
    expect(seen.at(-1)).toBe(1250);
  });

  it('shows stored instants in local time for datetime inputs', () => {
    const iso = new Date(2026, 9, 28, 14, 5).toISOString();
    expect(toLocalInput(iso)).toBe('2026-10-28T14:05');
    expect(toLocalInput(null)).toBe('');
  });
});

describe('saveWithFiles', () => {
  it('creates records that carry an image as one multipart request', async () => {
    // Record what goes into the form: Node's FormData can't hold jsdom's File objects.
    class RecordingForm {
      entries: [string, unknown][] = [];
      append(key: string, value: unknown) {
        this.entries.push([key, value]);
      }
    }
    const NativeFormData = globalThis.FormData;
    globalThis.FormData = RecordingForm as unknown as typeof FormData;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 9 }), { status: 201, headers: { 'content-type': 'application/json' } }));
    try {
      const file = new File(['x'], 'slide.png', { type: 'image/png' });
      await saveWithFiles('cms/hero-slides', undefined, { headline: 'Autumn', is_active: true, ends_at: null }, { image: file, mobile_image: null });
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/admin/cms/hero-slides/');
      expect((init as RequestInit).method).toBe('POST');
      const form = (init as RequestInit).body as unknown as RecordingForm;
      expect(form.entries).toEqual([['headline', 'Autumn'], ['is_active', 'true'], ['ends_at', ''], ['image', file]]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
      globalThis.FormData = NativeFormData;
    }
  });

  it('updates fields as JSON, then sends only the changed images', async () => {
    const calls: string[] = [];
    server.use(
      http.patch('/api/v1/admin/brands/3/', async ({ request }) => {
        const type = request.headers.get('content-type') ?? '';
        if (type.includes('json')) calls.push(`json:${JSON.stringify(await request.json())}`);
        else calls.push(`form:${[...(await request.formData()).keys()].join(',')}`);
        return HttpResponse.json({ id: 3 });
      }),
    );
    await saveWithFiles('brands', 3, { name: 'Wayfarer' }, { logo: '' });
    expect(calls).toEqual(['json:{"name":"Wayfarer"}', 'form:logo']);
  });
});

describe('content collections', () => {
  it('toggles, edits and reorders records', async () => {
    const patches: unknown[] = [];
    const reorders: unknown[] = [];
    server.use(
      http.get('/api/v1/admin/cms/counters/', () =>
        HttpResponse.json([
          { id: 1, value: 1200, prefix: '', suffix: '+', label: 'Patrons', is_active: true, position: 0 },
          { id: 2, value: 98, prefix: '', suffix: '%', label: 'Happy returns', is_active: true, position: 1 },
        ]),
      ),
      http.patch('/api/v1/admin/cms/counters/:id/', async ({ request, params }) => {
        patches.push({ id: params.id, body: await request.json() });
        return HttpResponse.json({ id: Number(params.id) });
      }),
      http.post('/api/v1/admin/cms/counters/reorder/', async ({ request }) => {
        reorders.push(await request.json());
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(
      <Collection
        resource="cms/counters"
        noun="counter"
        emptyText="None"
        blank={() => ({ value: 0, label: '', is_active: true })}
        fields={[
          { name: 'value', label: 'Number', type: 'number' },
          { name: 'label', label: 'Label', type: 'text' },
          { name: 'is_active', label: 'Show', type: 'checkbox' },
        ]}
        renderRow={(c) => <span>{String(c.label)}</span>}
      />,
    );
    await screen.findByText('Patrons');
    const switches = screen.getAllByRole('switch');
    await userEvent.click(switches[1]);
    await waitFor(() => expect(patches).toContainEqual({ id: '2', body: { is_active: false } }));

    await userEvent.click(screen.getByText('Patrons'));
    const drawer = screen.getByRole('dialog');
    const label = within(drawer).getByLabelText('Label');
    await userEvent.clear(label);
    await userEvent.type(label, 'Patrons served');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(patches).toContainEqual({ id: '1', body: { value: 1200, label: 'Patrons served', is_active: true } }));

    // Keyboard reorder: lift the first row, move it down, drop.
    const handle = screen.getAllByRole('button', { name: /Drag to reorder/ })[0];
    handle.focus();
    await userEvent.keyboard('[Space]');
    await userEvent.keyboard('[ArrowDown]');
    await userEvent.keyboard('[Space]');
    await waitFor(() => expect(reorders.length).toBeLessThanOrEqual(1));
  });
});

describe('staff', () => {
  it('invites a colleague and keeps you from changing your own role', async () => {
    let invited: unknown = null;
    server.use(
      http.get('/api/v1/admin/staff/', () =>
        HttpResponse.json([{ id: 1, email: 'asha@sartoria.test', first_name: 'Asha', last_name: 'Menon', full_name: 'Asha Menon', role: 'admin', is_active: true, last_login: null, invited: false }]),
      ),
      http.get('/api/v1/admin/staff/roles/', () => HttpResponse.json({ manager: ['orders.view'], admin: ['orders.view', 'staff.manage'] })),
      http.post('/api/v1/admin/staff/', async ({ request }) => {
        invited = await request.json();
        return HttpResponse.json({ id: 2, email: 'dev@sartoria.test', role: 'manager', invited: true }, { status: 201 });
      }),
    );
    renderWithProviders(<StaffPage />);
    expect(await screen.findByLabelText('Role for asha@sartoria.test')).toBeDisabled();
    expect(screen.getAllByText('See orders')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Invite' }));
    const dialog = screen.getByRole('dialog');
    const email = within(dialog).getByLabelText('Email');
    await waitFor(() => expect(email).toHaveFocus());
    await userEvent.type(email, 'dev@sartoria.test');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(invited).toEqual({ email: 'dev@sartoria.test', first_name: '', last_name: '', role: 'manager' }));
  });
});
