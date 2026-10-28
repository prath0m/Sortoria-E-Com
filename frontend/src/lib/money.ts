/** All amounts from the API are integer paise. These helpers only format at the edge. */

const wholeRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const withPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(paise: number, currency = 'INR'): string {
  if (currency !== 'INR') {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(paise / 100);
  }
  // ₹1,299 for whole rupees, ₹1,299.50 when there are paise.
  return paise % 100 === 0 ? wholeRupees.format(paise / 100) : withPaise.format(paise / 100);
}

export function discountPercent(pricePaise: number, mrpPaise: number | null | undefined): number {
  if (!mrpPaise || mrpPaise <= pricePaise) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}

/** Short Indian-style amounts for chart axes and KPI tiles: ₹950, ₹48.5k, ₹4.8L, ₹1.2Cr. */
export function formatCompactMoney(paise: number): string {
  const rupees = paise / 100;
  const trim = (n: number) => (n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ''));
  if (rupees >= 1e7) return `₹${trim(rupees / 1e7)}Cr`;
  if (rupees >= 1e5) return `₹${trim(rupees / 1e5)}L`;
  if (rupees >= 1e3) return `₹${trim(rupees / 1e3)}k`;
  return `₹${Math.round(rupees)}`;
}
