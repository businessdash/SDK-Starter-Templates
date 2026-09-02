# BIAB SDK — TanStack Solid Start starter

Same generic business site as the other framework starters, built on **TanStack Solid Start** (Solid.js + TanStack Router + TanStack Start SSR + Nitro). The shape is closest to the Qwik starter: route `loader` for SSR data, `createServerFn` for client-callable RPCs — no separate API endpoint files needed for those.

## Why this shape

TanStack Start's `createServerFn` compiles function bodies as RPC endpoints. The bearer key in `src/lib/biab.ts` is only reachable through `createServerFn` handlers, so the bundler drops it from the client chunk. Solid's signals (`createSignal`, `createEffect`) handle reactive client state with fine-grained updates — no virtual DOM, no rehydration cost.

```
browser → page load → loader() → getHomeData() → biab.gallery.list(...) → BIAB
        ↘ client event → fetchSlots(...) → biab.scheduling.getAvailableSlots(...)
                                          ↑
                                          └ SDK lives only in server-fn scope
```

The home page renders from data returned by the route's `loader`; interactive sections (Booking, ContactForm) use Solid signals + `createServerFn` calls. Beyond the home page the starter demonstrates the full SDK surface — storefront + cart + subscriptions, customer auth + portal, reviews wall, news banner + updates feed, JSON-LD + sitemap/robots, and programmatic `/services/[service]/[area]` pages. See the tables below.

## What's new (SDK 0.9.53)

Three additions, mirrored across every starter:

| Surface | Route(s) | SDK entrypoint |
| --- | --- | --- |
| **AEO / llms.txt** | `/llms.txt` (+ `/ai/product-feed` redirect) | `llmsTxtHandler` + `productFeedUrl` from `@businessdash/sdk/distribution` |
| **MCP connector proxy** | `/api/mcp` + `/.well-known/mcp.json` | `mcpHandler` + `mcpManifestHandler` from `@businessdash/sdk/mcp` |
| **Relational custom collections** | `/todos` | `collection()` + `bd` builders, `dataModel.listRecords`, generated `todo-form` |

- **AEO surfaces.** Orgs curate an answer-engine index + product feed at BIAB → Marketing → AI Distribution; the llms.txt convention only works at the site's own root, so `src/routes/llms[.]txt.tsx` proxies it from this domain. The product feed needs no proxy — submit its BIAB URL (built by `productFeedUrl`) to merchant programs directly; `/ai/product-feed` is a convenience redirect to it.
- **MCP connector.** `src/routes/api/mcp.tsx` + `src/routes/[.]well-known.mcp[.]json.tsx` give this self-hosted domain the same per-site MCP connector the platform serves natively — the URL an org hands to Claude / ChatGPT / Gemini is their own site. The proxy is thin: BIAB still enforces the org's MCP opt-in and per-tool write gates.
- **Todos demo.** `biab.data-model.config.ts` declares two related collections (`todos`, and `todoImages` with a required RELATION to `todos`) with the 0.9.50+ `collection()` + `bd` builders. Push with `pnpm sync-data-model`, promote in the dashboard, set the generated "Todo Form" live, then open `/todos` — TanStack Start server functions in `src/lib/biab-server-fns.ts` (`getTodosData`, `submitTodoForm`) do the reads via `dataModel.listRecords` and create todos by submitting the generated `todo-form`. Reads go through the data-model client, writes go through forms; there is no direct row-write API for consumers.

## Setup

```sh
npm install     # or bun / pnpm
cp .env.example .env.local
# Fill BIAB_API_KEY, BIAB_SITE_ID, BIAB_PACKAGE_API_BASE_URL

npm run dev     # vite dev --port 3000
```

Open http://localhost:3000.

For production:

```sh
npm run build
npm run start   # node .output/server/index.mjs
```

## What's in each section

Every surface below is server-driven by a `createServerFn` in `src/lib/biab-server-fns.ts` (the only place the secret key is reachable) and degrades gracefully when BIAB env is unset.

### Home page (`src/routes/index.tsx`)

| Section | Where it lives | SDK call |
| --- | --- | --- |
| **Hero / About / Services** | `getHomeData` server fn reads marketing bundle, passes props to components | `biab.marketing.getPageBundle(...)` |
| **Gallery** | `getHomeData` with const-generic field selection | `biab.gallery.list({ limit: 12, fields: [...] as const })` |
| **Blog** | `getHomeData` | `biab.blog.listPosts({ limit: 6 })` |
| **Booking** | Event-type list server-rendered; slots + confirm via `fetchSlots` + `confirmBooking` | `biab.scheduling.listEventTypes()`, `getAvailableSlots(...)`, `confirmBooking(...)` |
| **Contact form** | Form schema server-rendered; submit via `submitContactForm` | `biab.forms.schema(slug)`, `biab.forms.submit(...)` |
| **News banner** | `getSiteContentExtras` → `NewsBanner` (dismissible bar) | `bundle.banner` (untyped passthrough) |
| **JSON-LD** | `getHomeJsonLd` injected via the route `head` `scripts` | `localBusiness()` + `website()` from `@businessdash/sdk/seo` |

### Commerce

| Surface | File | SDK call |
| --- | --- | --- |
| **Store list** | `src/routes/store.index.tsx` | `storefront.listProducts(...)` |
| **Product detail** | `src/routes/store.$id.tsx` | `storefront.getProduct(id)`, `cart.forVisitor(t).addItem(...)` |
| **Cart** | `src/routes/store.cart.tsx` | `cart.forVisitor(t)` get/update/remove/coupon/clear + `checkout.forVisitor(t).start(...)` |
| **Subscriptions** | `src/routes/subscriptions.tsx` | `subscriptions.list()`, `subscriptions.startCheckout(id, ...)` |

The cart is keyed on a visitor UUID we own, stored in an httpOnly cookie `biab_cart_visitor`. It's read on cart loads and minted on the first write — all inside the server fns via TanStack Start's `getCookie` / `setCookie` (`@tanstack/solid-start/server`). Checkout and subscription "subscribe" return a Stripe-hosted URL; the client redirects to it.

### Auth + customer portal

| Surface | File | SDK call |
| --- | --- | --- |
| **Auth handler** | `src/routes/api/biab-auth.$.tsx` (catch-all) | `createAuthHandler(...)` → `/api/biab-auth/{sign-in,sign-up,callback,sign-out,me}` |
| **My account** | `src/routes/my-account.tsx` | `getTenantSession(...)` on `biab_session`, `customerPortal(org).withSession(t).getWork()`, `.submitReview(...)` |

Sign-in / sign-up / sign-out are plain links to the catch-all handler (no client SDK needed). The handler sets a `biab_session` httpOnly cookie; `my-account`'s loader validates it server-side, shows the user + a work-summary (jobs / quotes / invoices), and offers a moderated review-submission form.

### Reviews, updates, SEO, programmatic pages

| Surface | File | SDK call |
| --- | --- | --- |
| **Reviews wall** | `src/routes/reviews.tsx` | aggregate off `bundle.reviews` + `reviews.list({limit,offset})` ("load more") |
| **Updates feed** | `src/routes/updates.tsx` | `bundle.updates` (untyped passthrough) |
| **Sitemap** | `src/routes/sitemap[.]xml.tsx` | proxies `parallelPages.sitemapUrl()` |
| **Robots** | `src/routes/robots[.]txt.tsx` | proxies `parallelPages.robotsUrl()` |
| **Service areas (index)** | `src/routes/services.index.tsx` | `parallelPages.listVariants("service-area")` |
| **Service × area page** | `src/routes/services.$service.$area.tsx` | `parallelPages.render("service-area", { service, area })`, meta lifted into the route `head` |

Bundle review items (`{ reviewee, description, date }`) and `reviews.list` wall items (`{ reviewerName, text, timeCreated }`) have different shapes — each is mapped at its own call site.

### Suspension handling

Bundle / store / parallel-page reads catch `BiabPaymentLapsedError` / `BiabServiceSuspendedError` (both extend `BiabAccessRejectedError`) and render a minimal "temporarily unavailable" state instead of crashing.

## Adding a new SDK surface

1. **Static data** — add a field to `HomeData` and the `getHomeData` handler in `src/lib/biab-server-fns.ts`. Pass it through the route loader to a component as a prop.
2. **Interactive RPC** — add another `createServerFn({ method: ... }).validator(...).handler(...)` in `biab-server-fns.ts`. Import and `await` it from any Solid component.

No API route file needed for the RPC case — TanStack Start generates the transport.

## Webhook revalidation (built in)

`src/routes/api/biab/revalidate.tsx` mounts the SDK's framework-agnostic handler via `createServerFileRoute` + `POST`. Register the URL in BIAB at `/dashboard/settings/integrations`, paste the `whsec_…` into `BIAB_REVALIDATION_SECRET`, and BIAB will POST a signed `content.published` event on every publish. The callback in `revalidate.tsx` is where you wire response-level cache purging once you add it.

## Configuration + env

| Var | Purpose |
| --- | --- |
| `BIAB_API_KEY` | Server-only bearer key (Site Settings → API Keys). |
| `BIAB_SITE_ID` | The site UUID this app represents. |
| `BIAB_PACKAGE_API_BASE_URL` | Where BIAB is hosted (e.g. `https://www.biab.app`). |
| `BIAB_REVALIDATION_SECRET` | HMAC secret for the revalidate webhook. |
| `BIAB_AUTH_CALLBACK_URL` | Public URL of `/api/biab-auth/callback` — required for auth + portal. |

All are **server-only** — never prefix with `VITE_` or they leak to the browser bundle. `biab.config.ts` (root) is the dashboard-editable content schema; `npm run sync-schema` / `sync-content` / `print-schema` publish + inspect it.

## Project layout (BIAB-relevant only)

```
biab.config.ts                                 # marketing schema + defineParallelPage("service-area")
src/
├── lib/
│   ├── biab.ts                                # SDK client + bundle/banner/updates/reviews helpers (server-only)
│   └── biab-server-fns.ts                     # all createServerFn RPCs + sitemap/robots/SEO builders
├── components/biab/
│   ├── Header.tsx · Footer.tsx · Hero.tsx · About.tsx · Services.tsx
│   ├── Gallery.tsx · Blog.tsx
│   ├── Booking.tsx · ContactForm.tsx          # createSignal + createEffect
│   ├── NewsBanner.tsx                          # dismissible bundle.banner bar
│   └── money.ts                                # price/interval formatters
├── routes/
│   ├── index.tsx                              # home: loader composes sections + injects JSON-LD
│   ├── store.index.tsx · store.$id.tsx · store.cart.tsx
│   ├── subscriptions.tsx
│   ├── reviews.tsx · updates.tsx
│   ├── my-account.tsx                          # session + work bundle + review form
│   ├── services.index.tsx · services.$service.$area.tsx   # programmatic SEO
│   ├── sitemap[.]xml.tsx · robots[.]txt.tsx    # SEO proxies
│   └── api/
│       ├── biab/revalidate.tsx                # webhook receiver
│       └── biab-auth.$.tsx                     # auth catch-all (createAuthHandler)
└── styles.css                                 # Existing tokens + appended BIAB tokens
```

## Solid 1.x idioms used

- `createSignal()` — reactive primitive, returns `[get, set]`
- `createEffect()` — runs when its dependencies (called signals) change; perfect for "re-load slots when event type changes"
- `<For each={...}>` / `<Show when={...}>` — Solid's reactive control flow components
- Component props are reactive — read `props.x` (not destructured) inside JSX
- Event handlers like `onInput`, `onClick` — same shape as React

The BIAB layer doesn't care which framework lives on top — Solid components just receive plain data from the loader and call typed server functions.


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
