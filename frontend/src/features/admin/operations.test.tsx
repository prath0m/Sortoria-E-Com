import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { User } from '@/api/types';
import { useAuth } from '@/stores/auth';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import InventoryPage from './catalog/InventoryPage';
import { flattenErrors } from './components/errors';
import { RequireCapability } from './layout/RequireCapability';
import OrderDetailPage from './orders/OrderDetailPage';
import type { AdminOrder } from './orders/types';
import ProductsPage from './products/ProductsPage';
import type { AdminVariant, CatalogOptions } from './products/types';
import { VariantMatrix } from './products/VariantMatrix';

const manager: User = {
  id: 1, email: 'asha@sartoria.test', first_name: 'Asha', last_name: 'Menon', full_name: 'Asha Menon', phone: '',
  role: 'manager', marketing_opt_in: false, date_joined: '',
  capabilities: ['dashboard.view', 'orders.view', 'orders.manage', 'catalog.edit', 'inventory.manage'],
};

const options: CatalogOptions = {
  categories: [{ id: 1, name: 'Fashion', depth: 1, is_leaf: false }, { id: 2, name: 'Shirts', depth: 2, is_leaf: true }],
  brands: [{ id: 1, name: 'Wayfarer' }],
  attributes: [
    { id: 1, name: 'Size', slug: 'size', kind: 'text', is_variant_axis: true, values: [{ id: 11, value: 'M', hex: '' }, { id: 12, value: 'L', hex: '' }] },
    { id: 2, name: 'Colour', slug: 'colour', kind: 'swatch', is_variant_axis: true, values: [{ id: 21, value: 'Navy', hex: '#1F2A44' }, { id: 22, value: 'White', hex: '#FFFFFF' }] },
  ],
  tax_rates: [0, 5, 18],
};

const page = <T,>(results: T[]) => ({ count: results.length, page: 1, page_size: 25, total_pages: 1, next: null, previous: null, results });

beforeEach(() => {
  act(() => useAuth.setState({ status: 'authenticated', user: manager }));
});

describe('variant builder', () => {
  function Harness({ initial }: { initial: AdminVariant[] }) {
    const [variants, setVariants] = useState(initial);
    return <VariantMatrix variants={variants} onChange={setVariants} options={options} skuBase="LINEN" />;
  }

  it('generates every combination and keeps rows that already exist', async () => {
    const existing: AdminVariant = { id: 7, sku: 'KEEP-ME', option_values: [11, 21], price_paise: 249000, compare_at_paise: null, stock: 5, low_stock_threshold: null, weight_g: 400, is_active: true };
    renderWithProviders(<Harness initial={[existing]} />);
    // Size and Colour are pre-selected from the existing variant; add L and White.
    await userEvent.click(screen.getByRole('button', { name: 'L' }));
    await userEvent.click(screen.getByRole('button', { name: 'White' }));
    await userEvent.click(screen.getByRole('button', { name: /Generate 4 variants/ }));

    const skus = screen.getAllByLabelText(/^SKU for row/).map((el) => (el as HTMLInputElement).value);
    expect(skus).toHaveLength(4);
    expect(skus).toContain('KEEP-ME');
    expect(skus).toContain('LINEN-L-WHITE');
    // New rows inherit the price of the first variant.
    const prices = screen.getAllByLabelText(/^Price for row/).map((el) => (el as HTMLInputElement).value);
    expect(new Set(prices)).toEqual(new Set(['2490']));
    expect(screen.getByLabelText('Stock for row 1')).toHaveValue(5);
  });
});

describe('products list', () => {
  it('sends the selected ids with a bulk action', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.get('/api/v1/admin/catalog/options/', () => HttpResponse.json(options)),
      http.get('/api/v1/admin/products/', () =>
        HttpResponse.json(page([
          { id: 4, name: 'Linen Shirt', slug: 'linen-shirt', brand: 'Wayfarer', category: 'Shirts', thumb: null, min_price_paise: 249000, max_price_paise: 249000, total_stock: 3, in_stock: true, is_active: true, is_featured: false, variant_count: 2, sales_count: 0, updated_at: '2026-10-28T10:00:00Z' },
        ])),
      ),
      http.post('/api/v1/admin/products/bulk/', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ updated: 1 });
      }),
    );
    renderWithProviders(<ProductsPage />, { route: '/admin-panel/products' });
    const row = (await screen.findByText('Linen Shirt')).closest('tr')!;
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Select row' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Feature' }));
    await waitFor(() => expect(bodies).toEqual([{ ids: [4], action: 'feature' }]));
    // Managers can't delete products, so the option isn't offered.
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});

describe('inventory', () => {
  it('saves only the rows that changed, with the note', async () => {
    let posted: unknown = null;
    server.use(
      http.get('/api/v1/admin/inventory/', () =>
        HttpResponse.json(page([
          { id: 1, sku: 'A-1', product_id: 4, product: 'Linen Shirt', label: 'M / Navy', stock: 3, threshold: 5, low_stock_threshold: null, price_paise: 249000, is_active: true, status: 'low' },
          { id: 2, sku: 'A-2', product_id: 4, product: 'Linen Shirt', label: 'L / Navy', stock: 9, threshold: 5, low_stock_threshold: null, price_paise: 249000, is_active: true, status: 'ok' },
        ])),
      ),
      http.post('/api/v1/admin/inventory/bulk/', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ updated: 1 });
      }),
    );
    renderWithProviders(<InventoryPage />, { route: '/admin-panel/inventory' });
    const input = await screen.findByLabelText('Stock for A-1');
    await userEvent.clear(input);
    await userEvent.type(input, '20');
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Note for this adjustment'), 'Cycle count');
    await userEvent.click(screen.getByRole('button', { name: 'Save stock' }));
    await waitFor(() => expect(posted).toEqual({ rows: [{ variant_id: 1, stock: 20 }], note: 'Cycle count' }));
  });
});

describe('order detail', () => {
  const order = {
    number: 'SRT-2026-000001', status: 'packed', status_label: 'Packed', payment_status: 'paid', payment_method: 'razorpay',
    grand_total_paise: 249000, placed_at: '2026-10-27T10:00:00Z', created_at: '2026-10-27T10:00:00Z', item_count: 1, preview_images: [],
    email: 'meera@example.in', phone: '9876543210',
    shipping_address: { full_name: 'Meera Iyer', phone: '9876543210', line1: '12 Lake Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
    billing_address: { full_name: 'Meera Iyer', phone: '9876543210', line1: '12 Lake Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
    shipping_method: 'Standard', coupon_code: '', subtotal_paise: 249000, item_discount_paise: 0, bundle_discount_paise: 0, coupon_discount_paise: 0,
    shipping_fee_paise: 0, cod_fee_paise: 0, tax_total_paise: 37983, cgst_paise: 0, sgst_paise: 0, igst_paise: 37983,
    courier_name: '', tracking_number: '', tracking_url: '', estimated_delivery_date: null, delivered_at: null, cancelled_at: null, cancel_reason: '', customer_note: '',
    items: [{ id: 1, product_name: 'Linen Shirt', product_slug: 'linen-shirt', variant_label: 'M / Navy', sku: 'A-1', image_url: '', mrp_paise: 249000, unit_price_paise: 249000, quantity: 1, line_discount_paise: 0, tax_rate: 18, tax_paise: 37983, line_total_paise: 249000, returned_quantity: 0 }],
    events: [{ to_status: 'placed', label: 'Placed', note: '', created_at: '2026-10-27T10:00:00Z' }],
    can_cancel: false, can_retry_payment: false, has_invoice: true, access_token: '',
    internal_note: '', invoice_number: 'SRT/INV/2026-27/00001',
    allowed_transitions: [{ status: 'shipped', label: 'Shipped' }, { status: 'cancelled', label: 'Cancelled' }],
    payments: [], returns: [], customer_id: null, customer_order_count: 1, reservation_expires_at: null,
  } as unknown as AdminOrder;

  it('asks for tracking before marking an order shipped', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/v1/admin/orders/SRT-2026-000001/', () => HttpResponse.json(order)),
      http.post('/api/v1/admin/orders/SRT-2026-000001/transition/', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...order, status: 'shipped', status_label: 'Shipped', allowed_transitions: [] });
      }),
    );
    renderWithProviders(<OrderDetailPage />, { route: '/admin-panel/orders/SRT-2026-000001', path: '/admin-panel/orders/:number' });
    await userEvent.click(await screen.findByRole('button', { name: 'Mark shipped' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(posted).toBeNull();

    await userEvent.type(within(dialog).getByLabelText('Courier'), 'Delhivery');
    await userEvent.type(within(dialog).getByLabelText('Tracking number'), 'DL123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(posted).toMatchObject({ status: 'shipped', courier_name: 'Delhivery', tracking_number: 'DL123' }));
    expect(await screen.findByText('Shipped', { selector: 'span' })).toBeInTheDocument();
  });

  it('hides status actions from staff who can only view orders', async () => {
    act(() => useAuth.setState({ status: 'authenticated', user: { ...manager, capabilities: ['dashboard.view', 'orders.view'] } }));
    server.use(http.get('/api/v1/admin/orders/SRT-2026-000001/', () => HttpResponse.json(order)));
    renderWithProviders(<OrderDetailPage />, { route: '/admin-panel/orders/SRT-2026-000001', path: '/admin-panel/orders/:number' });
    expect(await screen.findByText('Linen Shirt')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark shipped' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });
});

describe('admin guards and helpers', () => {
  it('blocks screens outside the role', () => {
    renderWithProviders(<RequireCapability capability="customers.manage"><p>Secret</p></RequireCapability>);
    expect(screen.getByText('Not part of your role')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('flattens nested validation errors into readable lines', () => {
    expect(flattenErrors([{}, { sku: ['Already used.'] }], 'Row')).toEqual(['Row 2 sku: Already used.']);
    expect(flattenErrors({ detail: 'Nope', code: 'x' })).toEqual(['Nope']);
  });
});
