# Sartoria

A premium general store: electronics, fashion, home, sports, beauty, books, toys, jewellery and bags. It has a React storefront and a custom admin at `/admin`, and everything the shopper sees is managed from the admin: catalogue, prices, offers, homepage, pages, shipping, settings and staff.

- **Backend:** Django 5.2 + DRF, PostgreSQL 14+, Redis, Celery (worker + beat), WeasyPrint for invoices.
- **Frontend:** React 18 + Vite + TypeScript, Tailwind, TanStack Query, Zustand, Framer Motion, GSAP.
- **Payments:** Razorpay (cards, UPI, netbanking) and cash on delivery. Prices are in INR and include GST.

`PLAN.md` holds the full scope and design. `CLAUDE.md` holds the conventions, design tokens and brand voice.

---

## Requirements

| | Version |
|---|---|
| Python | 3.12+ |
| Node | 20+ (22 recommended) |
| PostgreSQL | 14+ with `pg_trgm` and `unaccent` |
| Redis | 6+ |
| WeasyPrint system libraries | Pango (`brew install pango` on macOS, `libpango-1.0-0 libpangoft2-1.0-0` on Debian/Ubuntu) |

On macOS:

```bash
brew install postgresql@14 redis pango
brew services start postgresql@14
brew services start redis
```

## First-time setup

```bash
cp .env.example .env          # then edit DJANGO_SECRET_KEY at least
make setup                    # venv, pip + npm install, create databases, migrate
make seed                     # demo catalogue, customers, orders, content (about 2 minutes)
```

Then run the services, each in its own terminal (the admin is at http://localhost:5173/admin):

```bash
make backend    # API on http://localhost:8000
make frontend   # storefront + admin on http://localhost:5173 (proxies /api and /media)
make worker     # Celery: emails, image renditions, imports, order expiry
make beat       # Celery beat: flash-sale price sync, unpaid-order expiry, review requests, daily metrics
```

For quick local runs you can skip the worker and beat and set `CELERY_TASK_ALWAYS_EAGER=true` in `.env`, so tasks run inline. Scheduled jobs (flash-sale start and end, unpaid-order expiry) only run with beat.

### Demo accounts (after `make seed`)

| Role | Email | Password |
|---|---|---|
| Admin (everything) | `admin@sartoria.test` | `Sartoria@Admin1` |
| Manager (orders, catalogue, content, no settings/staff) | `manager@sartoria.test` | `Sartoria@Manager1` |
| Customer with order history | `patron@sartoria.test` | `Sartoria@Guest1` |

The passwords come from `SEED_*_PASSWORD` in `.env`. `make seed ARGS=--flush` wipes demo data and reseeds. Product photos download once from Unsplash and are cached in `backend/seed_assets/images`.

### Docker (alternative)

`docker compose up` starts Postgres, Redis, the API, the worker, beat and the Vite dev server with the same ports. Run `docker compose exec backend python manage.py seed_demo` to load demo data.

---

## Configuration

All settings come from `.env` at the repo root (see `.env.example`).

| Variable | Purpose |
|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.dev`, `config.settings.prod` (tests use `config.settings.test`) |
| `DJANGO_SECRET_KEY` | Required. Production refuses to start with the default |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames |
| `DATABASE_URL`, `TEST_DATABASE_NAME` | Postgres connection and test database name |
| `REDIS_URL`, `CELERY_BROKER_URL` | Cache and throttles, and the Celery broker |
| `FRONTEND_URL` | Public site origin. Used in emails, canonical URLs, `sitemap.xml` and reset links |
| `BACKEND_PUBLIC_URL` | Origin that serves `/media`. Used for absolute image URLs in emails, invoices and Open Graph tags. Usually the same as `FRONTEND_URL` in production |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | Only needed if the API is on a different origin from the site |
| `REFRESH_COOKIE_SECURE` | `true` in production (forced on by `prod.py`) |
| `EMAIL_*`, `DEFAULT_FROM_EMAIL` | SMTP. Development prints emails to the console |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Online payments. Without keys, checkout offers cash on delivery only |
| `MEDIA_ROOT` | Upload directory in production |
| `CELERY_TASK_ALWAYS_EAGER` | Run tasks inline (development only) |

Store-facing text and rules (name, logo, contact details, GSTIN and state, COD fee and limit, return window, announcement bar, SEO defaults) live in **Admin → Settings**, not in env vars.

### Razorpay

1. Create test keys at dashboard.razorpay.com and put them in `.env`.
2. Add a webhook pointing to `https://<your-domain>/api/v1/payments/razorpay/webhook/` for the events `payment.captured`, `order.paid`, `payment.failed`, `refund.processed` and `refund.failed`, using `RAZORPAY_WEBHOOK_SECRET`.

Payments are verified by HMAC on both the checkout callback and the webhook. Webhooks are idempotent. A capture that arrives after an order expired is refunded automatically.

---

## Tests and checks

```bash
make test               # pytest (backend, includes the integration journeys) + Vitest (frontend)
make test-integration   # just the end-to-end business journeys
make lint               # ruff format/check, ESLint, tsc
```

The admin lives at **`/admin`** (old `/admin-panel/...` links redirect).

| Suite | What it covers |
|---|---|
| `backend/tests/` | Money and GST maths, pricing engine, checkout races, the order and returns state machines, payments and webhooks, every admin API, CSV import/export, server-side SEO, and a **permission matrix** that checks every admin endpoint against every role (`tests/admin/test_permission_matrix.py`) |
| `backend/tests/integration/` | **Business journeys over HTTP only**, with separate shopper, guest and staff clients: sign-up → address → coupon → COD checkout → fulfilment → invoice → return → refund (stock, money, emails and audit trail checked); guest online payment with forged and duplicate webhooks → staff cancellation → exactly one gateway refund; a flash sale starting mid-checkout (409 `price_changed`) and a sold-out last unit (409 `stock_changed`); an admin-created product reaching listings and search, then stock-out and deactivation |
| `frontend/src/**/*.test.tsx` | Cart, checkout, returns, homepage, and the admin screens, against MSW mocks |
| `frontend/e2e/` (Playwright) | Runs as three projects: **desktop**, **pixel-7** and **iphone-13**. Phones run the smoke journeys plus `mobile.spec.ts`: the full-screen menu, the filter sheet, buying from the sticky bar, search, admin orders as cards, and the `/admin-panel` redirect. **Smoke:** guest browse → bag → cash-on-delivery checkout → confirmation; staff sign in and confirm an order; customers kept out of the admin. **Accessibility:** axe on storefront and admin pages (light and dark) with no serious or critical issues. **Layout:** no sideways scrolling at 360/768/1024/1440 px, and reduced motion turns off smooth scrolling and the headline animation |

The end-to-end tests need the stack running with seeded data:

```bash
make e2e                                        # against the Vite dev server (:5173)
make build && E2E_BASE_URL=http://localhost:8000 make e2e   # against the production build served by Django
```

The first run needs the Playwright browser: `cd frontend && npx playwright install chromium`.

### Load testing

`loadtest/locustfile.py` models real traffic: browsing (~85%: home, departments, filtered listings, search, product pages and the server-rendered page shell), building bags (~12%: the pricing engine at different pincodes, delivery estimates) and staff in the admin (~3%). Checkout is opt-in (`LOADTEST_CHECKOUT=1`) because it creates real orders.

```bash
make build
make serve-prod LOADTEST=1                      # gunicorn + production settings on :8001 (another terminal)
make loadtest                                   # 50 users for 2 minutes; HTML report in loadtest/reports/
make loadtest USERS=500 SPAWN=25 DURATION=90s   # stress
```

Always measure gunicorn, not `runserver`. `LOADTEST=1` lifts the per-IP rate limits, which would otherwise throttle every simulated user, since they all come from one machine. In production the same limits can be tuned per deployment with `THROTTLE_<SCOPE>` env vars (for example `THROTTLE_ANON=2000/min`).

Measured on a MacBook with 4 gunicorn workers × 4 threads, seeded demo data, Postgres and Redis on the same machine:

| Users | Requests | Throughput | Median | p95 | p99 | Failures |
|---|---|---|---|---|---|---|
| 150 | 13,504 in 2 min | 113 req/s | 10 ms | 19 ms | 33 ms | 0 |
| 500 | 32,348 in 90 s | 360 req/s | 12 ms | 47 ms | 83 ms | 0 |

The slowest common reads are the server-rendered product page (p95 ≈ 46 ms at 500 users) and the admin dashboard (p95 ≈ 40 ms). Checkout averaged about 440 ms with background jobs running inline; with a Celery worker the invoice and emails leave the request path.

### Lighthouse

Run against the production build served by Django (`make build` first):

```bash
npx lighthouse http://localhost:8000/ --preset=desktop --only-categories=performance,accessibility,best-practices,seo
```

At the end of Phase 11 the home, category and product pages scored 98–100 on desktop for all four categories. The mobile preset (simulated slow 4G and 4× CPU) scored 100/98–99 for accessibility, 100 for best practices and SEO, and 76–81 for performance. The remaining mobile cost is JavaScript start-up; see the roadmap below.

---

## How the pieces fit

- **Money** is stored as integer paise everywhere. Prices include GST, and tax is extracted per line and split into CGST + SGST or IGST by the store's and the buyer's states. The server computes every total; clients send ids and quantities only.
- **Staff access is by capability** (`apps/core/permissions.py`), and `auth/me` returns the same list to the UI. Managers can't change settings, shipping, staff or delete products; admins can do everything.
- **Every admin change is audited** (Admin → Activity log).
- **Images** are validated and re-encoded on upload. WebP renditions (400–1600 px) are built in the background for product photos, category imagery, hero slides, banners and editorial sections, and served with `srcset`.
- **SEO.** In production Django serves the SPA's `index.html` for every non-API URL and fills the `<head>` with that URL's title, description, canonical link, Open Graph tags and JSON-LD (Product with offers and rating, BreadcrumbList, Organization, WebSite search). Unknown products and categories return a real 404, and private pages (cart, checkout, account, admin) are `noindex`. `sitemap.xml` and `robots.txt` come from the catalogue. The same response also:
  - preloads the page's largest image and its route chunk;
  - inlines the page's first API reads, so the first view doesn't wait on the network;
  - paints a static version of the hero or product image before the app boots.

---

## Deploying

The production shape is one Django process (gunicorn) that serves the API, the built SPA and its assets via WhiteNoise. nginx sits in front for TLS and `/media`, and Celery runs a worker and beat.

### Build

```bash
git pull
backend/.venv/bin/pip install -r backend/requirements.txt
cd frontend && npm ci && cd ..
DJANGO_SETTINGS_MODULE=config.settings.prod make build   # vite build, pre-compress (br/gz), collectstatic
DJANGO_SETTINGS_MODULE=config.settings.prod backend/.venv/bin/python backend/manage.py migrate
```

`make build` writes `frontend/dist/` (hashed assets with a `.vite/manifest.json`), pre-compresses it for WhiteNoise, and collects Django static files (fonts and email assets) into `backend/staticfiles/`.

### Processes (systemd examples)

```ini
# /etc/systemd/system/sartoria-web.service
[Service]
WorkingDirectory=/srv/sartoria/backend
EnvironmentFile=/srv/sartoria/.env
ExecStart=/srv/sartoria/backend/.venv/bin/gunicorn config.wsgi:application \
  --bind 127.0.0.1:8000 --workers 3 --threads 4 --keep-alive 10 --timeout 60 --access-logfile -
Restart=always

# /etc/systemd/system/sartoria-worker.service
ExecStart=/srv/sartoria/backend/.venv/bin/celery -A config worker -l info --concurrency 4

# /etc/systemd/system/sartoria-beat.service
ExecStart=/srv/sartoria/backend/.venv/bin/celery -A config beat -l info
```

Set `DJANGO_SETTINGS_MODULE=config.settings.prod` in `.env`. Run exactly one beat process.

### nginx

```nginx
server {
    server_name shop.example.in;
    listen 443 ssl http2;
    # ssl_certificate … (certbot)

    client_max_body_size 20m;          # product image and CSV uploads

    location /media/ {
        alias /srv/sartoria/backend/media/;
        expires 30d;                   # upload names are unique; renditions are content-hashed
        add_header Cache-Control "public";
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        gzip on;
        gzip_types application/json text/plain application/xml;
    }
}
```

Django already compresses the page shell, and WhiteNoise serves the pre-compressed assets with long-lived `immutable` caching. nginx's `gzip` above covers API JSON.

### Media storage

Uploads go to `MEDIA_ROOT` on local disk (`FileSystemStorage`). Back the directory up with the database. For multiple app servers or object storage, switch `STORAGES["default"]` in `config/settings/prod.py` to an S3-compatible backend (for example `django-storages`). Nothing else assumes local disk: renditions, invoices, import files and error reports all go through Django's storage API.

### Checklist

- `DJANGO_SECRET_KEY` is long and random, and `DJANGO_ALLOWED_HOSTS`, `FRONTEND_URL` and `BACKEND_PUBLIC_URL` use the real domain.
- SMTP is configured, and `DEFAULT_FROM_EMAIL` uses a domain with SPF/DKIM set up.
- Razorpay live keys and webhook are set up, the worker and beat are running, and Redis persists.
- Create the first admin with `python manage.py createsuperuser`, then invite colleagues from **Admin → Staff**.
- Fill in **Admin → Settings**: legal name, GSTIN and state (these decide the GST split on invoices), and contact details.

---

## Roadmap (not built yet)

These are out of scope for this release, and the code leaves room for each:

- **Mobile performance:** move animations to Framer's `LazyMotion` or CSS so less JavaScript runs before first render. This is the remaining gap to 90+ on Lighthouse's mobile preset.
- Social sign-in (all logins go through `apps.accounts.services.auth.issue_tokens`).
- More payment providers (add a provider class and register it in `settings.PAYMENT_PROVIDERS`).
- A courier API integration for live tracking (orders already store courier, number and link).
- Gift cards and store credit, plus multi-currency and multi-language.
