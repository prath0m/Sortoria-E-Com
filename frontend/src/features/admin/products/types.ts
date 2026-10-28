export interface AdminVariant {
  id?: number;
  sku: string;
  label?: string;
  option_values: number[];
  price_paise: number;
  compare_at_paise: number | null;
  stock: number;
  low_stock_threshold: number | null;
  weight_g: number;
  is_active: boolean;
  position?: number;
}

export interface AdminImage {
  id: number;
  url: string;
  thumb: string;
  alt_text: string;
  option_value: number | null;
  position: number;
}

export interface AdminProduct {
  id?: number;
  name: string;
  slug: string;
  brand: number | null;
  category: number | null;
  extra_categories: number[];
  product_type: 'standard' | 'bulky';
  short_description: string;
  description: string;
  highlights: string[];
  care_info: string;
  warranty_info: string;
  box_contents: string;
  attribute_values: number[];
  tax_rate: number;
  hsn_code: string;
  is_returnable: boolean | null;
  is_active: boolean;
  is_featured: boolean;
  published_at?: string;
  seo_title: string;
  seo_description: string;
  variants: AdminVariant[];
  specs: { group: string; key: string; value: string }[];
  images?: AdminImage[];
  rating_avg?: number;
  rating_count?: number;
  sales_count?: number;
}

export interface ProductRow {
  id: number;
  name: string;
  slug: string;
  brand: string | null;
  category: string;
  thumb: string | null;
  min_price_paise: number;
  max_price_paise: number;
  total_stock: number;
  in_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  variant_count: number;
  sales_count: number;
  updated_at: string;
}

export interface CatalogOptions {
  categories: { id: number; name: string; depth: number; is_leaf: boolean }[];
  brands: { id: number; name: string }[];
  attributes: { id: number; name: string; slug: string; kind: string; is_variant_axis: boolean; values: { id: number; value: string; hex: string }[] }[];
  tax_rates: number[];
}

export function emptyProduct(): AdminProduct {
  return {
    name: '',
    slug: '',
    brand: null,
    category: null,
    extra_categories: [],
    product_type: 'standard',
    short_description: '',
    description: '',
    highlights: [],
    care_info: '',
    warranty_info: '',
    box_contents: '',
    attribute_values: [],
    tax_rate: 18,
    hsn_code: '',
    is_returnable: null,
    is_active: true,
    is_featured: false,
    seo_title: '',
    seo_description: '',
    variants: [{ sku: '', option_values: [], price_paise: 0, compare_at_paise: null, stock: 0, low_stock_threshold: null, weight_g: 500, is_active: true }],
    specs: [],
  };
}
