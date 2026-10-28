import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { Dashboard } from '@/api/hooks/admin';
import type { User } from '@/api/types';
import { useAuth } from '@/stores/auth';
import { settings } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import DashboardPage from './dashboard/DashboardPage';
import { RequireStaff } from './layout/RequireStaff';

const staff: User = {
  id: 1, email: 'asha@sartoria.test', first_name: 'Asha', last_name: 'Menon', full_name: 'Asha Menon', phone: '',
  role: 'manager', marketing_opt_in: false, date_joined: '', capabilities: ['dashboard.view', 'orders.view'],
};

const kpi = (value: number, change: number | null = null, previous: number | null = 0) => ({ value, change, previous });
const dashboard: Dashboard = {
  range: { label: '30d', start: '2026-09-29T00:00:00+05:30', end: '2026-10-29T00:00:00+05:30', granularity: 'day' },
  kpis: {
    revenue: kpi(1234500, 12.5, 1097300), orders: kpi(10, -10, 11), aov: kpi(123450, 25, 99000), customers: kpi(9, 0, 9),
    conversion: kpi(2.1, 5, 2), pending_orders: kpi(4, null, null), low_stock: kpi(3, null, null),
  },
  visits: 476,
  revenue_series: [{ bucket: '2026-10-28T00:00:00+05:30', revenue: 1234500, orders: 10 }],
  previous_revenue_series: [{ bucket: '2026-09-28T00:00:00+05:30', revenue: 1097300, orders: 11 }],
  orders_by_status: [{ label: 'Delivered', count: 10 }],
  top_products: [{ product_id: 1, name: 'Meridian 14 Laptop', revenue: 899000, units: 1 }],
  sales_by_category: [{ category: 'Electronics', revenue: 899000 }],
  customer_split: [{ bucket: '2026-10-28T00:00:00+05:30', new: 3, returning: 7 }],
  recent_orders: [],
  low_stock: [{ variant_id: 9, product_id: 2, product: 'Biker Leather Jacket', label: 'Black / XL', sku: 'BLJ', stock: 0, threshold: 5 }],
};

function Where() {
  const l = useLocation();
  return <p>At {l.pathname + l.search}</p>;
}

describe('admin', () => {
  it('sends anonymous visitors to the admin sign-in, keeping where they were going', async () => {
    act(() => useAuth.setState({ status: 'anonymous', user: null }));
    renderWithProviders(
      <Routes>
        <Route path="/admin-panel/orders" element={<RequireStaff><p>Orders</p></RequireStaff>} />
        <Route path="/admin-panel/login" element={<Where />} />
      </Routes>,
      { route: '/admin-panel/orders', path: '*' },
    );
    expect(await screen.findByText('At /admin-panel/login?next=%2Fadmin-panel%2Forders')).toBeInTheDocument();
  });

  it('turns customers away without showing admin data', async () => {
    act(() => useAuth.setState({ status: 'authenticated', user: { ...staff, role: 'customer', capabilities: [] } }));
    renderWithProviders(<RequireStaff><p>Secret</p></RequireStaff>);
    expect(screen.getByText('This area is for the Sartoria team')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('renders KPIs with direction in text and switches range through the URL', async () => {
    act(() => useAuth.setState({ status: 'authenticated', user: staff }));
    const ranges: string[] = [];
    server.use(
      http.get('/api/v1/store/settings/', () => HttpResponse.json(settings)),
      http.get('/api/v1/admin/analytics/dashboard/', ({ request }) => {
        ranges.push(new URL(request.url).searchParams.get('range') ?? '');
        return HttpResponse.json(dashboard);
      }),
    );
    renderWithProviders(<DashboardPage />, { route: '/admin-panel' });
    const revenue = (await screen.findByText('Revenue', { selector: 'p' })).parentElement!;
    expect(within(revenue).getByText('₹12,345')).toBeInTheDocument();
    expect(within(revenue).getByText(/\+12\.5%/)).toBeInTheDocument();
    expect(within(revenue).getByText('increase', { exact: false })).toBeInTheDocument();
    const orders = screen.getByText('Orders', { selector: 'p' }).parentElement!;
    expect(within(orders).getByText('decrease', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Biker Leather Jacket')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '12 months' }));
    await vi.waitFor(() => expect(ranges).toContain('12m'));
    expect(screen.getByRole('button', { name: '12 months' })).toHaveAttribute('aria-pressed', 'true');
  });
});
