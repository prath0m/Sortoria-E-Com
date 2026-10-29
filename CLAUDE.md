# Sartoria — working notes

Premium general store (electronics, fashion, home, sports, beauty, books, toys, jewellery, bags) with a React storefront and a custom admin at `/admin-panel`. Full plan and scope: `PLAN.md`.

## Stack
- **Backend** `backend/`: Django 5.2, DRF, SimpleJWT, PostgreSQL 14+ (FTS + pg_trgm), Redis (cache, throttles, Celery broker), Celery + beat, WeasyPrint, Pillow, drf-spectacular, django-treebeard.
- **Frontend** `frontend/`: React 18 + Vite 6 + TypeScript, Tailwind 3.4, React Router 6, TanStack Query 5, Zustand 5, Framer Motion, GSAP + ScrollTrigger, Lenis, Swiper, Recharts 3, React Hook Form + Zod, TanStack Table, dnd-kit, sonner, lucide-react.

## Commands (from repo root)
| Task | Command |
|---|---|
| First-time setup | `make setup` |
| Run API (:8000) / web (:5173, proxies `/api` + `/media`) | `make backend` / `make frontend` |
| Celery worker / beat | `make worker` / `make beat` (or set `CELERY_TASK_ALWAYS_EAGER=true`) |
| Demo data | `make seed` (`make seed ARGS=--flush` to wipe) |
| Tests | `make test` (pytest in `backend/`, Vitest in `frontend/`) |
| Lint | `make lint` (ruff + eslint + tsc) |
| Regenerate API types | `make gen-api` (backend must be running) |
| Regenerate logo assets | `make brand` |
| Production build (served by Django on :8000) | `make build` |
| Playwright smoke/axe/layout (stack running, seeded) | `make e2e` (`E2E_BASE_URL=http://localhost:8000` for the build) |

Local services: Homebrew `postgresql@14` and `redis` (`brew services start …`). Docker Compose is provided for machines with Docker.

## Folder structure
```
backend/config/settings/{base,dev,test,prod}.py   env-driven settings; .env lives at repo root
backend/apps/<app>/{models,serializers,views,urls,admin_views,services/,tasks,signals}.py
backend/apps/core/        StoreSettings, AuditLog, notifications, permissions (capabilities), money, caching, images
backend/tests/<app>/      pytest; shared factories in tests/factories.py
frontend/src/app/         entry, router, providers
frontend/src/api/         fetch client, query keys, hooks per domain
frontend/src/stores/      Zustand (cart, wishlist, auth, ui, recentlyViewed)
frontend/src/components/{ui,brand,motion}/
frontend/src/features/storefront/<area>/ and features/admin/<area>/
frontend/src/content/     brand-voice copy that isn't admin-managed (microcopy, empty states)
```

## Backend conventions
- **Money is integer paise** (`*_paise`, `PositiveBigIntegerField`). Never floats or Decimals. Format only at the edge (`apps.core.money.rupees`, `formatMoney` on the frontend).
- **Prices are GST-inclusive.** Tax is extracted with `inclusive_tax()`. Discounts are split across lines with `allocate()` (largest remainder) so the paise always add up.
- **The server computes every total.** Clients send ids, quantities, codes and choices, never amounts. All totals come from `apps.cart.services.pricing.price_cart`.
- **Business logic lives in `services/`.** Views stay thin. Raise `DomainError` / `ConflictError` (`apps.core.exceptions`) for rule violations, and the API returns `{detail, code, ...extra}`.
- **Staff access is by capability**, not role checks: use `HasCapability("orders.view", "orders.manage")` from `apps.core.permissions`. `auth/me` returns the same capability list to the UI.
- **Admin write viewsets mix in `AuditedViewSetMixin`.** Custom actions call `apps.core.audit.record(...)`.
- **Caching:** use `apps.core.caching.cached(namespace, key, fn)`, and invalidate with `bump(namespace)` from signals.
- **No N+1 queries:** list querysets use `select_related`/`prefetch_related`, and hot endpoints have query-count tests.
- **Store-facing text and settings come from the DB** (`StoreSettings`, the CMS models). Never hardcode the store name, contact details or policies.
- API prefix is `/api/v1/`, admin endpoints are under `/api/v1/admin/`, and docs are at `/api/docs/`.
- **Server-side SEO lives in `apps/core/seo.py`.** A new public route that should be indexed needs entries in `ROUTES` (meta), `ROUTE_MODULES` (chunk preload) and, if it reads data on first load, `INLINE_DATA` (keys must match the client's `path + buildQuery()` exactly). Private routes go in `PRIVATE_PREFIXES`.
- New admin endpoints must be added to `tests/admin/test_permission_matrix.py`.

## Frontend conventions
- Import with `@/` aliases. Merge classes with `cn()`.
- Server state lives in TanStack Query (keys in `api/queryKeys.ts`). Zustand holds only client state: the guest cart and wishlist, UI state, and recently viewed items.
- Forms use React Hook Form + Zod. Server field errors are mapped onto inputs.
- Every data view has a skeleton, an empty state and an error state.
- Motion: animate only transform and opacity. Use `useReducedMotion()`: Lenis turns off and GSAP and Framer animations collapse to simple fades. Shared easing is `ease-luxe` / `motion.ts`.
- Code-split each route with `lazy()`. The admin, GSAP, Swiper and Recharts must not load in the storefront's initial bundle.
- First-load queries read server-inlined data via `initialData: () => peekInlined(key)` so the first render has it (no skeleton flash, no layout shift).

## Design tokens
| Token | Value | Use |
|---|---|---|
| `burgundy-800` | `#590907` | Primary: headings, primary buttons, nav, footer |
| `sage-400` | `#A5A79B` | Borders, secondary surfaces. **Never text** (2.1:1 on cream) |
| `gold-300` | `#E8D258` | Accent fills only: badges, stars, underlines, countdown. **Never text on cream** (1.3:1). Fine as text on burgundy (9.4:1) |
| `cream-100` | `#F3EDE2` | Page background (`bg-surface`) |
| `ink` | `#2A1413` | Body text (14.9:1) |
| `ink-soft` | `#4A3331` | Secondary text (10:1) |
| `ink-muted` = `sage-800` | `#61635B` | Lightest allowed text on cream (5.2:1). sage-700 fails AA |
- Semantic tokens (`surface`, `line`, `primary`, `accent`, `ink-*`) are remapped under `.dark` for the admin dark mode. Admin UI uses the semantic tokens; the storefront may use the brand scales directly.
- Fonts: Cormorant Garamond (`font-display`, 500/600, italic accents) and Manrope (`font-sans`). Display sizes are `text-display-{sm..2xl}`. Labels use the `.eyebrow` class.
- Radii are restrained (2–8px). Borders are 1px `border-line`. Shadows: `shadow-soft`, `shadow-lift`. Hero texture: `.grain`.
- Logo: `components/brand/Logo.tsx` (wordmark) and `Monogram`, generated from font outlines by `scripts/build_brand_assets.py`. An uploaded logo in Store Settings overrides them.

## Brand voice
Refined, warm and confident. Short sentences, concrete and sensory, never salesy or shouty. Say "patrons" sparingly, and don't use exclamation marks in UI copy. Examples: empty cart → "Your bag is waiting to be filled." 404 → "This page has wandered off the pattern."

## Workflow
Build in the phases in `PLAN.md` §12. After each phase, run `make test` and `make lint`, run the app, then commit. No TODOs or stub functions in completed phases.
