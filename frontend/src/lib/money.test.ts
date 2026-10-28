import { discountPercent, formatMoney } from './money';

describe('formatMoney', () => {
  it('formats paise as Indian-grouped rupees', () => {
    expect(formatMoney(12345600)).toBe('₹1,23,456');
  });
  it('keeps real paise', () => {
    expect(formatMoney(129950)).toBe('₹1,299.50');
  });
  it('formats zero', () => {
    expect(formatMoney(0)).toBe('₹0');
  });
});

describe('discountPercent', () => {
  it('rounds to a whole percent', () => {
    expect(discountPercent(7499, 9999)).toBe(25);
  });
  it('is zero without a higher MRP', () => {
    expect(discountPercent(5000, null)).toBe(0);
    expect(discountPercent(5000, 4000)).toBe(0);
  });
});

describe('formatCompactMoney', () => {
  it('uses Indian units', async () => {
    const { formatCompactMoney } = await import('./money');
    expect(formatCompactMoney(95000)).toBe('₹950');
    expect(formatCompactMoney(4850000)).toBe('₹48.5k');
    expect(formatCompactMoney(48000000)).toBe('₹4.8L');
    expect(formatCompactMoney(1200000000)).toBe('₹1.2Cr');
  });
});
