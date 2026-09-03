# BD SDK — Astro starter

A full generic business site built on **Astro SSR** (`output: "server"`, Node adapter). The data-fetch pattern is the cleanest of any framework — no separate proxy process, no in-browser SDK client. Each `.astro` component renders on the server and calls `bd.X.method(...)` directly during render; interactive surfaces ship a tiny inline `<script>` "island" that talks to same-origin Astro endpoints (which call the SDK). The bearer key never leaves the server.

This template is at **BD SDK feature parity** with the reference consumer (DGP-2026): marketing sections, scheduling, forms, storefront + cart + checkout, subscriptions, customer auth + portal, reviews wall, news banner, updates feed, JSON-LD + sitemap/robots, programmatic service-area pages, and graceful suspension handling.

## Why this shape

Astro's `output: "server"` mode runs every page render on the Node server (or Vercel / Cloudflare / Netlify edge — swap the adapter in `astro.config.mjs`). That puts the SDK exactly where it should be:

```
browser → page request → Astro renders → bd.gallery.list(...) → BD Package API
                                       ↑
                                       └ @businessdash/sdk + bearer key on the server
```

Every surface **degrades gracefully** when BD env is unset — pages render with placeholder/demo content or a clear "not connected" empty state instead of crashing.

## What's new (SDK 0.9.53)

Three additions, mirrored across every starter — all server endpoints or server renders, so the shape above doesn't change:

- **AEO / llms.txt** — `src/pages/llms.txt.ts` serves the answer-engine index the org curates at BD → Marketing → AI Distribution from this site's own root (`llmsTxtHandler` from `@businessdash/sdk/distribution`). The product feed needs no proxy — submit its BD URL (built by `productFeedUrl`) to merchant programs directly; `src/pages/ai/product-feed.ts` is a convenience redirect to it.
- **MCP connector proxy** — `src/pages/api/mcp.ts` (JSON-RPC) + `src/pages/.well-known/mcp.json.ts` (discovery manifest) give this self-hosted domain the same per-site MCP connector the platform serves natively, via `mcpHandler` + `mcpManifestHandler` from `@businessdash/sdk/mcp`. The URL an org hands to Claude / ChatGPT / Gemini is their own site; BD still enforces the org's MCP opt-in and per-tool write gates.
- **Relational custom collections (`/todos`)** — `bd.data-model.config.ts` declares two related collections (`todos`, and `todoImages` with a required RELATION to `todos`) with the 0.9.50+ `collection()` + `bd` builders. Push with `pnpm sync-data-model`, promote in the dashboard, set the generated "Todo Form" live, then open `/todos` — the page lists todos (images joined on, in `src/lib/bd-todos.ts`) via `dataModel.listRecords`, and creates go through the generated `todo-form` rendered by the `<bd-form>` element over the existing `/api/bd/forms/[slug]` proxy. Reads go through the data-model client, writes go through forms; there is no direct row-write API for consumers.

## Setup

```sh
bun install     # bun.lockb is committed; or npm install / pnpm install
cp .env.example .env.local
# Fill BD_API_KEY, BD_SITE_ID, BD_PACKAGE_API_BASE_URL
# (optional) BD_REVALIDATION_SECRET, BD_AUTH_CALLBACK_URL

bun run dev
```

Open http://localhost:4321 (Astro's default dev port).

For production:

```sh
bun run build      # → ./dist
bun run preview    # node ./dist/server/entry.mjs
bun run check      # astro check (typecheck)
```

## Schema sync (CLI)

`bd.config.ts` is the single source of truth for the dashboard-editable content model + brand tokens + the `service-area` parallel page. Three scripts run the SDK CLI via `tsx`:

```sh
bun run sync-schema    # publish the JSON-Schema artifact to BD's draft slot
bun run sync-content   # (optional) push a local JSON content tree up to BD
bun run print-schema   # print the resolved schema (debugging)
```

## Surfaces

### Marketing sections (home, `/`)

Composed in `src/pages/index.astro` through the shared `src/layouts/Layout.astro` shell (banner + JSON-LD + header + footer).

| Section | SDK call | Render strategy |
| --- | --- | --- |
| **Hero / About / Services** | `bd.marketing.getPageBundle({ pageKey: "home" })` | Server-only |
| **Gallery** | `bd.gallery.list({ limit, fields: [...] as const })` | Server-only, typed const-generic field selection |
| **Reviews** | aggregate + first page from `bundle.reviews`; "load more" via `/api/bd/reviews` (`reviews.list`) | Server-render + island |
| **Blog** | `bd.blog.listPosts({ limit: 6 })` | Server-only |
| **Booking** | `bd.scheduling.listEventTypes()` + `/api/bd/scheduling/*` island | Hybrid |
| **Contact form** | `bd.forms.schema(slug)` + `/api/bd/forms/[slug]` island | Hybrid |

### Storefront (`/store`)

- `src/pages/store/index.astro` — product list via `storefront.listProducts()`
- `src/pages/store/[id].astro` — product detail via `storefront.getProduct(id)` + an add-to-cart island
- `src/pages/store/cart.astro` — full cart: quantity / remove / coupon / clear / checkout, all driven by islands that POST to the cart endpoints and re-render from the returned `CartSnapshot`
- `src/pages/store/subscriptions.astro` — recurring offerings via `subscriptions.list()`

Cart mutations live in Astro API endpoints under `src/pages/api/bd/cart/*` and `checkout/start`. The shopper is identified by a **visitor token** — an httpOnly `bd_cart_visitor` cookie minted on the first mutation (`src/lib/bd-store.ts`):

| Endpoint | SDK call |
| --- | --- |
| `GET  /api/bd/cart/get` | `cart.forVisitor(t).get()` (read-only, no mint) |
| `POST /api/bd/cart/add` | `cart.forVisitor(t).addItem(...)` (mints cookie) |
| `POST /api/bd/cart/update` | `cart.forVisitor(t).updateItem(id, { quantity })` |
| `POST /api/bd/cart/remove` | `cart.forVisitor(t).removeItem(id)` |
| `POST /api/bd/cart/coupon` | `applyCoupon({ code })` / `removeCoupon()` |
| `POST /api/bd/cart/clear` | `cart.forVisitor(t).clear()` |
| `POST /api/bd/checkout/start` | `checkout.forVisitor(t).start({ successUrl, cancelUrl })` → Stripe redirect |

### Auth + customer portal

- **Auth handler** — `src/pages/api/bd-auth/[...slug].ts` mounts `createAuthHandler` as a catch-all. Astro hands an `APIRoute` a web `Request` and expects a web `Response`, which is exactly the handler's `GET`/`POST` shape, so the request passes straight through. It serves `sign-in`, `sign-up`, `callback`, `sign-out`, `password-reset`, `me` and sets the `bd_session` httpOnly cookie.
- **Header links** — `src/components/Header.astro` reads the session server-side and renders plain `<a href="/api/bd-auth/sign-in">` / `sign-up` / `sign-out` links plus the live cart count.
- **My account** — `src/pages/my-account.astro` reads the `bd_session` cookie via `getTenantSession` (`src/lib/bd-portal.ts`), shows the user + their work bundle (`customerPortal(org).withSession(token).getWork()` → jobs / quotes / invoices), and a review-submit form that posts to `/api/bd/portal/submit-review` (which calls the portal's `submitReview`).

### Reviews wall (`/reviews`)

`src/pages/reviews.astro` reuses the `Reviews` section (aggregate from `bundle.reviews` + first page, then a "load more" island paginating `/api/bd/reviews` → `reviews.list({ offset, limit })`).

### News banner + updates feed

- **Banner** — `src/components/Banner.astro` renders `bundle.banner` as a dismissible strip (rendered in the layout). Untyped passthrough mirrored locally in `src/lib/bd-bundle.ts`.
- **Updates** — `src/pages/updates.astro` lists `bundle.updates` (Google-Business-style posts).

### SEO

- **JSON-LD** — `src/lib/bd-seo.ts` builds `localBusiness` + `website` nodes (from `@businessdash/sdk/seo`) off the bundle's company profile and injects them into `<head>` server-side via the layout.
- **`src/pages/sitemap.xml.ts`** and **`src/pages/robots.txt.ts`** proxy the BD endpoints (`parallelPages.sitemapUrl()` / `.robotsUrl()` resolved against the API base URL), forwarding the bearer key and falling back to a valid empty/permissive document when unconfigured.

### Programmatic service-area pages

- `src/pages/services/index.astro` — enumerates every `(service × area)` variant via `parallelPages.listVariants("service-area")` and links to each URL.
- `src/pages/services/[service]/[area].astro` — SSR-renders one variant via `parallelPages.render("service-area", { service, area })` (`getStaticPaths` is unidiomatic under `output: "server"`), rendering `meta.title` / `description` / `canonical` / `ogImage` + the resolved body.

### Suspension handling

`src/lib/bd-suspension.ts` catches `BdPaymentLapsedError` / `BdServiceSuspendedError` around store / parallel-page reads and returns a minimal **503 "site unavailable"** document instead of a broken page.

## Webhook revalidation (built in)

`src/pages/api/bd/revalidate.ts` mounts the `@businessdash/sdk/adapters/revalidate` handler. Register this URL in BD at `/dashboard/settings/integrations`, paste the revealed `whsec_…` into `BD_REVALIDATION_SECRET`, and the route verifies HMAC + replay window and invokes the callback on every BD publish. Astro SSR re-fetches on every render so the callback is a logger today; wire your cache invalidation there when you add response-level caching.

## Environment

| Var | Required for | Notes |
| --- | --- | --- |
| `BD_API_KEY` | everything | Server-side bearer key; never exposed to the browser |
| `BD_SITE_ID` | everything | The site UUID this app represents |
| `BD_PACKAGE_API_BASE_URL` | everything | e.g. `https://www.biab.app` (normalized to `…/api/package/v1`) |
| `BD_REVALIDATION_SECRET` | revalidate webhook | `whsec_…` from Settings → Integrations |
| `BD_AUTH_CALLBACK_URL` | auth + portal | Public `…/api/bd-auth/callback`, registered as a WorkOS redirect URI |
| `PUBLIC_BD_SITE_ID` / `PUBLIC_BD_PACKAGE_API_BASE_URL` / `PUBLIC_BD_PUBLIC_KEY` | client analytics | Optional; boots `initBdAnalytics` in the browser |

## Project layout

```
.
├── astro.config.mjs                  # output: "server", Node adapter
├── bd.config.ts                    # schema + brand tokens + service-area parallel page
├── src/
│   ├── lib/
│   │   ├── bd.ts                    # server createBdClient + getBdEnv()
│   │   ├── bd-bundle.ts             # bundle fetch + banner / updates / reviews extraction
│   │   ├── bd-store.ts              # storefront / cart / checkout / subscriptions helpers
│   │   ├── bd-portal.ts             # session + customer-portal (getWork / submitReview)
│   │   ├── bd-seo.ts                # localBusiness + website JSON-LD
│   │   └── bd-suspension.ts         # payment-lapsed / service-suspended handling
│   ├── layouts/Layout.astro           # shared shell: banner + JSON-LD + header + footer
│   ├── styles/global.css              # BD tokens + section styles
│   ├── components/
│   │   ├── Header.astro               # nav + cart count + auth links (server session)
│   │   ├── Banner.astro               # bundle.banner dismissible strip
│   │   ├── Hero / About / Services / Gallery / Blog / Booking / ContactForm / Reviews
│   │   └── Footer.astro
│   └── pages/
│       ├── index.astro                # home (marketing sections)
│       ├── reviews.astro              # reviews wall
│       ├── updates.astro              # updates feed (bundle.updates)
│       ├── my-account.astro           # customer portal
│       ├── sitemap.xml.ts             # proxy → BD sitemap
│       ├── robots.txt.ts              # proxy → BD robots
│       ├── store/
│       │   ├── index.astro            # product list
│       │   ├── [id].astro             # product detail + add-to-cart island
│       │   ├── cart.astro             # cart (update/remove/coupon/clear/checkout)
│       │   └── subscriptions.astro    # subscription offerings
│       ├── services/
│       │   ├── index.astro            # service-area variant index
│       │   └── [service]/[area].astro # programmatic service-area page
│       └── api/
│           ├── bd-auth/[...slug].ts # createAuthHandler catch-all
│           └── bd/
│               ├── revalidate.ts      # webhook receiver
│               ├── reviews.ts         # GET — paginate reviews.list
│               ├── scheduling/        # slots.ts (GET) + bookings.ts (POST)
│               ├── forms/[slug].ts    # POST — submit a form
│               ├── portal/submit-review.ts  # POST — customer review via portal
│               ├── cart/              # get / add / update / remove / coupon / clear
│               └── checkout/start.ts  # POST — start Stripe checkout
├── .env.example
└── package.json
```

## Adding a new SDK surface

1. **Server-only section** — a `.astro` component that imports `bd` from `../lib/bd` and calls a method in the frontmatter, with a local fallback.
2. **Interactive section** — an Astro endpoint under `src/pages/api/bd/<route>.ts` that wraps the SDK call, plus a component `<script>` island that `fetch()`es it. (Mutations that need a stable visitor identity should mint the `bd_cart_visitor` cookie via `ensureVisitorToken(cookies)`.)

## Swapping the adapter

The starter ships with `@astrojs/node` for portability. To deploy elsewhere, swap the adapter in `astro.config.mjs`:

```ts
// Vercel
import vercel from "@astrojs/vercel";
export default defineConfig({ output: "server", adapter: vercel() });

// Cloudflare
import cloudflare from "@astrojs/cloudflare";
export default defineConfig({ output: "server", adapter: cloudflare() });
```

The component layer doesn't change — only the runtime where the SDK calls happen.


## Where your content comes from

Nothing business-specific is hardcoded in this template — it all comes from BD,
through **two distinct sources**. Keep them straight:

### 1. Company Profile — managed in the dashboard

Your **service hours, service areas, payment options, warranties, social links,
and phone number** are edited in your BD dashboard under
**Settings → Company Profile**, and arrive on the marketing bundle. Read them off
the bundle — never hardcode them in this template:

```ts
const bundle = await client.marketing.getPageBundle({ pageKey, locale });
bundle.company.profile.operationHours; // service hours
bundle.company.profile.serviceAreas;   // areas served
bundle.company.profile.paymentOptions; // accepted payments
bundle.company.profile.warranties;     // warranty terms
bundle.company.profile.socials;        // footer social links
bundle.company.profile.phone;          // footer phone
```

Change them in the dashboard and the site follows. They are **not** part of the
content sync below.

### 2. Marketing content — schema + content sync

Your page copy (hero, about, services, …) is declared as a schema in
`bd.config.ts` and seeded from `src/content/<locale>/…`. Push both with the
package scripts:

```sh
sync-schema    # push the content SCHEMA to BD's draft slot, then promote it in the dashboard
sync-content   # seed the section VALUES from src/content/**
```

Put one JSON file per section under `src/content/<locale>/<page>/<section>.json`
(matching `bd.config.ts`), then run `sync-content`. Edit and re-run any time.

## Data: environment, schema, seeding, CRUD

Everything below is the same in every starter — the CLI and the seed module are
the same tools whatever language the app is written in.

### 1. Environment variables

Three, from **Dashboard → Developers → API keys**:

| Variable | What it is |
|---|---|
| `BD_API_KEY` | The key. **Server-side only** unless it is a publishable key. |
| `BD_SITE_ID` | Which site this app is. |
| `BD_PACKAGE_API_BASE_URL` | e.g. `https://businessdash.us/api/package/v1` |

> A **secret** key must never reach the browser. If this starter renders on the
> client, use a publishable key — it carries a narrower scope set on purpose, so
> the worst case of a leak is bounded.

Copy `.env.example` to `.env.local` (or `.env`) and fill them in.

### 2. Define and push a schema

`businessdash.data-model.config.ts` describes the org's custom database.

```sh
npx tsx node_modules/@businessdash/sdk/dist/cli.js sync-data-model --dry-run
npx tsx node_modules/@businessdash/sdk/dist/cli.js sync-data-model
```

`--dry-run` prints the migration plan and uploads nothing — run it first, and
run it on pull requests.

> A push lands in the **draft** slot. Promotion stays a deliberate step in the
> dashboard (Site Builder → Site Data → Database). Nothing in the CLI can
> promote a draft, which is what keeps an automated deploy from dropping a
> customer's column.

### 3. Seed data

One file describes the lot — schema, records, static collections, products,
blog posts and coupons:

```ts
// businessdash.seed.ts
import { defineSeed } from '@businessdash/sdk/seed'
import { schema } from './businessdash.data-model.config'

export default defineSeed({
  dataModel: schema,
  records: { projects: [{ title: 'Riverside retrofit', status: 'active' }] },
  collections: [{ name: 'FAQs', rows: [{ data: { q: 'Do you travel?', a: 'Yes.' } }] }],
  products: [{ name: 'Thermal survey', variants: [{ name: 'Standard', price: 249 }] }],
  posts: [{ title: 'Why retrofit surveys pay', slug: 'retrofit-surveys', content: '…' }],
  coupons: [{ code: 'WELCOME10', discountType: 'percent', value: 10 }],
})
```

```sh
npx tsx node_modules/@businessdash/sdk/dist/cli.js seed --dry-run
npx tsx node_modules/@businessdash/sdk/dist/cli.js seed
```

Four behaviours worth knowing before you run it:

- **It refuses a destructive plan** by default and names the change. Pass
  `--yes` once you have decided.
- **Products and posts are created unpublished.** Seeding should not push a
  half-configured catalogue to a live storefront, or drafts to every follower's
  inbox.
- **Re-running is safe.** A duplicate coupon code or post slug is *reported*,
  not thrown, so a conflict on the third of ten does not abandon the other
  seven.
- **Products are not pushed to Stripe.** That is a separate, explicit call,
  because it mints objects in an account you are billed against.

### 4. Forms

Forms are defined in the dashboard and fetched by slug — the schema drives the
rendering, so a field added there appears here without a deploy.

```sh
npx tsx node_modules/@businessdash/sdk/dist/cli.js sync-schema
```

### 5. CRUD against the custom database

**Reads** are on the site client:

```ts
const site = client.site(process.env.BD_SITE_ID!)

const page = await site.dataModel.listRecords({ object: 'projects' })
const everything = await site.dataModel.listAllRecords({ object: 'projects' })
```

**Writes** go through the seed module rather than a per-row method:

```ts
import { seedRecords, seedTargetFromEnv } from '@businessdash/sdk/seed'

await seedRecords(seedTargetFromEnv(), {
  projects: [
    {
      // Idempotent: a re-run updates this row rather than creating a second.
      universalIdentifier: 'riverside-retrofit',
      values: { title: 'Riverside retrofit', status: 'complete' },
    },
  ],
})
```

That is deliberate — writes are batched and keyed on row identity, so the same
call works for one row or nine hundred and re-running a deploy does not
duplicate anything.

Reads need the `data_model:read` scope, writes `data_model:write`.
