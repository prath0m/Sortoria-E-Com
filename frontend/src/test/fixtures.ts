import type { Quote, QuoteLine, StoreSettings } from '@/api/types';

export const settings = { name: 'Sartoria', tagline: 'Crafted with intention.' } as StoreSettings;

export function quoteLine(overrides: Partial<QuoteLine> = {}): QuoteLine {
  return {
    id: null,
    variant_id: 11,
    product_id: 1,
    slug: 'linen-shirt',
    name: 'Linen Camp Shirt',
    brand: 'Weave & Co',
    sku: 'LCS-1',
    variant_label: 'White / M',
    options: [],
    image: null,
    quantity: 1,
    max_quantity: 5,
    unit_price_paise: 349900,
    mrp_paise: 349900,
    line_total_paise: 349900,
    discount_paise: 0,
    flash_sale: null,
    is_bulky: false,
    issue: '',
    ...overrides,
  };
}

export function makeQuote(lines: QuoteLine[], overrides: Partial<Quote> = {}): Quote {
  const subtotal = lines.reduce((n, l) => n + l.line_total_paise, 0);
  return {
    lines,
    item_count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal_paise: subtotal,
    mrp_total_paise: subtotal,
    bundle_discount_paise: 0,
    bundles_applied: [],
    coupon: null,
    pincode: '',
    serviceable: null,
    destination: null,
    shipping_options: [
      { code: 'standard', name: 'Standard delivery', description: '', fee_paise: 0, base_fee_paise: 9900, free: true, available: true, unavailable_reason: '', eta_from: null, eta_to: null },
    ],
    shipping_method: 'standard',
    shipping_fee_paise: 0,
    payment_method: '',
    cod_available: true,
    cod_unavailable_reason: '',
    cod_fee_paise: 0,
    tax: { total_paise: 16662, cgst_paise: 8331, sgst_paise: 8331, igst_paise: 0 },
    savings_paise: 0,
    total_paise: subtotal,
    free_shipping_threshold_paise: 199900,
    free_shipping_remaining_paise: 0,
    messages: [],
    has_issues: false,
    ...overrides,
  };
}
