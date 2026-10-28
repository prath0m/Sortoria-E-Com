/** Response shapes for the storefront API (mirrors the DRF serializers; see /api/docs/). */

export interface Paginated<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface StoreSettings {
  name: string;
  tagline: string;
  logo: string | null;
  logo_monogram: string | null;
  favicon: string | null;
  og_default_image: string | null;
  contact_email: string;
  support_phone: string;
  whatsapp: string;
  support_hours: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  instagram_url: string;
  facebook_url: string;
  pinterest_url: string;
  youtube_url: string;
  x_url: string;
  announcement_text: string;
  announcement_enabled: boolean;
  footer_blurb: string;
  meta_title_suffix: string;
  meta_description: string;
  return_window_days: number;
  cod_enabled: boolean;
  cod_fee_paise: number;
  infinite_scroll_mobile: boolean;
}

export type Role = 'customer' | 'manager' | 'admin';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: Role;
  marketing_opt_in: boolean;
  date_joined: string;
  capabilities: string[];
}

export interface AuthResponse {
  access: string;
  user: User;
}

export interface Address {
  id: number;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  country: string;
  is_default_shipping: boolean;
  is_default_billing: boolean;
}

export interface NavNode {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  menu_image: string | null;
  children: NavNode[];
}

export interface CategoryLink {
  id: number;
  name: string;
  slug: string;
}

export interface ReturnPolicy {
  policy: 'returnable' | 'replacement_only' | 'non_returnable';
  window_days: number;
}

export interface CategoryDetail extends CategoryLink {
  description: string;
  image: string | null;
  banner_image: string | null;
  banner_mobile_image: string | null;
  banner_headline: string;
  banner_subtext: string;
  seo_title: string;
  seo_description: string;
  breadcrumbs: CategoryLink[];
  children: { id: number; name: string; slug: string; image: string | null }[];
  return_policy: ReturnPolicy;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  description: string;
}

export interface ProductImage {
  id: number;
  url: string;
  alt: string;
  renditions: Record<string, string>;
  width: number;
  height: number;
  option_value: string | null;
}

export interface Swatch {
  slug: string;
  value: string;
  hex: string;
}

export interface FlashSaleBadge {
  title: string;
  slug: string;
  ends_at: string;
  kind: 'flash' | 'daily_deal';
}

export interface ProductCard {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  short_description: string;
  images: ProductImage[];
  price_paise: number;
  max_price_paise: number;
  mrp_paise: number;
  discount_pct: number;
  rating_avg: number;
  rating_count: number;
  in_stock: boolean;
  is_new: boolean;
  is_featured: boolean;
  swatches: Swatch[];
  variant_count: number;
  default_variant_id: number | null;
  flash_sale: FlashSaleBadge | null;
}

export interface Variant {
  id: number;
  sku: string;
  label: string;
  options: Record<string, string>;
  price_paise: number;
  mrp_paise: number;
  stock: number;
  is_low_stock: boolean;
}

export interface Axis {
  slug: string;
  name: string;
  kind: 'swatch' | 'text' | 'numeric';
  values: Swatch[];
}

export interface ProductDetail extends Omit<ProductCard, 'brand' | 'category'> {
  brand: Brand | null;
  category: CategoryLink;
  description: string;
  highlights: string[];
  care_info: string;
  warranty_info: string;
  box_contents: string;
  product_type: 'standard' | 'bulky';
  tax_rate: number;
  seo_title: string;
  seo_description: string;
  breadcrumbs: CategoryLink[];
  variants: Variant[];
  axes: Axis[];
  specs: { group: string; items: { key: string; value: string }[] }[];
  facts: { name: string; value: string }[];
  return_policy: ReturnPolicy;
  published_at: string;
}

export interface FacetValue {
  slug: string;
  value: string;
  hex: string;
  count: number;
  selected: boolean;
}

export interface Facets {
  brands: { slug: string; name: string; count: number; selected: boolean }[];
  attributes: { slug: string; name: string; kind: Axis['kind']; unit: string; values: FacetValue[] }[];
  price: { min: number; max: number; selected_min: number | null; selected_max: number | null };
  ratings: { min: number; count: number; selected: boolean }[];
  discounts: { min: number; count: number; selected: boolean }[];
  availability: { in_stock: number; selected: boolean };
  total: number;
}

export interface Suggestions {
  products: ProductCard[];
  categories: { name: string; slug: string }[];
  brands: { name: string; slug: string }[];
}
