# BIAB SDK — React + Bun starter

A generic business website wired against the **BIAB SDK** (`@businessdash/sdk`). Use it as a reference for how to consume BIAB data from a pure React SPA. The same canonical site ships across the other framework starters (Astro, Nuxt, Qwik, Svelte, T3-App, Tanstack-Start) — only the **transport** changes per framework.

## The pattern

A pure React SPA has no server, which means there's no safe place to hide an API key from the browser bundle. This template adds a tiny **Bun HTTP proxy** that:

1. Holds `BIAB_API_KEY` server-side and instantiates `createBiabClient` from `@businessdash/sdk`.
2. Exposes a small set of `/api/biab/*` endpoints — each one is a one-liner wrapper around a single SDK call.
3. In production, serves the Vite-built `dist/` directory; in dev, Vite serves the SPA and forwards `/api/biab/*` to the Bun proxy via `vite.config.ts`.

```
browser → /api/biab/<route> → Bun (server.ts) → BIAB Package API
```

The browser bundle imports types from `@businessdash/sdk`, but never the runtime — it just hits same-origin paths. The bearer key stays in the Bun process.

## What's new (SDK 0.9.53)

Three additions, mirrored across every starter — all served by the Bun proxy (the key-holder), with the dev-server forwards already wired in `vite.config.ts`:

- **AEO / llms.txt** — the Bun server serves `/llms.txt` (the answer-engine index the org curates at BIAB → Marketing → AI Distribution) from this site's own root via `llmsTxtHandler` from `@businessdash/sdk/distribution`. The product feed needs no proxy — submit its BIAB URL (built by `productFeedUrl`) to merchant programs directly; `/ai/product-feed` is a convenience redirect to it.
- **MCP connector proxy** — `/api/mcp` (JSON-RPC) + `/.well-known/mcp.json` (discovery manifest) give this self-hosted domain the same per-site MCP connector the platform serves natively, via `mcpHandler` + `mcpManifestHandler` from `@businessdash/sdk/mcp`. The URL an org hands to Claude / ChatGPT / Gemini is their own site; BIAB still enforces the org's MCP opt-in and per-tool write gates.
- **Relational custom collections (`/todos`)** — `biab.data-model.config.ts` declares two related collections (`todos`, and `todoImages` with a required RELATION to `todos`) with the 0.9.50+ `collection()` + `bd` builders. Push with `bun run sync-data-model`, promote in the dashboard, set the generated "Todo Form" live, then open `/todos` — the SPA reads `GET /api/biab/todos` (the Bun server joins images onto their todo via `dataModel.listRecords`), and creates go through the generated `todo-form` over the existing forms proxy. Reads go through the data-model client, writes go through forms; there is no direct row-write API for consumers.

## Setup

```sh
bun install
cp .env.example .env.local
# Fill BIAB_API_KEY, BIAB_SITE_ID, BIAB_PACKAGE_API_BASE_URL

bun run dev
```

`bun run dev` starts both processes via `concurrently`:

- **Vite** on http://localhost:5173 (the SPA, with HMR)
- **Bun proxy** on http://localhost:3000 (`/api/biab/*` handler)

Open http://localhost:5173. Vite proxies API calls to the Bun server.

For production:

```sh
bun run build      # tsc + vite build → dist/
bun run preview    # bun server.ts serves dist/ + /api/biab/* on the same port
```

## What's in each section

Every section under `src/components/` exercises one SDK surface:

| Section | SDK call | What it shows |
| --- | --- | --- |
| **Hero / About / Services** | `biab.marketing.getPageBundle({ pageKey: "home" })` | Class A — admin-published marketing content with local fallbacks |
| **Gallery** | `biab.gallery.list({ limit: 12, fields: ["id", "src", "title", "category", "blurDataURL"] as const })` | **Typed field selection** — const-generic narrowing means the server SELECTs only the columns you asked for, and TS types `.map((item) => …)` accordingly |
| **Blog** | `biab.blog.listPosts({ limit: 6 })` | Class A — webhook-invalidated; new posts appear within seconds of publish |
| **Booking** | `biab.scheduling.listEventTypes()` → `getAvailableSlots(slug, { from, to })` → `confirmBooking(...)` | Full Calendly-shape flow end-to-end |
| **Contact form** | `biab.forms.schema(slug)` → render fields dynamically → `biab.forms.submit(slug, data, ...)` | Schema-driven form rendering + client-side validation against the same shape BIAB enforces server-side |

## Feature parity (BIAB SDK 0.9.5)

This starter is aligned, surface-for-surface, with the production reference
consumer. A tiny client router (`src/lib/router.tsx`) switches between the home
sections and the feature pages; every surface degrades gracefully when BIAB env
is unset.

| Surface | Route / page | SDK calls (proxied) |
| --- | --- | --- |
| **Home sections** | `/` | `marketing.getPageBundle`, `gallery.list`, `blog.listPosts`, `scheduling.*`, `forms.*` |
| **Storefront** | `/store`, `/store/:id` | `storefront.listProducts`, `storefront.getProduct` |
| **Cart** | `/cart` | `cart.forVisitor(token).{get,addItem,updateItem,removeItem,applyCoupon,removeCoupon,clear}` — `biab_cart_visitor` httpOnly cookie minted by the proxy |
| **Checkout** | `/cart` → Stripe | `checkout.forVisitor(token).start` |
| **Subscriptions** | `/subscriptions` | `subscriptions.list` |
| **Reviews wall** | `/reviews` | `reviews.list({ limit, offset })` with "load more" |
| **News banner + updates** | banner on every page, `/updates` | `bundle.banner`, `bundle.updates` |
| **Auth + portal** | `/api/biab-auth/*`, `/my-account` | `createAuthHandler`, `getTenantSession`, `customerPortal(org).withSession(token).{getWork,submitReview}` |
| **Programmatic SEO** | `/services`, `/services/:service/:area` | `parallelPages.listVariants`, `parallelPages.render` |
| **SEO files** | `/sitemap.xml`, `/robots.txt` | proxied from BIAB; JSON-LD injected into the served index.html in prod |
| **Revalidation webhook** | `POST /api/biab/revalidate` | `createGenericRevalidateHandler` → busts the proxy's in-memory tag cache |

### Environment

| Var | Required | Purpose |
| --- | --- | --- |
| `BIAB_API_KEY` / `BIAB_SITE_ID` / `BIAB_PACKAGE_API_BASE_URL` | for live data | Server-side SDK credentials (proxy only) |
| `BIAB_REVALIDATION_SECRET` | for webhook | HMAC secret verifying publish events |
| `BIAB_AUTH_CALLBACK_URL` | for auth/portal | The proxy's `/api/biab-auth/callback` URL (register in WorkOS) |
| `VITE_BIAB_SITE_ID` / `VITE_BIAB_PACKAGE_API_BASE_URL` / `VITE_BIAB_PUBLIC_KEY` | optional | Client-side analytics (`<BIABAnalytics />`) — the public analytics key only |

### Schema CLI

```sh
bun run sync-schema     # publish biab.config.ts schema to BIAB's draft slot
bun run sync-content    # (optional) push a local content tree
bun run print-schema    # print the resolved schema JSON
```

## Adding a new SDK surface

The pattern is uniform: one entry in the server route table + one method on the browser client.

1. In `server.ts`, add a key like `"GET /api/biab/<your-route>"` with a handler that calls one SDK method and returns its JSON.
2. In `src/lib/biab.ts`, add a method that hits that same path.
3. In a component, import and use it.

That's the whole loop.

## Live updates (webhook revalidation)

BIAB POSTs to `/api/biab/revalidate` on every publish. The Bun proxy wraps its
SDK reads in a small in-memory **tag cache**, and the webhook
(`createGenericRevalidateHandler` from `@businessdash/sdk/adapters/revalidate`)
verifies the HMAC signature and evicts the matching cache entries — so the next
fetch returns fresh data within seconds of a publish, no redeploy. Set
`BIAB_REVALIDATION_SECRET` to enable it.

## Project layout

```
.
├── server.ts                 # Bun proxy — key holder, auth, webhook+cache, SEO, JSON-LD
├── biab.config.ts            # Marketing schema + brand tokens + parallel page
├── vite.config.ts            # Vite dev proxy → Bun server (api, auth, sitemap, robots)
├── src/
│   ├── App.tsx               # Router: home sections + feature pages
│   ├── lib/
│   │   ├── biab.ts           # Browser-side typed fetcher (no key) + money/dollars
│   │   └── router.tsx        # Tiny dependency-free client router
│   ├── components/
│   │   ├── Header.tsx  Footer.tsx  Banner.tsx
│   │   ├── Hero.tsx  About.tsx  Services.tsx  Gallery.tsx  Blog.tsx
│   │   ├── Booking.tsx        # Calendly flow
│   │   └── ContactForm.tsx    # Forms schema + validator
│   └── pages/
│       ├── ui.tsx            # useApi hook + ErrorBox + PageHead
│       ├── Store.tsx  Product.tsx  Cart.tsx  Subscriptions.tsx
│       ├── Reviews.tsx  Updates.tsx  MyAccount.tsx
│       └── ServiceAreas.tsx  ServiceArea.tsx
└── .env.example
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
