# BIAB SDK — Angular starter

The same generic business site as the other BIAB starters (React-Bun, Astro, Vanilla-JS, Nuxt), built on **Angular 21 standalone components + signals** with **SSR (Express) + client hydration**, and brought to full BIAB SDK parity with the reference consumer.

## What's new (SDK 0.9.53)

Three additions, all mounted on the Express SSR server (`src/server/biab-api.ts`) with the SDK's web-standard `Request → Response` handlers bridged the same way as the auth handler:

- **AEO / `llms.txt`** — `GET /llms.txt` serves the org-curated llms.txt (Dashboard → Marketing → AI Distribution) from this domain's root via `llmsTxtHandler` from `@businessdash/sdk/distribution` — the only place AI crawlers look for it. The companion **product feed** needs no route: build its URL with `productFeedUrl({ siteId, baseUrl })` and submit it straight to merchant/feed programs (it's an OpenAI merchant-feed-shaped artifact, submittable as-is).
- **MCP connector proxy** — `POST /api/mcp` (JSON-RPC, with the spec's 405 on GET) and `GET /.well-known/mcp.json` (discovery manifest) via `mcpHandler` / `mcpManifestHandler` from `@businessdash/sdk/mcp`, so the URL an org hands to Claude / ChatGPT / Gemini is *this site's* `/api/mcp`. Thin by design — the platform still enforces the org's MCP opt-in and per-tool write gates. These take the BIAB app *origin* (`getBiabHostBase()`), not the package API base.
- **Todos — relational custom-collections demo** — `biab.data-model.config.ts` declares two collections with the `collection()` + `bd` builders: `todos` (title / done / notes) and `todoImages`, whose `todo` field is a **relation** back to `todos`. `pnpm sync-data-model` pushes the model (promote it in the dashboard, then set the generated "Todo Form" Live). The lazy `/todos` route (`src/app/pages/todos.page.ts`, signals + OnPush) lists todos with their images via `GET /api/biab/todos`, where the server reads both collections through `dataModel.listRecords({ object })` and joins the relation links; `POST /api/biab/todos` creates one by submitting the generated form via `biab.forms.submit` — the SDK's documented create path for custom collections. Reads need the `metadata:read_records` scope on your key; the browser still holds **no SDK, no key**.

```sh
pnpm sync-data-model    # push the todos data model (+ generated form) to BIAB's draft slot
pnpm print-data-model   # print the resolved data model as JSON
```

## Architecture: the API key never reaches the browser

The BIAB package API key is an org-bound **server secret**. This template keeps it on the Node SSR server only. The Angular browser bundle talks exclusively to a small set of local JSON endpoints; those endpoints hold the key and call `@businessdash/sdk`.

```
browser (Angular SPA)                 Node SSR server (Express)            BIAB Package API
─────────────────────                 ─────────────────────────            ────────────────
fetch /api/biab/*          ───────▶   src/server/biab-api.ts      ───────▶  @businessdash/sdk
BiabService (signals)                 + tag-keyed TTL cache                  (apiKey: Bearer)
biab-api.client.ts                    + createAuthHandler
                                       + revalidate webhook
                                       + sitemap/robots proxy
                                       + JSON-LD head injection
```

- `src/server/biab-server.ts` — the SDK client factory, env resolution, the **in-memory tag-keyed TTL cache**, suspension guard (`BiabPaymentLapsedError` / `BiabServiceSuspendedError`), and the customer-portal session resolver. Server-only.
- `src/server/biab-api.ts` — every Express endpoint the browser calls (mounted in `src/server.ts`).
- `src/server/biab-seo.ts` — server-built `localBusiness` + `website` JSON-LD, injected into the home `<head>`.
- `src/app/lib/biab-api.client.ts` — the browser's typed `fetch` client for the endpoints above. **No SDK, no key.**

Everything **no-ops gracefully** when BIAB env is unset: the endpoints answer with empty/placeholder shapes and the components keep their demo content.

## Setup

```sh
pnpm install --ignore-workspace   # standalone install → this template's own SDK 0.9.5
cp .env.example .env              # the Node server reads process.env
# Fill BIAB_API_KEY, BIAB_SITE_ID, BIAB_PACKAGE_API_BASE_URL

pnpm start                        # ng serve (dev) on http://localhost:4200
```

For production SSR:

```sh
pnpm build
node dist/Angular/server/server.mjs   # honours PORT (default 4000)
```

> **SSR host allow-list.** `angular.json → security.allowedHosts` ships empty, which makes Angular fall back to client-side rendering for unknown hosts (the JSON-LD head injection runs only on true server render). Add your dev/prod hostnames there to enable full SSR, e.g. `"allowedHosts": ["localhost", "www.your-site.com"]`.

## CLI scripts (schema sync)

```sh
pnpm sync-schema    # publish biab.config.ts schema to BIAB's draft slot
pnpm sync-content   # (optional) push local JSON content to BIAB
pnpm print-schema   # print the resolved schema as JSON
```

These run the SDK CLI via `tsx` against `biab.config.ts` (the marketing schema + brand tokens + managed-data sections + the `service-area` parallel page).

## Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `BIAB_API_KEY` | yes | Per-site package key. **Server-side only.** |
| `BIAB_SITE_ID` | yes | Your site uuid. |
| `BIAB_PACKAGE_API_BASE_URL` | yes | BIAB origin (default `https://www.biab.app`). |
| `BIAB_REVALIDATION_SECRET` | for webhook | HMAC secret (`whsec_…`) for `/api/biab/revalidate`. |
| `BIAB_AUTH_CALLBACK_URL` | for auth | Public URL of `/api/biab-auth/callback` (a WorkOS redirect URI). |
| `BIAB_PUBLIC_ANALYTICS_KEY` | optional | The **only** key ever sent to the browser, for client analytics. Leave blank to keep analytics off. |

## Routes (Angular Router)

| Path | Component | What it shows |
| --- | --- | --- |
| `/` | `pages/home.page.ts` | Hero, About, Services, reviews teaser, updates, blog, contact. |
| `/store` | `pages/store.page.ts` | Storefront product list + add-to-cart + load-more. |
| `/store/:id` | `pages/product-detail.page.ts` | Product detail + add-to-cart. |
| `/cart` | `pages/cart.page.ts` | Cart: qty update/remove, coupon apply/remove (reactive form), clear, Stripe checkout. |
| `/subscriptions` | `pages/subscriptions.page.ts` | Recurring plans list. |
| `/my-account` | `pages/my-account.page.ts` | Signed-in user + work bundle (jobs) + review-submit form. |
| `/reviews` | `pages/reviews.page.ts` | Reviews wall: aggregate + paginated load-more. |
| `/updates` | `pages/updates.page.ts` | News/updates feed (`bundle.updates`). |
| `/booking` | `pages/booking.page.ts` | Scheduling: event types → slots → confirm booking. |
| `/services` | `pages/services-index.page.ts` | Lists `service × area` parallel-page variants. |
| `/services/:service/:area` | `pages/service-area.page.ts` | Renders one programmatic SEO page (`parallelPages.render`). |

All page routes are lazy (`loadComponent`). The app shell (`src/app/app.ts` + `app.html`) is the dismissible **news banner** (`bundle.banner`) + header nav + `<router-outlet>` + footer.

## Server endpoints (browser → server)

Mounted by `mountBiabApi(app)` in `src/server.ts`, all in `src/server/biab-api.ts`:

| Method + path | SDK surface |
| --- | --- |
| `GET /api/biab/home` | `marketing.getPageBundle` → hero/about/services/reviews/banner/updates |
| `GET /api/biab/blog` | `blog.listPosts` |
| `GET /api/biab/store/products` `…/:id` | `storefront.listProducts` / `getProduct` |
| `GET /api/biab/subscriptions` | `subscriptions.list` |
| `GET /api/biab/cart`, `POST …/items`, `PATCH/DELETE …/items/:id`, `POST/DELETE …/coupon`, `POST …/clear` | `cart.forVisitor(token).*` |
| `POST /api/biab/checkout/start` | `checkout.forVisitor(token).start` → Stripe URL |
| `POST /api/biab/contact` | `forms.submit(slug, data, opts)` |
| `GET /api/biab/reviews` | `reviews.list({ limit, offset })` |
| `GET /api/biab/portal/me` | `getTenantSession` + `customerPortal(org).withSession(token).getWork` |
| `POST /api/biab/portal/review` | `customerPortal(…).submitReview` |
| `GET /api/biab/scheduling/event-types` `…/:slug/slots` `POST …/:slug/book` | `scheduling.*` |
| `GET /api/biab/services` `…/:service/:area` | `parallelPages.listVariants` / `render` |
| `GET /api/biab/public-config` | browser-safe config (analytics key only, never the server key) |
| `ALL /api/biab-auth/{*splat}` | `createAuthHandler` (sign-in/up/out/callback/me) |
| `POST /api/biab/revalidate` | `createGenericRevalidateHandler` (HMAC-verified) |
| `GET /sitemap.xml`, `/robots.txt` | proxied from `parallelPages.sitemapUrl()` / `robotsUrl()` |

### Cart visitor token

Cart mutations mint an httpOnly `biab_cart_visitor` cookie (UUID, 180-day) on first write, then bind every cart call with `cart.forVisitor(token)`.

### Revalidation webhook (real cache purge)

`POST /api/biab/revalidate` verifies the BIAB HMAC over the **raw** request body, then `onTagsRevalidated(tags)` drops every entry in the server's tag-keyed TTL cache whose tags intersect — so the webhook actually invalidates, it isn't decorative. Register the endpoint + `BIAB_REVALIDATION_SECRET` in your BIAB dashboard integrations.

### Auth + customer portal

`createAuthHandler` is mounted at `/api/biab-auth/*`. Sign-in / sign-up / sign-out are plain links (`<a href="/api/biab-auth/sign-in">`) that 302 through WorkOS; the handler sets an httpOnly `biab_session` cookie. `/my-account` reads it server-side and renders the user, their work bundle, and a review form.

### SEO

`localBusiness` + `website` JSON-LD is built server-side from the marketing bundle and spliced into the home `<head>` (see `src/server.ts`). `sitemap.xml` / `robots.txt` proxy the BIAB-generated artifacts.

### Suspension handling

Every server-side SDK read is wrapped in `runGuarded(...)`. `BiabPaymentLapsedError` / `BiabServiceSuspendedError` become a `503 { unavailable: true }` response, which the store/product pages render as a minimal "temporarily unavailable" state instead of crashing.

## File map

```
src/
├── server.ts                       # Express: mounts BIAB API, serves SSR, injects JSON-LD
├── server/
│   ├── biab-server.ts              # SDK client + TTL cache + suspension guard + session
│   ├── biab-api.ts                 # all /api/biab* + /api/biab-auth + sitemap/robots endpoints
│   └── biab-seo.ts                 # localBusiness + website JSON-LD for the home head
├── styles.scss                     # global visual language (reaches routed components)
└── app/
    ├── app.ts / app.html           # shell: banner + header + <router-outlet> + footer
    ├── app.routes.ts               # lazy routes for every surface
    ├── app.routes.server.ts        # RenderMode.Server (live per-request data)
    ├── app.config.ts               # router + hydration + analytics (via /public-config)
    ├── lib/
    │   ├── biab-api.client.ts      # browser → /api/biab* fetch client (no key)
    │   └── biab.service.ts         # signals facade (hero/about/services/blog/banner/updates/reviews)
    ├── pages/                       # store, product-detail, cart, subscriptions,
    │   └── …                        # my-account, reviews, updates, booking,
    │                                # services-index, service-area, home
    └── sections/                    # hero, about, services, reviews-summary, updates,
        └── …                        # blog, contact-form, news-banner, header, footer
```

## Angular conventions

Standalone components, `ChangeDetectionStrategy.OnPush`, signals + `computed()`, `input()`/`output()` where applicable, native control flow (`@if`/`@for`), `inject()`, Reactive forms (contact, coupon, review, booking). No NgModules, no `ngClass`/`ngStyle`.

## Extending

Add a surface in three steps: (1) add a server endpoint in `src/server/biab-api.ts` calling the SDK, (2) add a method to `src/app/lib/biab-api.client.ts`, (3) add a lazy route + page component. Keep all key-bearing code under `src/server/`.


## Where your content comes from

Nothing business-specific is hardcoded in this template — it all comes from BIAB,
through **two distinct sources**. Keep them straight:

### 1. Company Profile — managed in the dashboard

Your **service hours, service areas, payment options, warranties, social links,
and phone number** are edited in your BIAB dashboard under
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
`biab.config.ts` and seeded from `src/content/<locale>/…`. Push both with the
package scripts:

```sh
sync-schema    # push the content SCHEMA to BIAB's draft slot, then promote it in the dashboard
sync-content   # seed the section VALUES from src/content/**
```

Put one JSON file per section under `src/content/<locale>/<page>/<section>.json`
(matching `biab.config.ts`), then run `sync-content`. Edit and re-run any time.

## Data: environment, schema, seeding, CRUD

Everything below is the same in every starter — the CLI and the seed module are
the same tools whatever language the app is written in.

### 1. Environment variables

Three, from **Dashboard → Developers → API keys**:

| Variable | What it is |
|---|---|
| `BIAB_API_KEY` | The key. **Server-side only** unless it is a publishable key. |
| `BIAB_SITE_ID` | Which site this app is. |
| `BIAB_PACKAGE_API_BASE_URL` | e.g. `https://businessdash.us/api/package/v1` |

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
const site = client.site(process.env.BIAB_SITE_ID!)

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
