# BIAB SDK — SvelteKit starter

Same generic business site as the React-Bun / Vanilla-JS / Astro starters, built on **SvelteKit SSR** with **Svelte 5 runes**. SvelteKit pages render on the server, so the SDK lives at `src/lib/server/biab.ts` and the page's `+page.server.ts` `load()` function calls it directly. This template demonstrates the full BIAB SDK surface DGP-2026 (the reference consumer) uses, in SvelteKit idioms.

## What's new (SDK 0.9.53)

Three additions, each in the same `+server.ts` / `load()` / form-action idioms as the rest of the template:

- **AEO / `llms.txt`** — `src/routes/llms.txt/+server.ts` serves the org-curated llms.txt (Dashboard → Marketing → AI Distribution) from this domain's root via `llmsTxtHandler` from `@businessdash/sdk/distribution` — the only place AI crawlers look for it. The companion **product feed** needs no route: build its URL with `productFeedUrl({ siteId, baseUrl })` and submit it straight to merchant/feed programs (it's an OpenAI merchant-feed-shaped artifact, submittable as-is).
- **MCP connector proxy** — `src/routes/api/mcp/+server.ts` (JSON-RPC POST + spec-correct 405 GET) and `src/routes/.well-known/mcp.json/+server.ts` (discovery manifest) mount `mcpHandler` / `mcpManifestHandler` from `@businessdash/sdk/mcp`, so the URL an org hands to Claude / ChatGPT / Gemini is *this site's* `/api/mcp`. The SDK handlers are web-standard `Request → Response`, which is exactly SvelteKit's endpoint contract — no bridging at all. Shared env resolution lives in `src/lib/server/biab-ai.ts` (these take the BIAB app *origin*, not the package API base).
- **Todos — relational custom-collections demo** — `biab.data-model.config.ts` declares two collections with the `collection()` + `bd` builders: `todos` (title / done / notes) and `todoImages`, whose `todo` field is a **relation** back to `todos`. `npm run sync-data-model` pushes the model (promote it in the dashboard, then set the generated "Todo Form" Live). `/todos` loads both collections in `+page.server.ts` via `dataModel.listRecords({ object })` — relations come back as links and are joined in the load — and creates todos through a SvelteKit **form action** that calls `biab.forms.submit("todo-form", …)`, the SDK's documented create path for custom collections. Reads need the `metadata:read_records` scope on your key.

```sh
npm run sync-data-model    # push the todos data model (+ generated form) to BIAB's draft slot
npm run print-data-model   # print the resolved data model as JSON
```

## Why SvelteKit's shape is clean

SvelteKit has a hard boundary between client and server code: anything under `src/lib/server/` errors at build time if any client-side module imports it. That makes the SDK ergonomics very direct — no proxy, no transport, just call the SDK in `load()`:

```
browser → page request → SvelteKit load() → biab.gallery.list(...) → BIAB Package API
                                          ↑
                                          └ @businessdash/sdk + bearer key, server-only
```

The marketing sections render entirely from `load()` data (Hero, About, Services, Gallery, Blog) — no client-side fetch, just `<Hero hero={data.hero} />`. Interactive surfaces (Booking, ContactForm, cart, auth, reviews load-more) talk to SvelteKit `+server.ts` endpoints or form actions under `/api/biab/*` and `/api/biab-auth/*`, so the browser never holds the bearer key.

## Setup

```sh
bun install --ignore-workspace   # bun is the template's package manager (bun.lockb)
cp .env.example .env
# Fill BIAB_API_KEY, BIAB_SITE_ID, BIAB_PACKAGE_API_BASE_URL
# (optional) BIAB_REVALIDATION_SECRET, BIAB_AUTH_CALLBACK_URL

bun run dev
```

Open http://localhost:5173. **Everything degrades gracefully when BIAB env is unset** — pages still render with placeholder/demo content and storefront/portal surfaces show a "not connected" state.

## Environment variables

All read server-side via `$env/dynamic/private` (never exposed to the client). See `.env.example`.

| Var | Required for | Notes |
| --- | --- | --- |
| `BIAB_API_KEY` | everything | Site Settings → API Keys → New Key. Bearer key — server-only. |
| `BIAB_SITE_ID` | everything | The site UUID this app represents. |
| `BIAB_PACKAGE_API_BASE_URL` | everything | Where BIAB is hosted (e.g. `https://www.biab.app`). |
| `BIAB_REVALIDATION_SECRET` | webhook | `whsec_…` revealed at `/dashboard/settings/integrations`. |
| `BIAB_AUTH_CALLBACK_URL` | auth + portal | Public URL of `/api/biab-auth/callback`; register as a WorkOS redirect URI. |

## Surfaces & file map

### Marketing home (`/`)

| Section | Where it lives | SDK call |
| --- | --- | --- |
| **Hero / About / Services** | `src/routes/+page.server.ts` `load()` → `Hero/About/Services.svelte` | `biab.marketing.getPageBundle(...)` (via `fetchBundleSafe`) |
| **Gallery** | `+page.server.ts`, const-generic field selection | `biab.gallery.list({ limit: 12, fields: [...] as const })` |
| **Blog** | `+page.server.ts` → `Blog.svelte` | `biab.blog.listPosts({ limit: 6 })` |
| **Booking** | event-types server-rendered; slots + confirm hit `/api/biab/scheduling/*` | `scheduling.listEventTypes()`, `getAvailableSlots(...)`, `confirmBooking(...)` |
| **Contact form** | schema server-rendered; submit hits `/api/biab/forms/[slug]` | `forms.schema(slug)`, `forms.submit(...)` |
| **News banner** | `bundle.banner` → `Banner.svelte` (dismissible, remembered per message id) | bundle passthrough |

### Storefront (`/store`)

Visitor-token cart pattern: this app owns a UUID in the **httpOnly `biab_cart_visitor`** cookie (`src/lib/server/biab-store.ts`), minted on the first cart mutation via `event.cookies`. Reads never mint the cookie (safe in `load`); mutations do.

| Route | File | SDK call |
| --- | --- | --- |
| Product list | `src/routes/store/+page.{server.ts,svelte}` | `storefront.listProducts(...)` |
| Product detail | `src/routes/store/[id]/+page.{server.ts,svelte}` | `storefront.getProduct(id)` |
| Cart | `src/routes/store/cart/+page.{server.ts,svelte}` | `cart.forVisitor(token).{get,addItem,updateItem,removeItem,applyCoupon,removeCoupon,clear}` |
| Subscriptions | `src/routes/store/subscriptions/+page.{server.ts,svelte}` | `subscriptions.list()`, `subscriptions.startCheckout(id, ...)` |
| Order / return | `src/routes/store/order/+page.{server.ts,svelte}` | `checkout.getStatus(sessionId)` |

Cart + checkout endpoints (browser → these, never the SDK):

```
src/routes/api/biab/cart/+server.ts                       GET    cart snapshot
src/routes/api/biab/cart/items/+server.ts                 POST   add item
src/routes/api/biab/cart/items/[itemId]/+server.ts        PATCH  set qty · DELETE remove
src/routes/api/biab/cart/coupon/+server.ts                POST   apply · DELETE remove
src/routes/api/biab/cart/clear/+server.ts                 POST   clear
src/routes/api/biab/checkout/start/+server.ts             POST   → Stripe URL
src/routes/api/biab/subscriptions/[id]/checkout/+server.ts POST  → Stripe URL
```

The browser-side helpers in `src/lib/biab/cart-client.ts` wrap those endpoints and return the new `CartSnapshot`. Money: cart `unitPrice`/`subtotal` and variant `price` are **dollars** (`formatDollars`); subscription `amountCents` and checkout totals are **cents** (`formatCents`).

### Auth + customer portal

- **Auth handler** — `src/routes/api/biab-auth/[...slug]/+server.ts` mounts `createAuthHandler` as a catch-all. Each sub-route (`sign-in`, `sign-up`, `callback`, `sign-out`, `password-reset`, `me`) receives `event.request` and returns the handler's `Response`. It sets the **httpOnly `biab_session`** cookie. Header links are plain `<a href="/api/biab-auth/sign-in">` etc.
- **My account** — `src/routes/my-account/+page.server.ts` reads `biab_session` via `getTenantSession({ baseUrl, apiKey, cookieValue })`, then loads the work bundle with `customerPortal(orgId).withSession(token).getWork()` and exposes a `submitReview` **form action**. Signed-out → sign-in prompt; unconfigured → placeholder. Helpers in `src/lib/server/biab-portal.ts`.

### Reviews wall (`/reviews`)

`src/routes/reviews/+page.server.ts` ships the aggregate (average + count, off `bundle.reviews`) plus the first page from `reviews.list(...)`. "Load more" pages forward against `src/routes/api/biab/reviews/+server.ts`. Note the **two different shapes**: bundle reviews are `{ reviewee, description, date, rating }`; wall items are `{ reviewerName, text, timeCreated, rating }`.

### Updates feed (`/updates`)

`src/routes/updates/+page.server.ts` reads `bundle.updates` (Google-Business-style posts feed, untyped passthrough at 0.9.5) and renders the list.

### SEO

- **JSON-LD** — `src/lib/server/biab-seo.ts` builds `localBusiness` + `website` nodes from `@businessdash/sdk/seo`; the home `load()` returns the rendered HTML and `+page.svelte` injects it into `<svelte:head>` with `{@html data.jsonLd}` (server-rendered, crawler-visible on first byte).
- **sitemap.xml / robots.txt** — `src/routes/sitemap.xml/+server.ts` and `src/routes/robots.txt/+server.ts` proxy the BIAB-hosted endpoints (`parallelPages.sitemapUrl()` / `.robotsUrl()` resolved against the API base URL in `src/lib/server/biab-parallel.ts`). They serve a valid empty/permissive default when unconfigured.

### Parallel pages (programmatic SEO)

- **Index** — `src/routes/services/+page.server.ts` calls `parallelPages.listVariants("service-area")` and links each variant.
- **Render** — `src/routes/services/[service]/[area]/+page.server.ts` calls `parallelPages.render("service-area", { service, area })`, returning `meta.{title,description,canonical,ogImage}` + body. `+page.svelte` injects them into `<svelte:head>`. (SvelteKit has no Next-style `generateStaticParams`; the index page is the human directory, the sitemap is the crawler's.)

### Suspension handling

`fetchBundleSafe` (`biab-bundle.ts`) and `renderServiceArea` (`biab-parallel.ts`) catch `BiabPaymentLapsedError` / `BiabServiceSuspendedError`. The home page renders a minimal "site temporarily unavailable" state; the parallel-page route throws a **503** (SEO-safe temporary outage) for suspension and **404** for an unknown variant.

### Webhook revalidation

`src/routes/api/biab/revalidate/+server.ts` mounts `@businessdash/sdk/adapters/revalidate`. Register the URL in BIAB, paste the `whsec_…` into `BIAB_REVALIDATION_SECRET`. SvelteKit SSR re-fetches per request, so the callback logs today — wire your response cache purge (Vercel `Cache-Tag`, CDN tag delete, static rebuild trigger) there.

## CLI scripts (publish schema / content)

`biab.config.ts` at the root is the dashboard-editable content model. Publish + inspect it with:

```sh
bun run sync-schema    # publish biab.config.ts → BIAB draft slot (promote in dashboard)
bun run sync-content   # (optional) push a local JSON content tree up
bun run print-schema   # print the resolved schema as JSON
```

## Svelte 5 runes

BIAB-specific code uses runes mode (forced via `svelte.config.js`):

- `let { data }: { data: PageData } = $props();` — typed props
- `let snapshot = $state<CartSnapshot | null>(data.snapshot);` — reactive state
- `const cartCount = $derived(snapshot?.itemCount ?? 0);` — derived values
- `$effect(() => { … });` — side effects (e.g. default the variant once data is in)

Form actions use `use:enhance` from `$app/forms` (see `my-account/+page.svelte`).

## Project layout (BIAB-relevant only)

```
biab.config.ts                                   # marketing schema + parallel-page def
src/
├── lib/
│   ├── server/
│   │   ├── biab.ts                               # SDK client (server-only)
│   │   ├── biab-bundle.ts                        # bundle banner/updates/reviews + suspension
│   │   ├── biab-store.ts                         # storefront/cart/checkout + visitor cookie
│   │   ├── biab-portal.ts                        # session + customer-portal helpers
│   │   ├── biab-parallel.ts                      # parallel-pages + sitemap/robots URLs
│   │   └── biab-seo.ts                           # JSON-LD builders
│   ├── biab/cart-client.ts                       # browser cart helpers (call our endpoints)
│   └── components/biab/
│       ├── Header.svelte  Footer.svelte  Hero.svelte  About.svelte
│       ├── Services.svelte  Gallery.svelte  Blog.svelte
│       ├── Booking.svelte  ContactForm.svelte    # Svelte 5 runes, client-driven
│       ├── Banner.svelte                         # dismissible bundle.banner bar
│       └── StoreNav.svelte                       # storefront sub-nav + cart badge
└── routes/
    ├── +page.{server.ts,svelte}                  # home: marketing + banner + JSON-LD
    ├── store/…                                   # storefront (list, [id], cart, subscriptions, order)
    ├── reviews/+page.{server.ts,svelte}          # reviews wall + load-more
    ├── updates/+page.{server.ts,svelte}          # bundle.updates feed
    ├── my-account/+page.{server.ts,svelte}       # customer portal + review action
    ├── services/…                                # parallel-pages index + [service]/[area]
    ├── sitemap.xml/+server.ts  robots.txt/+server.ts
    └── api/
        ├── biab/  (revalidate, scheduling, forms, cart, checkout, subscriptions, reviews)
        └── biab-auth/[...slug]/+server.ts        # createAuthHandler catch-all
```

## Adapter

The starter uses `@sveltejs/adapter-auto`. To pin one:

```ts
// svelte.config.js
import vercel from '@sveltejs/adapter-vercel';
const config = { kit: { adapter: vercel() } };
```

The BIAB layer doesn't change — only the runtime where the SDK calls happen.
```


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
