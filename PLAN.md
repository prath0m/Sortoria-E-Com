# Sartoria — Implementation Plan

> Status: **Draft, awaiting approval.** No application code has been written yet.
> Scope: every item in Feature List §1 (Storefront) and §2 (Admin). §3 is out of scope, but there are extension points for it (see §11).

---

## 0. Decisions that need your sign-off

These shape the data model and seed data. The plan assumes the **bold** default for each.

| # | Question | Default assumed |
|---|----------|-----------------|
| D1 | What does Sartoria sell? | **Confirmed: a premium general store selling everything, in the spirit of a curated department store.** 10 top-level categories: Electronics, Fashion, Footwear, Home & Kitchen, Sports & Fitness, Beauty & Personal Care, Books & Stationery, Toys & Baby, Jewellery & Watches, Bags & Travel, each with 3–6 subcategories. Groceries and perishables are excluded because they need expiry and slot delivery. Because the catalog is mixed, variants use **generic attributes** (colour, size, storage, RAM, capacity, weight…) instead of fixed colour/size fields |
| D2 | Are prices GST-inclusive or exclusive? | **Inclusive** (the Indian MRP convention). The price shown is the price paid. GST is shown as a breakdown, split into CGST+SGST for intra-state orders and IGST for inter-state orders (based on the store state in Store Settings) |
| D3 | Demo product photos | **The seed command downloads a curated list of free-licence Unsplash photos once** and caches them in `backend/seed_assets/`. If there's no network, it falls back to generated on-brand artwork (Pillow) |
| D4 | Local runtime (Docker isn't installed on this machine) | **Develop natively** against Homebrew Postgres + Redis using `make` targets. `docker-compose.yml` is still provided and kept in sync. It will be verified once Docker Desktop is installed |
| D5 | Razorpay keys | **You add test-mode keys to `.env`.** Automated tests mock the Razorpay SDK, so the suite runs without keys |
| D6 | Repo layout | **Monorepo:** `backend/` (Django) + `frontend/` (one Vite app). The storefront and `/admin-panel` are code-split into separate route bundles |

---

## 1. Architecture

```
                ┌──────────────────────────── Browser ────────────────────────────┐
                │  React 18 SPA (Vite)                                             │
                │   ├─ Storefront routes  (Lenis, GSAP, Framer Motion, Swiper)     │
                │   └─ /admin-panel/*     (lazy chunk; Recharts, TanStack Table)   │
                │  TanStack Query ⇄ REST   ·   Zustand (cart/wishlist/ui, persisted)│
                └───────────────┬──────────────────────────────────────────────────┘
                                │ /api/v1/*  (JWT bearer; refresh via httpOnly cookie)
┌───────────────────────────────▼──────────────────────────────────────────────────┐
│ Django 5 + DRF  (gunicorn)                                                        │
│  apps: accounts · catalog · cart · offers · shipping · orders · payments ·        │
│        reviews · cms · analytics · core (settings, audit, notifications, media)  │
│  services layer (pricing engine, stock reservation, order state machine,          │
│                  payment providers, invoice renderer, email dispatcher)           │
│  SEO views: sitemap.xml, robots.txt, server-side meta/OG/JSON-LD injection into   │
│             index.html for product/category/page routes                           │
└──────┬─────────────────────┬───────────────────────────┬─────────────────────────┘
       │                     │                           │
  PostgreSQL 16         Redis 7 (cache, throttles,   Celery worker + beat
  (FTS + pg_trgm)       Celery broker)               (emails, image renditions,
                                                      CSV import, reservation expiry,
                                                      analytics rollups)
```

**Key principles**
- **Thin views, fat services.** All business rules live in `apps/<app>/services/*.py` and are unit-tested. ViewSets only orchestrate.
- **The server is the source of truth for money.** The client only ever sends `{variant_id, qty}`, a coupon code, a pincode, a shipping method, and a payment method. Every total is recomputed by one pricing engine, which is shared by the cart, the quote and checkout.
- **Integer paise everywhere.** Values are stored as `PositiveBigIntegerField` and formatted only at the edge (`formatINR()` on the frontend, a template filter in emails/PDFs).
- **Nothing hardcoded.** Brand name, logo, tagline, contact details, policies, homepage composition, banners, shipping rules and thresholds are all database-backed and editable in the admin. The frontend boots by fetching `/store/settings` (cached and inlined into `index.html` by Django in production so there's no extra round-trip).

---

## 2. Repository layout

```
sartoria/
├─ PLAN.md · CLAUDE.md · README.md · Makefile · docker-compose.yml · .env.example
├─ backend/
│  ├─ config/                 settings/{base,dev,test,prod}.py, urls.py, celery.py, asgi/wsgi
│  ├─ apps/
│  │  ├─ core/                StoreSettings, AuditLog, AdminNotification, base models, permissions,
│  │  │                       pagination, money utils, image renditions, caching helpers
│  │  ├─ accounts/            User, Address, auth views, password reset, staff roles
│  │  ├─ catalog/             Category, Brand, Color, Size, Product, Variant, Image, Spec, search
│  │  ├─ offers/              Coupon, FlashSale, Bundle, redemption tracking
│  │  ├─ cart/                Cart, CartItem, Wishlist, pricing engine
│  │  ├─ shipping/            ShippingMethod, ShippingZone, ServiceablePincode, estimator
│  │  ├─ orders/              Order, OrderItem, StatusEvent, state machine, invoices, returns
│  │  ├─ payments/            Payment, Refund, WebhookEvent, provider registry (Razorpay, COD)
│  │  ├─ reviews/             Review, ReviewPhoto, moderation
│  │  ├─ cms/                 HeroSlide, HomeSection, PromoBanner, TrustBadge, Testimonial,
│  │  │                       Page, NewsletterSubscriber
│  │  └─ analytics/           DailyMetric, PageVisit, dashboard queries
│  ├─ templates/              emails/*.html|txt, invoices/invoice.html, spa/index meta partial
│  ├─ seed_assets/            cached demo images (git-ignored except manifest.json)
│  ├─ tests/                  pytest, factories (factory_boy), per-app test modules
│  └─ pyproject.toml          deps + ruff + pytest config
└─ frontend/
   ├─ public/                 favicon.svg, logo assets, robots fallback
   ├─ src/
   │  ├─ app/                 main.tsx, router.tsx, providers, ErrorBoundary
   │  ├─ api/                 client.ts (fetch + refresh), schema.d.ts (generated), queryKeys, hooks/
   │  ├─ stores/              cart, wishlist, auth, ui, recentlyViewed (Zustand + persist)
   │  ├─ design/              tokens.ts, motion.ts (shared easing/durations), tailwind preset
   │  ├─ components/
   │  │  ├─ ui/               primitives (see §7)
   │  │  ├─ brand/            Logo, Monogram, BotanicalDivider, OrganicShape, GrainOverlay, illustrations
   │  │  └─ motion/           Reveal, Stagger, PageTransition, Counter, Countdown, Parallax,
   │  │                       SmoothScrollProvider, FlyToCart
   │  ├─ features/
   │  │  ├─ storefront/       home, catalog, product, search, cart, wishlist, checkout, account,
   │  │  │                    orders, returns, offers, pages, auth
   │  │  └─ admin/            layout, dashboard, products, categories, inventory, orders, returns,
   │  │                       customers, reviews, offers, storefront, shipping, settings, staff,
   │  │                       import-export, audit
   │  ├─ lib/                 money, seo (Helmet helpers), hooks, validation (zod), utils
   │  └─ test/                setup, MSW handlers, fixtures
   └─ package.json · vite.config.ts · tailwind.config.ts · vitest.config.ts
```

---

## 3. Data models

`BaseModel` = `created_at`, `updated_at`. All money fields are `*_paise` integers. Any model with `position` supports drag-reordering in the admin.

### 3.1 core
| Model | Fields |
|---|---|
| **StoreSettings** (singleton) | name, tagline, logo (SVG/PNG), logo_monogram, favicon, og_default_image, contact_email, support_phone, whatsapp, address lines, state_code (for GST split), gstin, social links (instagram, facebook, pinterest, youtube, x), announcement_bar_text/enabled, low_stock_threshold_default, return_window_days, cod_enabled, cod_fee_paise, cod_max_order_paise, meta_title_suffix, meta_description, footer_blurb |
| **AuditLog** | actor(FK user), action (create/update/delete/bulk/transition/login), object_type, object_id, object_repr, changes (JSON diff), ip, user_agent, created_at. Indexed on (object_type, object_id) and created_at |
| **AdminNotification** | kind (new_order, low_stock, return_requested, review_pending, import_finished), title, link, payload JSON, read_by (M2M users), created_at |
| **ImportJob** | kind (products/inventory/pincodes), file, status, total/success/error counts, error_report (CSV file), created_by |

### 3.2 accounts
| Model | Fields |
|---|---|
| **User** (custom, email login) | email (unique), first/last name, phone, is_staff, role (`customer` / `manager` / `admin`), marketing_opt_in, date_joined. Role → Django Group sync for permission checks |
| **Address** | user, label, full_name, phone, line1, line2, landmark, city, state, state_code, pincode, country (IN), is_default_shipping, is_default_billing |

Password reset uses Django's `PasswordResetTokenGenerator` (single-use, time-limited, invalidated when the password changes) and is delivered by email.

### 3.3 catalog
| Model | Fields |
|---|---|
| **Category** (`django-treebeard` MP_Node, unlimited depth, UI supports 3) | name, slug (unique), description, image, banner_image, banner_mobile_image, banner_headline, banner_subtext, menu_image, show_in_menu, is_active, position, seo_title, seo_description, **return_policy** (`returnable` / `replacement_only` / `non_returnable`) + return_window_days override (e.g. electronics 7-day replacement, fashion 15-day return), **filterable_attributes** (M2M Attribute, which drives the filter sidebar per category) |
| **Brand** | name, slug, logo, description, is_active |
| **Attribute** | name, slug, kind (`swatch` / `text` / `numeric`), unit (e.g. GB, ml, kg), is_variant_axis, is_filterable, position. Seeded with Colour, Size, Shoe Size, Storage, RAM, Capacity, Weight, Material, Pack Size |
| **AttributeValue** | attribute, value, slug, hex (swatch only), numeric_value (for range sorting), position |
| **Product** | name, slug, brand, category (leaf), extra_categories (M2M), product_type (`physical_standard` / `bulky`), short_description, description (sanitised HTML), highlights (bullet list), care_info, warranty_info, box_contents, tax_rate (0/5/12/18/28), hsn_code, is_returnable override, is_active, is_featured, published_at, seo_title, seo_description, og_image. **Denormalised for fast filtering/sorting** (maintained by service): min_price_paise, max_price_paise, max_discount_pct, in_stock, rating_avg, rating_count, sales_count, trending_score |
| **ProductAttributeValue** | product, attribute value. Non-variant facts used in filters (e.g. "Material: Leather", "Screen size: 55 in") |
| **ProductVariant** | product, sku (unique), option_values (M2M AttributeValue, e.g. {Colour: Midnight, Storage: 256 GB}), price_paise, compare_at_paise (MRP, for strikethrough), stock, low_stock_threshold (nullable → store default), weight_g, is_active, position |
| **ProductImage** | product, option_value (nullable, so the gallery switches with the selected colour or finish), image (original), alt_text, position, renditions JSON `{400,800,1200,1600: webp url}` generated by a Celery task |
| **ProductSpec** | product, group (e.g. "Display", "Battery", "Dimensions"), key, value, position. Shown as grouped spec tables, which electronics need |
| **StockMovement** | variant, delta, reason (order_reserved, order_released, cancelled, return_restock, manual_adjust, import), reference, actor, created_at |
| **ProductView** (daily rollup) | product, date, views. Feeds `trending_score` |

Variants are validated so that each one has exactly one value per variant-axis attribute of its product, and no two variants share the same combination.

Indexes: GIN on `search_vector` (name A, brand B, category C, description D) plus `pg_trgm` on name for suggestions; B-tree on `(is_active, category)`, `min_price_paise`, `published_at`, `rating_avg`, `sales_count`, `trending_score`, `max_discount_pct`.

### 3.4 offers
| Model | Fields |
|---|---|
| **Coupon** | code (case-insensitive unique), description, discount_type (percent/fixed), value, max_discount_paise (cap for percent), min_order_paise, starts_at, ends_at, usage_limit_total, usage_limit_per_user, first_order_only, applicable_categories (M2M, optional), applicable_products (M2M, optional), is_active, times_used (denormalised) |
| **CouponRedemption** | coupon, order, user/email, discount_paise. Unique (coupon, order) |
| **FlashSale** | kind (`flash` / `daily_deal`), title, slug, subtitle, banner_image, starts_at, ends_at, is_active, position |
| **FlashSaleItem** | sale, product, discount_type (percent/fixed_price), value, quantity_cap (nullable), sold_count |
| **Bundle** | title, slug, description, image, discount_type (percent/fixed_off/fixed_price), value, starts_at, ends_at, is_active |
| **BundleItem** | bundle, product, quantity |

### 3.5 cart
| Model | Fields |
|---|---|
| **Cart** | user (one-to-one), coupon (nullable), updated_at |
| **CartItem** | cart, variant, quantity, saved_for_later, added_at. Unique (cart, variant, saved_for_later) |
| **WishlistItem** | user, product, added_at. Unique (user, product) |

Guest carts and wishlists live in `localStorage` (Zustand persist). Guests get live totals from `POST /cart/quote`. On login, `POST /cart/merge` and `POST /wishlist/merge` run: quantities are summed and capped at available stock, duplicates are dropped, then the local store is cleared.

### 3.6 shipping
| Model | Fields |
|---|---|
| **ShippingMethod** | code (`standard` / `express`), name, description, base_rate_paise, free_threshold_paise (nullable), is_active, position |
| **ShippingZone** | name, standard_days_min/max, express_days_min/max, express_available, cod_available, extra_fee_paise |
| **ServiceablePincode** | pincode (unique, indexed), zone, city, state, is_active. Admins can bulk-import these via CSV |

ShippingMethod also has a `bulky_surcharge_paise` (applied once per bulky line, e.g. TVs and treadmills) and `express_allows_bulky`.

The estimator takes a pincode, finds the zone, and returns per-method fee, ETA dates (skipping Sundays; cut-off time is configurable), and COD availability. Unserviceable pincodes block checkout with a polite message.

### 3.7 orders
| Model | Fields |
|---|---|
| **Order** | number (`SRT-2026-000123`, unique), user (nullable for guests), email, phone, status, payment_method (`razorpay` / `cod`), payment_status (pending/paid/failed/refunded/partially_refunded), shipping/billing address snapshot (JSON), shipping_method, coupon_code snapshot, **subtotal, item_discount, bundle_discount, coupon_discount, shipping_fee, cod_fee, tax_total, cgst, sgst, igst, grand_total** (all paise), courier_name, tracking_number, tracking_url, estimated_delivery_date, reservation_expires_at, placed_at, delivered_at, cancelled_at, cancel_reason, customer_note, internal_note, guest_access_token (for magic links in emails), invoice_number, invoice_pdf |
| **OrderItem** | order, variant (nullable, SET_NULL), snapshot: product_name, variant_label, sku, image_url, mrp_paise, unit_price_paise, quantity, line_discount_paise (allocated bundle and coupon share), tax_rate, tax_paise, line_total_paise, returned_qty |
| **OrderStatusEvent** | order, from_status, to_status, note, actor (nullable = system/customer), created_at. Drives the tracking timeline |
| **ReturnRequest** | number (`RET-…`), order, user/email, status, reason (wrong_size, damaged, not_as_described, changed_mind, other), comments, refund_method (original_payment / upi for COD), upi_id, refund_amount_paise, admin_note, pickup_date, resolved_at |
| **ReturnItem** | return_request, order_item, quantity |
| **ReturnPhoto** | return_request, image (validated type/size, max 5) |
| **ReturnStatusEvent** | same pattern as the order version |

**Order state machine** (`orders/services/state_machine.py`): a transition table lists the allowed `from → to` moves, who may make each one (system/customer/staff), and its side-effects. Any move not in the table raises `InvalidTransition` (HTTP 409).

```
pending_payment ──paid──▶ placed ──▶ confirmed ──▶ packed ──▶ shipped ──▶ out_for_delivery ──▶ delivered
      │                     │            │           │
      └─(timeout/failed)──▶ payment_failed            └──────── cancelled ◀── (customer: placed/confirmed; staff: up to packed)
COD orders start at `placed`.
```
Side-effects run on commit: a status email via Celery, stock release on cancel or payment failure, a refund on prepaid cancellations, COD → `paid` on delivery, `sales_count` updates, and admin notifications. `shipped` requires a courier and tracking number.

**Return state machine:** `requested → approved | rejected`, `approved → pickup_scheduled → received → refunded` (or `received → rejected`, with a note). Items are restocked on `received`, a refund goes through the payment provider on `refunded`, and every step sends an email. Requests are only allowed within the item's return window measured from `delivered_at`. The window resolves as product override → category policy → store default. `replacement_only` items (most electronics) offer a replacement instead of a refund, and `non_returnable` items (e.g. innerwear, opened cosmetics) can't be selected.

### 3.8 payments
| Model | Fields |
|---|---|
| **Payment** | order, provider, provider_order_id, provider_payment_id, amount_paise, status, signature_verified, raw (JSON), created_at |
| **Refund** | payment, return_request (nullable), amount_paise, provider_refund_id, status, reason |
| **WebhookEvent** | provider, event_id (unique, for idempotency), event_type, payload, processed_at |

### 3.9 reviews
**Review**: product, user, rating (1–5), title, body, is_verified_buyer (set server-side if the user has a delivered order containing the product), status (pending/approved/rejected), admin_reply, created_at. Unique (product, user).
**ReviewPhoto**: optional, up to 3.
Approving a review recomputes `rating_avg` and `rating_count`.

### 3.10 cms
| Model | Fields |
|---|---|
| **HeroSlide** | eyebrow, headline, subtext, image, mobile_image, cta_label/url, secondary_cta_label/url, text_theme (light/dark), text_alignment, starts_at/ends_at, is_active, position |
| **HomeSection** | type (`hero`, `featured_categories`, `trending`, `new_arrivals`, `best_sellers`, `flash_sale`, `daily_deals`, `bundles`, `promo_banners`, `trust_badges`, `counters`, `testimonials`, `newsletter`, `editorial_split`), title, subtitle, config JSON (validated per type, e.g. `{source: "auto" or "manual", product_ids, category_ids, limit}`), is_active, position |
| **PromoBanner** | placement (`home`, `category_top`, `cart`, `offers_page`, `mega_menu`), title, subtitle, image, mobile_image, cta_label/url, badge_text, starts_at/ends_at, is_active, position |
| **TrustBadge** | icon (key from curated SVG set), title, text, is_active, position |
| **Counter** | label, value, suffix (e.g. "12,000+ happy patrons"), is_active, position |
| **Testimonial** | name, location, quote, rating, avatar, is_active, position |
| **Page** | title, slug, body (sanitised HTML), seo fields, show_in_footer, is_active. Covers About, Shipping Policy, Returns Policy, Privacy, Terms, Contact. The PDP "Shipping & Returns" tab pulls a summary from here |
| **NewsletterSubscriber** | email (unique), status (pending/confirmed/unsubscribed), confirm_token, source |

### 3.11 analytics
**PageVisit** stores session_id (an anonymous cookie uuid), path, referrer and date. It is written through a throttled beacon and gives the denominator for conversion rate.
**DailyMetric** is a nightly rollup per date (visits, orders, revenue, new customers, returning customers, units). It keeps dashboard queries fast, and today's figures are computed live.

---

## 4. Pricing engine (`cart/services/pricing.py`)

`price_cart(lines, *, user, coupon_code, pincode, shipping_method, payment_method) -> Quote`

1. **Unit price** = variant `price_paise`, or the active flash-sale/daily-deal price if lower, while `quantity_cap` isn't exhausted. MRP = `compare_at_paise` (or the price itself) for strikethrough.
2. **Bundles**: if every bundle item is in the cart in the required quantities, apply the bundle discount. Bundles are applied greedily, highest saving first.
3. **Coupon**: validate active window, min order (after bundles), usage limits, per-user and first-order rules, and eligible lines. Compute the discount and apply the cap.
4. **Allocation**: bundle and coupon discounts are spread across eligible lines in proportion to value, using the largest-remainder method so the paise always add up exactly.
5. **Shipping**: method base rate + zone extra fee. Free if the post-discount subtotal ≥ `free_threshold_paise`. **COD fee** is added if applicable and checks `cod_max_order_paise`.
6. **GST** (prices are inclusive): `tax = round(line_net × r / (100 + r))` per line. Shipping and COD fees carry 18%. The total is split into CGST/SGST (same state as the store) or IGST.
7. The function returns lines, every subtotal, a savings total, applied/rejected coupon with reason, shipping options with ETAs, and messages (e.g. "Add ₹640 more for complimentary shipping").

The same function backs `GET /cart`, `POST /cart/quote` (guests) and `POST /checkout`. Checkout re-runs it inside the transaction after locking variants.

## 5. Checkout & stock reservation (`orders/services/checkout.py`)

```
with transaction.atomic():
    variants = ProductVariant.objects.select_for_update().filter(id__in=…).order_by("id")  # fixed lock order prevents deadlocks
    check stock for every line; on failure → 409 with per-line availability
    flash-sale item caps: select_for_update on FlashSaleItem, same check
    quote = price_cart(...)                     # authoritative totals
    order = Order.create(... status = pending_payment (razorpay) | placed (cod))
    variant.stock -= qty  (F-expressions) + StockMovement(order_reserved)
    coupon redemption recorded (counted only once paid/placed)
    razorpay: provider.create_payment(order) → razorpay_order_id; reservation_expires_at = now + 20 min
transaction.on_commit → emails, notifications, clear server cart
```
- **Razorpay flow:** frontend opens Checkout.js, then calls `POST /payments/razorpay/verify` with the HMAC signature. The server verifies it with `razorpay_key_secret` and moves the order `pending_payment → placed`. The `payment.captured` / `payment.failed` / `refund.processed` webhooks are verified with the webhook secret, made idempotent through `WebhookEvent.event_id`, and reconcile the order if the browser closed early.
- **Expiry:** a Celery beat job runs every 5 minutes, finds `pending_payment` orders past `reservation_expires_at`, marks them `payment_failed`, and releases the stock. Customers can retry payment on a failed order while stock remains.

---

## 6. API endpoints (`/api/v1/`, documented at `/api/docs/` via drf-spectacular)

### 6.1 Public / customer
| Area | Endpoints |
|---|---|
| Auth | `POST auth/register` · `POST auth/login` (returns access; refresh set as httpOnly SameSite cookie) · `POST auth/refresh` · `POST auth/logout` · `POST auth/password/forgot` · `POST auth/password/reset` · `POST auth/password/change` · `GET/PATCH auth/me` |
| Account | `CRUD account/addresses` · `POST account/addresses/{id}/set-default` |
| Store/CMS | `GET store/settings` · `GET store/navigation` (mega-menu tree with images and promos) · `GET home` (ordered sections with resolved data) · `GET cms/banners?placement=` · `GET pages/{slug}` · `POST newsletter/subscribe` · `POST newsletter/confirm` |
| Catalog | `GET categories` · `GET categories/{slug}` (with breadcrumbs, banner, children) · `GET brands` · `GET products` (filters: `category, brand[], attr.<slug>[]` (e.g. `attr.colour=black&attr.size=m&attr.storage=256-gb`), `price_min, price_max, rating_min, in_stock, on_sale, discount_min, q`; sort: `popular, price_asc, price_desc, newest, rating`; page/page_size) · `GET products/facets` (counts for the current filter set; attribute facets come from the category's `filterable_attributes`, so the Electronics listing shows Storage/RAM while Fashion shows Size/Colour) · `GET products/{slug}` · `GET products/{slug}/related` · `GET products/batch?ids=` (recently viewed) · `GET search/suggest?q=` (products, categories, brands) |
| Reviews | `GET products/{slug}/reviews` (sort and filter by rating) · `POST products/{slug}/reviews` (auth) |
| Offers | `GET offers/flash-sales/active` · `GET offers/deals` · `GET offers/bundles` · `GET offers/bundles/{slug}` · `POST offers/coupons/validate` |
| Cart | `GET cart` · `POST cart/items` · `PATCH/DELETE cart/items/{id}` · `POST cart/items/{id}/save-for-later` · `POST cart/items/{id}/move-to-cart` · `POST/DELETE cart/coupon` · `POST cart/merge` · `POST cart/quote` (guest) |
| Wishlist | `GET wishlist` · `POST wishlist` · `DELETE wishlist/{product_id}` · `POST wishlist/merge` · `POST wishlist/{product_id}/move-to-cart` |
| Shipping | `GET shipping/estimate?pincode=&product=` · `GET shipping/options?pincode=` |
| Checkout | `POST checkout` (guest or auth) · `POST checkout/{number}/retry-payment` |
| Payments | `POST payments/razorpay/verify` · `POST payments/razorpay/webhook` (CSRF-exempt, signature-verified) |
| Orders | `GET orders` · `GET orders/{number}` · `POST orders/{number}/cancel` · `GET orders/{number}/invoice` (PDF) · `POST orders/track` (number + email/phone → public timeline) · guest access via `?token=` magic link |
| Returns | `GET/POST returns` (multipart photos) · `GET returns/{number}` · `GET orders/{number}/returnable-items` |
| Analytics | `POST analytics/events` (page_view, product_view; throttled beacon) |

### 6.2 Admin (`/api/v1/admin/…`, role-guarded)
| Area | Endpoints |
|---|---|
| Dashboard | `analytics/kpis?from=&to=` (each KPI with the % change against the previous equal-length period) · `analytics/revenue` (granularity auto: hour/day/month) · `analytics/orders-by-status` · `analytics/top-products` · `analytics/sales-by-category` · `analytics/customers-split` · `analytics/recent-orders` · `analytics/low-stock` |
| Catalog | `CRUD products` (nested variants and specs) · `POST products/bulk` (activate, deactivate, feature, delete, set_category) · `POST products/{id}/images` (multi-upload) · `PATCH products/{id}/images/reorder` · `DELETE images/{id}` · `CRUD categories` + `POST categories/{id}/move` · `CRUD brands, attributes (+values)` |
| Inventory | `GET inventory` (variants with stock and status filters) · `PATCH inventory/bulk` · `GET inventory/{variant}/movements` |
| Orders | `GET orders` (filters: status, payment, method, date, amount; search: number/email/phone/name) · `GET orders/{number}` · `POST orders/{number}/transition` · `PATCH orders/{number}` (tracking, courier, internal note) · `GET orders/{number}/invoice` · `POST orders/bulk` (transition, invoices as merged PDF) |
| Returns | `GET returns` · `GET returns/{number}` · `POST returns/{number}/transition` · `POST returns/{number}/refund` |
| Customers | `GET customers` (search, filters: has_orders, joined range, LTV) · `GET customers/{id}` (orders, addresses, LTV) · `PATCH customers/{id}` (activate/deactivate) |
| Reviews | `GET reviews` · `POST reviews/bulk` (approve, reject, delete) · `PATCH reviews/{id}` (reply) |
| Offers | `CRUD coupons, flash-sales (+items), bundles (+items)` · bulk activate/deactivate |
| Storefront CMS | `CRUD hero-slides, home-sections, banners, trust-badges, counters, testimonials, pages` · `POST <resource>/reorder` · `GET newsletter-subscribers` (+ CSV export) |
| Shipping | `CRUD shipping-methods, shipping-zones, pincodes` · `POST pincodes/import` |
| Settings | `GET/PATCH settings/store` |
| Staff | `CRUD staff` (Admin only; set role, deactivate, send invite/reset) |
| Import/Export | `POST import/products` · `POST import/inventory` · `GET import/jobs/{id}` · `GET import/jobs/{id}/errors.csv` · `GET import/templates/{kind}.csv` · `GET export/products.csv` · `GET export/orders.csv` (both honour list filters) |
| System | `GET audit-log` (filter by actor/object/action/date) · `GET notifications` · `POST notifications/read` · `GET search?q=` (global search across orders, products and customers) |

### 6.3 Permissions matrix

| Capability | Manager | Admin |
|---|:-:|:-:|
| Dashboard, orders, returns, customers (view), reviews, inventory | ✓ | ✓ |
| Products, categories, brands: create/edit | ✓ | ✓ |
| Products/categories: delete, bulk delete | — | ✓ |
| Coupons, flash sales, bundles, CMS | ✓ | ✓ |
| Issue refunds | ✓ (≤ order value) | ✓ |
| CSV import / export | export only | ✓ |
| Shipping settings, store settings | — | ✓ |
| Staff and roles, audit log | — | ✓ |
| Customer deactivate | — | ✓ |

These are enforced by DRF permission classes (`HasAdminCapability("orders.refund")`). The same capability list is returned in `auth/me`, and the UI uses it to hide routes and buttons. The UI hiding is cosmetic only; the API remains authoritative.

### 6.4 Cross-cutting backend concerns
- **Throttling** (Redis): login 5/min/IP plus 20/hour per email; register and forgot-password 5/hour; search suggest 60/min; analytics beacon 120/min; checkout 10/min.
- **Security:** CORS allow-list from env; secure cookies in prod; CSRF check on the cookie-auth refresh/logout endpoints (double-submit token); HSTS/secure headers in prod; upload validation (MIME sniffing, size limits, Pillow re-encode); HTML sanitisation with `nh3`; no user enumeration on forgot-password.
- **Query hygiene:** `select_related`/`prefetch_related` in every list queryset, plus `django-assert-num-queries` style tests on hot endpoints (product list, PDP, cart, order list, admin orders).
- **Caching:** store settings, navigation, homepage payload, category tree and facets are cached in Redis with versioned keys, and `post_save`/`post_delete` signals bump the version. Flash-sale boundaries set a TTL equal to the time until the next start/end.
- **Celery beat:** expire reservations (5 min), roll up analytics (nightly), recompute trending scores (hourly), low-stock admin notifications (hourly, de-duplicated), send review-request emails 7 days after delivery.

---

## 7. Frontend

### 7.1 Design tokens (Tailwind preset + CSS variables)
- **burgundy** 50–900, with `#590907` at **800** (primary). **sage** 50–900, with `#A5A79B` at **400**. **gold** 50–900, with `#E8D258` at **300**. **cream** 50–200, with `#F3EDE2` at **100** (the page background). **ink** `#1E0F0E`-family (near-black with a burgundy undertone) for body text.
- **Contrast rules** (verified with a script in the test suite): sage-400 and gold-300 never carry text on cream. Muted text uses sage-800 (5.2:1 on cream; sage-700 measured 4.07:1 and fails). Gold appears only as a fill, underline, star or badge background, with ink/burgundy text on it.
- **Type:** *Cormorant Garamond* (display, 500/600, with italic used for editorial accents) and *Manrope* (UI/body, 400–700), self-hosted through `@fontsource` with the display weights preloaded. Fluid type scale using `clamp()`.
- **Surfaces:** hairline borders (`1px` in sage-300), soft layered shadows (`shadow-soft`, `shadow-lift`), radii 2/4/8px (restrained, never pill-shaped except on chips), and a grain overlay as an inline SVG `feTurbulence` at 4–6% opacity.
- **Motion tokens:** `ease-luxe = cubic-bezier(.22,1,.36,1)`, with durations 200/400/700/1200ms. All motion respects `prefers-reduced-motion`: Lenis is disabled, GSAP timelines jump to the end, and Framer variants become simple fades.

### 7.2 Brand assets
`Logo.tsx` + `/public/brand/sartoria-wordmark.svg` is a spaced Cormorant "SARTORIA" set in burgundy, with a thin gold flourish underline that ends in a needle-and-thread curl. `Monogram.tsx` + `favicon.svg` is a serif "S" inside a fine gold ring, used in the mobile header, favicon, the admin collapsed sidebar and the PDF invoice watermark. Both SVGs are inlined (currentColor-aware) and rendered from Store Settings when a custom logo is uploaded.

### 7.3 Storefront pages
| Route | Page |
|---|---|
| `/` | Home (sections rendered from `GET /home` in admin-defined order) |
| `/shop` · `/shop/:categoryPath*` | Category landing (banner, subcategory tiles, breadcrumbs) + product listing |
| `/brands/:slug` | Brand listing |
| `/search?q=` | Search results (same listing engine) |
| `/products/:slug` | Product detail |
| `/offers` · `/offers/flash-sale/:slug` · `/offers/bundles/:slug` | Offers hub, flash sale, bundle |
| `/cart` · `/wishlist` | Cart, wishlist |
| `/checkout` (steps: details → shipping → payment → review) | Checkout |
| `/order/:number/confirmation` | Order confirmation |
| `/track-order` · `/track-order/:number` | Public tracking |
| `/login` · `/register` · `/forgot-password` · `/reset-password/:uid/:token` | Auth |
| `/account` · `/account/profile` · `/account/addresses` · `/account/orders` · `/account/orders/:number` · `/account/returns` · `/account/returns/new` · `/account/returns/:number` | Customer account |
| `/pages/:slug` | CMS pages (about, policies, contact) |
| `/newsletter/confirm/:token` | Newsletter confirmation |
| `*` | Illustrated 404, plus a route-level error page |

Filter state lives entirely in the URL query string, which makes it shareable, back-button-safe and SSR-meta-friendly. "Clear filters" resets the query string. Listing supports **paginated** mode (SEO, default on desktop) and **infinite scroll** (default on mobile), toggled by a store setting.

### 7.4 Admin pages (`/admin-panel/*`)
Login · Dashboard · Products (list, create, edit with tabs: details, variants matrix generator that picks any variant-axis attributes and generates the combinations, images, grouped specs, SEO) · Categories (drag tree, return policy, filterable attributes) · Brands · Attributes & Values · Inventory · Orders (list, detail with timeline, transition, tracking, invoice) · Returns (list, detail) · Customers (list, detail) · Reviews · Coupons · Flash Sales & Deals · Bundles · Storefront: Hero Slides, Home Sections, Banners, Trust Badges, Counters, Testimonials, Pages, Newsletter · Shipping: Methods, Zones, Pincodes · Import/Export · Staff · Store Settings · Audit Log · Notifications.

The layout has a collapsible sidebar (icon rail when collapsed, a drawer on mobile), a top bar with global search (⌘K), a notification bell (polled every 30s), a dark-mode toggle and the profile menu. Dark mode uses a class strategy, stores the preference per user in localStorage, and remaps the same palette (burgundy-200 accents on ink-950).

### 7.5 Component inventory
- **UI primitives:** Button (primary/secondary/ghost/link, loading), IconButton, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, RangeSlider (price), Badge (sale/new/oos/verified), Price (sale + strikethrough + % off), Rating (display + input), OptionSelector (renders swatches, pills or a dropdown according to the attribute kind), QuantityStepper, Skeleton (+ presets per card/row/PDP), Modal, Drawer, BottomSheet, Tabs, Accordion, Tooltip, Toast (sonner), Pagination, Breadcrumbs, EmptyState (with illustration slot), Spinner, ProgressSteps, Timeline, DatePicker/DateRangePicker, FileDropzone, SortableList (dnd-kit), DataTable (TanStack Table: sorting, selection, bulk-action bar, column visibility, server pagination), StatCard, ConfirmDialog.
- **Storefront:** AnnouncementBar, Header (sticky, condenses on scroll), MegaMenu, MobileNav, SearchOverlay (live suggestions, keyboard-navigable listbox), MiniCartDrawer, FlyToCart layer, Footer (newsletter, policy links, socials from settings), HeroSlider (GSAP split-text reveal + Ken Burns, Swiper core), CategoryTiles, ProductCarousel, ProductCard (hover second-image crossfade, lift, quick-view slide-up, heart), ProductListRow, QuickViewModal, FilterSidebar / FilterBottomSheet, SortSelect, ViewToggle, ActiveFilterChips, FlashSaleStrip (Countdown), DealCard, BundleCard, PromoBanner (parallax), TrustBadges, CountersBand, TestimonialsSlider, NewsletterForm, BotanicalDivider, Gallery (thumb Swiper + hover zoom lens + fullscreen lightbox with pinch-zoom), VariantSelector, StickyAddToCartBar (mobile), PincodeChecker, ShareMenu (Web Share API + fallbacks), ReviewSummary/ReviewList/ReviewForm, RecentlyViewed, CheckoutProgress (animated), AddressForm/AddressPicker, ShippingOptions, CouponField, PaymentSelector, OrderSummary, OrderTimeline (animated), ReturnForm (item select + photo upload).
- **Admin:** AdminShell, Sidebar, Topbar, CommandSearch, NotificationsPopover, KpiCard (sparkline + delta), RevenueChart, OrdersByStatusDonut, TopProductsBar, SalesByCategory, CustomersSplit, RangePicker, ProductForm, VariantMatrix, ImageManager (drag-and-drop multi-upload with progress + reorder + alt text), CategoryTree, StatusTransitionMenu, ImportWizard (upload → validate → report), AuditDiffViewer, RoleGate.

### 7.6 Frontend architecture
- **Data:** TypeScript API types are generated from the OpenAPI schema (`openapi-typescript`), so frontend and backend can't silently drift. TanStack Query hooks live in `api/hooks/*` with central query keys and optimistic updates for cart and wishlist.
- **Auth:** the access token is held in memory and the refresh token sits in an httpOnly cookie. The fetch client retries once after a silent refresh, using a single-flight lock.
- **State:** Zustand stores `cart` (guest lines + drawer open), `wishlist` (guest ids), `ui` (menus, quick-view, filter sheet), and `recentlyViewed` (last 12, persisted).
- **Forms:** React Hook Form + Zod, with server-side field errors mapped onto inputs.
- **SEO:** `react-helmet-async` provides per-route title, meta, OG, canonical and JSON-LD (Product with offers and aggregateRating, BreadcrumbList, Organization, WebSite SearchAction). In production, Django injects the same meta into `index.html` for product, category and page URLs so crawlers and social scrapers see it without JavaScript. `sitemap.xml` (products, categories, pages, brands) and `robots.txt` are served by Django.
- **Performance:** route-level `lazy()` splitting; admin, GSAP, Swiper and Recharts load only where needed; `<img srcset>` uses WebP renditions with `loading="lazy"` and `fetchpriority="high"` on the LCP hero; fonts are preloaded with `font-display: swap`; animations touch only transform/opacity.
- **Accessibility:** skip link; focus-visible rings (burgundy and gold, double ring); every interactive custom control follows WAI-ARIA patterns (menubar for the mega menu, dialogs with focus trap and restore, listbox for suggestions, radiogroup for swatches); carousels have pause controls; alt text is required in the admin image manager; checks run with `@axe-core/playwright` against key pages in CI.

---

## 8. Emails & invoices
- **Emails** (Celery tasks, an HTML layout with a text fallback, inline-styled with the brand palette and wordmark, all copy in the Sartoria voice): welcome, password reset, password changed, newsletter confirm, order confirmation, every order status change (confirmed, packed, shipped with tracking link, out for delivery, delivered + review invitation, cancelled, payment failed with retry link), return status changes, refund processed, and staff invite. Dev uses the console backend; prod uses SMTP configured by env vars.
- **Invoices** (WeasyPrint): A4, wordmark header, store GSTIN and address from settings, invoice number series `SRT/INV/2026-27/00001`, bill-to and ship-to, HSN, rate, taxable value, CGST/SGST/IGST per line, totals in figures and words, and a payment summary. The PDF is generated when an order is placed, stored, and regenerated if edited before shipping.

---

## 9. Testing strategy
**Backend** (pytest, pytest-django, factory_boy, freezegun, responses/mocks for Razorpay):
- **Pricing:** flash-sale precedence, bundle detection, coupon types/caps/min-order/expiry/usage limits/per-user/first-order/category scope, proportional allocation summing exactly, the free-shipping threshold boundary, COD fee/limit, GST inclusive maths and the CGST/SGST vs IGST split, and rounding.
- **Checkout/stock:** a concurrent oversell test (two threads with `transaction=True` and real row locks), reservation release on expiry, failure and cancel, rejection of client-supplied totals, and an unserviceable pincode.
- **Payments:** valid and invalid signatures, webhook idempotency, webhook reconciling a closed-browser payment, and refunds.
- **State machine:** every valid transition, every invalid one (409), actor rules, side-effects (emails queued, stock restored).
- **Permissions:** a matrix test hitting every admin endpoint as anon, customer, manager and admin.
- **Other:** auth flows (reset token single-use, throttling), cart merge, CSV import validation and error report, query-count assertions on hot endpoints, and the cache-invalidation signals.

**Frontend** (Vitest + React Testing Library + MSW):
- Cart store logic, add/update/remove/save-for-later, mini-cart totals rendering, guest → login merge, wishlist toggle.
- Checkout step validation, coupon apply/reject, shipping option switching, COD vs Razorpay paths (Razorpay script mocked), and error handling for stock conflicts.
- Price/money formatting, filter ⇄ URL serialisation.

**Smoke/E2E** (Playwright, kept small): browse → add to cart → guest COD checkout → confirmation; admin login → change an order status; axe scans; Lighthouse CI run against the production build (target ≥ 90 for performance, accessibility and SEO on Home, PLP and PDP).

---

## 10. Seed data (`python manage.py seed_demo [--flush] [--no-images]`)
- Store settings (Sartoria name, tagline "Crafted with intention. Worn for a lifetime.", contact details, socials), plus CMS pages written in the brand voice.
- 10 top-level categories (Electronics, Fashion, Footwear, Home & Kitchen, Sports & Fitness, Beauty & Personal Care, Books & Stationery, Toys & Baby, Jewellery & Watches, Bags & Travel), about 45 subcategories, about 30 fictional brands (no real trademarks), and the attribute catalogue (colour, apparel/shoe sizes, storage, RAM, capacity, weight, material, pack size).
- 100 products (about 10 per top category) with realistic per-category variants (phones by storage × colour, tees by size × colour, dumbbells by weight, cookware by capacity), 3–5 images each with alt text, grouped specs, warranty and box contents for electronics, correct GST rates and HSN codes per category, return policies per category, a few bulky items, and some out-of-stock or low-stock items.
- 4 hero slides, the full homepage section set, 5 promo banners, 4 trust badges, 3 counters, 8 testimonials.
- An **active flash sale** (ending about 36h after seeding), 2 daily deals, 3 bundles, and 6 coupons (percent, fixed, min-order, expired, usage-limited, first-order).
- Shipping: Standard and Express methods, 4 zones, about 300 serviceable pincodes (metros + tier-2 cities).
- 40 customers with addresses; 150 orders spread over the last 12 months across **every status**, with matching payments, status events, invoices, 10 return requests in every return status, and 180 reviews (mostly approved, some pending).
- Staff accounts: `admin@sartoria.test` (Admin) and `manager@sartoria.test` (Manager). Passwords are printed by the seed command and set in `.env`.
- Analytics backfill so the dashboard charts are populated from the first run.

---

## 11. Extensibility for §3 (no implementation, only the seams)
- **Payment gateways:** `payments/providers/base.py` defines an abstract `PaymentProvider` (`create_payment`, `verify_client_callback`, `parse_webhook`, `refund`, `supports_*`). A registry is keyed by `PAYMENT_PROVIDERS` in settings. Adding Stripe, PayPal or UPI means adding one class and a frontend `PaymentSelector` entry.
- **Social login:** auth issues tokens through an `issue_tokens(user)` service, so an OAuth view can call it later. User has no password-only assumptions.
- **i18n / multi-currency:** UI copy lives in `src/content/*.ts` message objects, which can be swapped for i18next. Money carries an implicit `INR` through a single `formatMoney(amount, currency)` helper, and a `currency` column already exists on Order.
- **Recommendations:** `catalog/services/recommendations.py` has one `related_products(product)` entry point. The current implementation uses category, brand and co-purchase.
- **Loyalty/referrals:** the pricing engine's adjustments are an ordered pipeline (`[FlashSaleStep, BundleStep, CouponStep, ShippingStep, TaxStep]`), so a `LoyaltyStep` can be inserted.
- **Courier APIs:** `shipping/couriers/base.py` defines a `CourierAdapter` interface. Tracking currently goes through the manual adapter.
- **Mobile app:** the API is fully documented and token-based, so no web-only assumptions.

---

## 12. Build phases

Each phase ends with migrations applied, `make test` (backend + frontend) passing, the app run and clicked through, a short summary to you, and a git commit.

| Phase | Deliverables |
|---|---|
| **P0 — Foundation** | git init, monorepo skeleton, Django project with split settings, Postgres/Redis wiring, Celery, drf-spectacular, Vite + TS + Tailwind with the design-token preset (palette scales, fonts), ESLint/Prettier/ruff, pytest + Vitest set up, Makefile, `docker-compose.yml`, `.env.example`, `CLAUDE.md`, logo and monogram SVGs + favicon |
| **P1 — Accounts, settings & shell** | Custom user, roles, JWT + refresh cookie, password reset, addresses, StoreSettings + public endpoint, audit-log mixin; frontend app shell (header, mega-menu placeholder fed by the real nav endpoint, footer from settings), UI primitives, Lenis + page transitions, auth pages, account profile and addresses, 404/error pages |
| **P2 — Catalog backend + seed** | Catalog models, image renditions, FTS + trigram search, filters + facets, denormalised fields, caching; `seed_demo` (catalog part, images) |
| **P3 — Browsing storefront** | Mega menu, category landing pages, PLP (grid/list, sorting, filters + bottom sheet, URL state, pagination/infinite, skeletons), search overlay + results, product card hovers, quick view, PDP (gallery, zoom, pinch, variants, specs, shipping/returns tab, related, recently viewed, share, sticky ATC bar). *(Reviews moved to P6: verified-buyer badges need orders.)* |
| **P4 — Cart, wishlist, offers, shipping** | Pricing engine + tests, cart/wishlist APIs, guest stores + merge, mini-cart drawer, fly-to-cart, animated heart, cart page with save-for-later, coupons, flash sales/daily deals/bundles + offers pages, shipping models, pincode estimator on PDP and cart |
| **P5 — Checkout, orders, payments** | Checkout service with locking, Razorpay + COD providers, verify + webhook, reservation expiry job, order state machine, emails (Celery), WeasyPrint invoices, checkout UI with animated progress, confirmation page; seed orders |
| **P6 — Post-purchase** | Product reviews (display, submission, verified-buyer badge), account order history + detail + invoice download, cancellation, animated tracking timeline, public track-order page, returns (request with photos, status tracking), refund flow, review invitation emails |
| **P7 — Homepage & CMS** | CMS models + homepage endpoint (cached), hero slider (GSAP reveal + Ken Burns), all section types, counters, countdown, parallax banners, testimonials, newsletter with double opt-in, CMS pages; seed CMS content |
| **P8 — Admin foundation & dashboard** | Admin shell (sidebar, top bar, ⌘K search, notifications, dark mode), RoleGate, admin login, analytics endpoints + rollups, the dashboard with every KPI, chart and range picker |
| **P9 — Admin operations** | Products (form, variant matrix, drag-and-drop image manager, SEO), categories tree, brands, attributes, inventory + bulk update, orders (filters, transitions, tracking, invoices, bulk), returns + refunds, customers, reviews moderation |
| **P10 — Admin configuration** | Coupons, flash sales, bundles, all CMS screens with reorder/toggle, shipping methods/zones/pincodes, store settings (logo upload etc.), staff & roles, CSV import/export with validation report, audit log viewer, newsletter list |
| **P11 — Quality pass** | SEO (server-side meta injection, sitemap, robots, JSON-LD), Lighthouse ≥ 90 tuning, axe fixes, responsive polish at 360/768/1024/1440, reduced-motion audit, Playwright smoke suite, permission matrix test, README with setup, env, seeding, tests and deployment (gunicorn + nginx/whitenoise, Celery services, media storage notes) |

---

## 13. Dependencies (beyond those you specified)
**Backend:** django-treebeard (category tree), django-filter, django-cors-headers, django-redis, django-celery-beat, nh3 (HTML sanitising), razorpay, weasyprint, factory_boy, freezegun, pytest-django, ruff.
**Frontend:** @fontsource (self-hosted fonts), react-hook-form + zod, @tanstack/react-table, @dnd-kit, react-helmet-async, sonner (toasts), lucide-react (icons), react-day-picker, openapi-typescript, vitest + @testing-library + msw, @playwright/test + @axe-core/playwright.
