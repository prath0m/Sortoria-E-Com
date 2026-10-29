import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboard, type Dashboard, type Kpi, type RangeQuery } from '@/api/hooks/admin';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatCompactMoney, formatMoney } from '@/lib/money';
import { useAuth } from '@/stores/auth';
import { axisProps, bucketLabel, ChartTooltip, LegendItem, Panel, SERIES } from './charts';
import { RangePicker } from './RangePicker';

const RANGE_WORDS: Record<string, string> = {
  today: 'yesterday',
  '7d': 'the previous 7 days',
  '30d': 'the previous 30 days',
  '12m': 'the previous 12 months',
  custom: 'the previous period',
};

function Change({ kpi, invert }: { kpi: Kpi; invert?: boolean }) {
  if (kpi.change === null) return <span className="text-xs text-ink-muted">No earlier data</span>;
  const up = kpi.change > 0;
  const flat = kpi.change === 0;
  const good = flat ? null : invert ? !up : up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', good === null ? 'text-ink-muted' : good ? 'text-success' : 'text-danger')}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {up ? '+' : ''}
      {kpi.change}%<span className="sr-only">{up ? ' increase' : flat ? '' : ' decrease'}</span>
    </span>
  );
}

function Sparkline({ data, dataKey }: { data: Dashboard['revenue_series']; dataKey: 'revenue' | 'orders' }) {
  return (
    <div className="h-10" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} accessibilityLayer={false}>
          <Area type="monotone" dataKey={dataKey} stroke="var(--chart-1)" strokeWidth={2} fill="var(--chart-1)" fillOpacity={0.08} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({ label, value, kpi, compare, spark, href, invert, warn }: { label: string; value: string; kpi: Kpi; compare?: string; spark?: React.ReactNode; href?: string; invert?: boolean; warn?: boolean }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className={cn('mt-2 font-sans text-2xl font-semibold tabular-nums', warn ? 'text-danger' : 'text-ink')}>{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {kpi.previous === null ? (
          <span className="text-xs text-ink-muted">Right now</span>
        ) : (
          <>
            <Change kpi={kpi} invert={invert} />
            <span className="text-xs text-ink-muted">vs {compare}</span>
          </>
        )}
      </div>
      {spark ? <div className="mt-3">{spark}</div> : null}
    </>
  );
  return href ? (
    <Link to={href} className="block rounded-sm border border-line bg-surface-raised p-4 transition-shadow hover:shadow-soft">
      {body}
    </Link>
  ) : (
    <div className="rounded-sm border border-line bg-surface-raised p-4">{body}</div>
  );
}

function RevenueChart({ data }: { data: Dashboard }) {
  const g = data.range.granularity;
  const rows = data.revenue_series.map((point, i) => ({
    ...point,
    previous: data.previous_revenue_series[i]?.revenue ?? 0,
    label: bucketLabel(point.bucket, g),
    long: bucketLabel(point.bucket, g, true),
  }));
  const interval = rows.length > 14 ? Math.ceil(rows.length / 8) - 1 : 0;
  return (
    <Panel
      title="Revenue"
      subtitle={`${formatMoney(data.kpis.revenue.value)} across ${data.kpis.orders.value} orders`}
      action={
        <div className="flex flex-wrap gap-4">
          <LegendItem color="var(--chart-1)" label="This period" />
          <LegendItem color="var(--chart-muted)" label="Previous period" dashed />
        </div>
      }
      className="xl:col-span-2"
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axisProps} interval={interval} />
            <YAxis {...axisProps} width={56} tickFormatter={(v: number) => formatCompactMoney(v)} />
            <Tooltip
              cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    title={String(payload[0].payload.long)}
                    rows={[
                      { label: 'This period', value: formatMoney(payload[0].payload.revenue), color: 'var(--chart-1)' },
                      { label: 'Orders', value: String(payload[0].payload.orders) },
                      { label: 'Previous period', value: formatMoney(payload[0].payload.previous), color: 'var(--chart-muted)' },
                    ]}
                  />
                ) : null
              }
            />
            <Line type="monotone" dataKey="previous" stroke="var(--chart-muted)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#revFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface-raised))' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function StatusBreakdown({ rows }: { rows: Dashboard['orders_by_status'] }) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <Panel title="Orders by status" subtitle={`${total} orders created in this period`}>
      {total ? (
        <>
          <div className="flex h-3 gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={rows.map((r) => `${r.label}: ${r.count}`).join(', ')}>
            {rows.map((r, i) =>
              r.count ? (
                <div
                  key={r.label}
                  className={cn('h-full transition-opacity', hover !== null && hover !== i && 'opacity-40')}
                  style={{ width: `${(r.count / total) * 100}%`, background: SERIES[i] }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-5 space-y-2.5">
            {rows.map((r, i) => (
              <li key={r.label} className="flex items-center justify-between text-sm" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <LegendItem color={SERIES[i]} label={r.label} />
                <span className="tabular-nums text-ink">
                  {r.count} <span className="text-xs text-ink-muted">({total ? Math.round((r.count / total) * 100) : 0}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-ink-muted">No orders in this period.</p>
      )}
    </Panel>
  );
}

function RankedBars({ title, subtitle, rows }: { title: string; subtitle: string; rows: { key: string | number; label: string; value: number; detail?: string; href?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Panel title={title} subtitle={subtitle}>
      {rows.length ? (
        <ol className="space-y-3">
          {rows.map((r) => (
            <li key={r.key} className="group" title={r.detail}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                {r.href ? (
                  <Link to={r.href} className="truncate text-ink-soft hover:text-ink">
                    {r.label}
                  </Link>
                ) : (
                  <span className="truncate text-ink-soft">{r.label}</span>
                )}
                <span className="shrink-0 tabular-nums font-medium text-ink">
                  {formatCompactMoney(r.value)}
                  {r.detail ? <span className="ml-1.5 text-xs font-normal text-ink-muted">{r.detail}</span> : null}
                </span>
              </div>
              <div className="h-2 rounded-[4px] bg-ink/5">
                <div className="h-full rounded-[4px] bg-[var(--chart-1)] transition-[width] duration-700 ease-luxe group-hover:opacity-80" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-8 text-center text-sm text-ink-muted">No sales in this period.</p>
      )}
    </Panel>
  );
}

function CustomerSplit({ data }: { data: Dashboard }) {
  const g = data.range.granularity;
  const rows = data.customer_split.map((r) => ({ ...r, label: bucketLabel(r.bucket, g), long: bucketLabel(r.bucket, g, true) }));
  const totals = rows.reduce((t, r) => ({ new: t.new + r.new, returning: t.returning + r.returning }), { new: 0, returning: 0 });
  const interval = rows.length > 14 ? Math.ceil(rows.length / 8) - 1 : 0;
  return (
    <Panel
      title="New vs returning customers"
      subtitle={`${totals.new} first orders · ${totals.returning} repeat orders`}
      action={
        <div className="flex gap-4">
          <LegendItem color={SERIES[0]} label="New" />
          <LegendItem color={SERIES[1]} label="Returning" />
        </div>
      }
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axisProps} interval={interval} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgb(var(--ink) / 0.04)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    title={String(payload[0].payload.long)}
                    rows={[
                      { label: 'New', value: String(payload[0].payload.new), color: SERIES[0] },
                      { label: 'Returning', value: String(payload[0].payload.returning), color: SERIES[1] },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="new" stackId="c" fill={SERIES[0]} stroke="rgb(var(--surface-raised))" strokeWidth={1} />
            <Bar dataKey="returning" stackId="c" fill={SERIES[1]} radius={[4, 4, 0, 0]} stroke="rgb(var(--surface-raised))" strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

const statusTone = (s: string) => (s === 'delivered' ? 'success' : s === 'cancelled' || s === 'payment_failed' ? 'muted' : 'outline');

export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const query: RangeQuery = useMemo(
    () => ({ range: params.get('range') ?? '30d', from: params.get('from') ?? undefined, to: params.get('to') ?? undefined }),
    [params],
  );
  const { data, isLoading, isFetching } = useDashboard(query);
  const user = useAuth((s) => s.user);
  const compare = RANGE_WORDS[query.range] ?? 'the previous period';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Overview</p>
          <h1 className="mt-1 text-display-md">Good to see you{user?.first_name ? `, ${user.first_name}` : ''}</h1>
        </div>
        <RangePicker
          value={query}
          onChange={(q) => setParams(Object.fromEntries(Object.entries(q).filter(([, v]) => v)) as Record<string, string>)}
        />
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading dashboard">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className={cn('space-y-6 transition-opacity', isFetching && 'opacity-70')}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Revenue" value={formatMoney(data.kpis.revenue.value)} kpi={data.kpis.revenue} compare={compare} spark={<Sparkline data={data.revenue_series} dataKey="revenue" />} />
            <KpiCard label="Orders" value={String(data.kpis.orders.value)} kpi={data.kpis.orders} compare={compare} spark={<Sparkline data={data.revenue_series} dataKey="orders" />} />
            <KpiCard label="Average order value" value={formatMoney(data.kpis.aov.value)} kpi={data.kpis.aov} compare={compare} />
            <KpiCard label="Customers" value={String(data.kpis.customers.value)} kpi={data.kpis.customers} compare={compare} />
            <KpiCard label="Conversion" value={`${data.kpis.conversion.value}%`} kpi={data.kpis.conversion} compare={compare} />
            <KpiCard label="Visits" value={new Intl.NumberFormat('en-IN').format(data.visits)} kpi={{ value: data.visits, previous: null, change: null }} />
            <KpiCard label="Awaiting fulfilment" value={String(data.kpis.pending_orders.value)} kpi={data.kpis.pending_orders} href="/admin-panel/orders?status=placed" />
            <KpiCard label="Low-stock variants" value={String(data.kpis.low_stock.value)} kpi={data.kpis.low_stock} href="/admin-panel/inventory?stock=low" warn={data.kpis.low_stock.value > 0} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <RevenueChart data={data} />
            <StatusBreakdown rows={data.orders_by_status} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <RankedBars
              title="Top products"
              subtitle="By revenue in this period"
              rows={data.top_products.map((p) => ({ key: p.product_id, label: p.name, value: p.revenue, detail: `${p.units} sold`, href: `/admin-panel/products/${p.product_id}` }))}
            />
            <RankedBars
              title="Sales by department"
              subtitle="Revenue in this period"
              rows={data.sales_by_category.map((c) => ({ key: c.category, label: c.category, value: c.revenue }))}
            />
            <CustomerSplit data={data} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title="Recent orders" className="xl:col-span-2" action={<Link to="/admin-panel/orders" className="text-xs font-semibold text-accent link-underline">View all</Link>}>
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-[0.1em] text-ink-muted">
                      <th scope="col" className="px-5 py-2 font-semibold">Order</th>
                      <th scope="col" className="px-2 py-2 font-semibold">Customer</th>
                      <th scope="col" className="px-2 py-2 font-semibold">Status</th>
                      <th scope="col" className="px-5 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_orders.map((o) => (
                      <tr key={o.number} className="border-b border-line/60 last:border-0 hover:bg-ink/[0.03]">
                        <td className="px-5 py-3">
                          <Link to={`/admin-panel/orders/${o.number}`} className="font-medium text-accent link-underline">
                            {o.number}
                          </Link>
                          <p className="text-xs text-ink-muted">{new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                        </td>
                        <td className="px-2 py-3">
                          <p className="text-ink">{o.customer}</p>
                          <p className="text-xs text-ink-muted">{o.email}</p>
                        </td>
                        <td className="px-2 py-3">
                          <Badge tone={statusTone(o.status)}>{o.status_label}</Badge>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatMoney(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Low stock" subtitle="Lowest first" action={<Link to="/admin-panel/inventory?stock=low" className="text-xs font-semibold text-accent link-underline">Manage</Link>}>
              {data.low_stock.length ? (
                <ul className="divide-y divide-line">
                  {data.low_stock.map((v) => (
                    <li key={v.variant_id} className="flex items-center gap-3 py-2.5">
                      <AlertTriangle className={cn('h-4 w-4 shrink-0', v.stock === 0 ? 'text-danger' : 'text-warning')} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{v.product}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {v.label || v.sku}
                        </span>
                      </span>
                      <span className={cn('text-sm font-semibold tabular-nums', v.stock === 0 ? 'text-danger' : 'text-ink')}>
                        {v.stock === 0 ? 'Out' : `${v.stock} left`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-ink-muted">Everything is well stocked.</p>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
