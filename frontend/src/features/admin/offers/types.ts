import type { ProductRef } from '../components/ProductPicker';

export interface SaleItem {
  id?: number;
  product: number;
  product_detail: ProductRef;
  discount_type: 'percent' | 'fixed_price';
  value: number;
  quantity_cap: number | null;
  sold_count?: number;
}

export interface Sale {
  id?: number;
  kind: 'flash' | 'daily_deal';
  title: string;
  slug: string;
  subtitle: string;
  banner_image?: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  position: number;
  items: SaleItem[];
  item_count?: number;
  state?: string;
}

export interface BundleItem {
  product: number;
  product_detail: ProductRef;
  quantity: number;
}

export interface Bundle {
  id?: number;
  title: string;
  slug: string;
  description: string;
  image?: string | null;
  discount_type: 'percent' | 'fixed_off' | 'fixed_price';
  value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  items: BundleItem[];
  state?: string;
  full_price_paise?: number;
}

/** Price after a flash discount, mirroring FlashSaleItem.price_for on the server. */
export function salePrice(base: number, item: Pick<SaleItem, 'discount_type' | 'value'>) {
  if (item.discount_type === 'percent') {
    const sale = base - Math.floor((base * Math.min(item.value, 95)) / 100);
    return Math.max(100, Math.floor(sale / 100) * 100);
  }
  return Math.min(base, Math.max(100, item.value));
}
