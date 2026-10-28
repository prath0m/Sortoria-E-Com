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

export interface QuoteLine {
  id: number | null;
  variant_id: number;
  product_id: number;
  slug: string;
  name: string;
  brand: string | null;
  sku: string;
  variant_label: string;
  options: { name: string; value: string; hex: string }[];
  image: { url: string; renditions: Record<string, string>; alt: string } | null;
  quantity: number;
  max_quantity: number;
  unit_price_paise: number;
  mrp_paise: number;
  line_total_paise: number;
  discount_paise: number;
  flash_sale: { title: string; ends_at: string } | null;
  is_bulky: boolean;
  issue: string;
}

export interface ShippingOption {
  code: string;
  name: string;
  description: string;
  fee_paise: number;
  base_fee_paise: number;
  free: boolean;
  available: boolean;
  unavailable_reason: string;
  eta_from: string | null;
  eta_to: string | null;
}

export interface Quote {
  lines: QuoteLine[];
  saved_for_later?: QuoteLine[];
  item_count: number;
  subtotal_paise: number;
  mrp_total_paise: number;
  bundle_discount_paise: number;
  bundles_applied: { title: string; slug: string; sets: number; discount_paise: number }[];
  coupon: { code: string; applied: boolean; discount_paise: number; message: string } | null;
  pincode: string;
  serviceable: boolean | null;
  destination: { city: string; state: string } | null;
  shipping_options: ShippingOption[];
  shipping_method: string;
  shipping_fee_paise: number;
  payment_method: string;
  cod_available: boolean;
  cod_unavailable_reason: string;
  cod_fee_paise: number;
  tax: { total_paise: number; cgst_paise: number; sgst_paise: number; igst_paise: number };
  savings_paise: number;
  total_paise: number;
  free_shipping_threshold_paise: number | null;
  free_shipping_remaining_paise: number;
  messages: string[];
  has_issues: boolean;
}

export interface DeliveryEstimate {
  pincode: string;
  serviceable: boolean;
  city?: string;
  state?: string;
  options: ShippingOption[];
  cod_available: boolean;
}

export interface Sale {
  id: number;
  kind: 'flash' | 'daily_deal';
  title: string;
  slug: string;
  subtitle: string;
  banner_image: string | null;
  starts_at: string;
  ends_at: string;
  is_live: boolean;
  products: (ProductCard & { sale_progress?: { cap: number | null; sold: number } })[];
}

export interface BundleOffer {
  title: string;
  slug: string;
  description: string;
  image: string | null;
  ends_at: string | null;
  items: { quantity: number; product: ProductCard }[];
  value_paise: number;
  bundle_price_paise: number;
  saving_paise: number;
}

export type OrderStatus =
  | 'pending_payment'
  | 'payment_failed'
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderAddress {
  full_name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  state_code?: string;
  pincode: string;
}

export interface OrderItem {
  id: number;
  product_name: string;
  product_slug: string;
  variant_label: string;
  sku: string;
  image_url: string;
  mrp_paise: number;
  unit_price_paise: number;
  quantity: number;
  line_discount_paise: number;
  tax_rate: number;
  tax_paise: number;
  line_total_paise: number;
  returned_quantity: number;
}

export interface OrderSummaryRow {
  number: string;
  status: OrderStatus;
  status_label: string;
  payment_status: string;
  payment_method: string;
  grand_total_paise: number;
  placed_at: string | null;
  created_at: string;
  item_count: number;
  preview_images: string[];
}

export interface OrderDetail extends OrderSummaryRow {
  email: string;
  phone: string;
  shipping_address: OrderAddress;
  billing_address: OrderAddress;
  shipping_method: string;
  coupon_code: string;
  subtotal_paise: number;
  item_discount_paise: number;
  bundle_discount_paise: number;
  coupon_discount_paise: number;
  shipping_fee_paise: number;
  cod_fee_paise: number;
  tax_total_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  courier_name: string;
  tracking_number: string;
  tracking_url: string;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string;
  customer_note: string;
  items: OrderItem[];
  events: { to_status: OrderStatus; label: string; note: string; created_at: string }[];
  can_cancel: boolean;
  can_retry_payment: boolean;
  has_invoice: boolean;
  access_token: string;
}

export interface RazorpayPayload {
  provider: 'razorpay';
  key_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  prefill: { name: string; email: string; contact: string };
}

export interface CheckoutResult {
  order: OrderDetail;
  payment: RazorpayPayload | null;
}

export interface Review {
  id: number;
  rating: number;
  title: string;
  body: string;
  author: string;
  is_verified_buyer: boolean;
  photos: string[];
  admin_reply: string;
  created_at: string;
}

export interface ReviewPage extends Paginated<Review> {
  summary: { average: number; count: number; distribution: Record<string, number> };
  viewer: { status: 'pending' | 'approved' | 'rejected' | null; verified_buyer: boolean } | null;
}

export interface ReturnableItem {
  order_item_id: number;
  product_name: string;
  variant_label: string;
  image_url: string;
  quantity: number;
  returnable_quantity: number;
  policy: 'returnable' | 'replacement_only' | 'non_returnable';
  window_days: number;
  eligible: boolean;
  note: string;
}

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'pickup_scheduled' | 'received' | 'refunded' | 'replaced';

export interface ReturnRequest {
  number: string;
  order_number: string;
  status: ReturnStatus;
  status_label: string;
  reason: string;
  reason_label: string;
  resolution: 'refund' | 'replacement';
  comments: string;
  refund_amount_paise: number;
  pickup_date: string | null;
  admin_note: string;
  created_at: string;
  resolved_at: string | null;
  items: { order_item_id: number; product_name: string; variant_label: string; image_url: string; quantity: number }[];
  photos: string[];
  events: { status: ReturnStatus; label: string; created_at: string }[];
}

export interface HeroSlide {
  id: number;
  eyebrow: string;
  headline: string;
  subtext: string;
  image: string;
  mobile_image: string | null;
  image_alt: string;
  cta_label: string;
  cta_url: string;
  secondary_cta_label: string;
  secondary_cta_url: string;
  text_theme: 'light' | 'dark';
  text_align: 'left' | 'center' | 'right';
}

export interface Banner {
  id: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  mobile_image: string | null;
  cta_label: string;
  cta_url: string;
  badge_text: string;
}

interface SectionBase {
  id: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  image: string | null;
  cta_label: string;
  cta_url: string;
}

export type HomeSectionData =
  | (SectionBase & { type: 'hero'; data: HeroSlide[] })
  | (SectionBase & { type: 'featured_categories'; data: { id: number; name: string; slug: string; image: string | null }[] })
  | (SectionBase & { type: 'trending' | 'new_arrivals' | 'best_sellers' | 'featured_products'; data: ProductCard[] })
  | (SectionBase & { type: 'flash_sale' | 'daily_deals'; data: { title: string; slug: string; subtitle: string; ends_at: string; products: ProductCard[] } })
  | (SectionBase & { type: 'bundles'; data: BundleOffer[] })
  | (SectionBase & { type: 'promo_banners'; data: Banner[] })
  | (SectionBase & { type: 'trust_badges'; data: { icon: string; title: string; text: string }[] })
  | (SectionBase & { type: 'counters'; data: { value: number; prefix: string; suffix: string; label: string }[] })
  | (SectionBase & { type: 'testimonials'; data: { name: string; location: string; quote: string; rating: number; avatar: string | null }[] })
  | (SectionBase & { type: 'newsletter' | 'editorial'; data: Record<string, never> });

export interface CmsPage {
  title: string;
  slug: string;
  summary: string;
  body: string;
  seo_title: string;
  seo_description: string;
  updated_at: string;
}
