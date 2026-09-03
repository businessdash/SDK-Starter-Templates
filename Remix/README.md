# BD SDK — Remix starter

The generic business site every BD starter ships, built on **Remix 2 (Vite + Single Fetch)**. Loaders + actions run on the server; React hydrates on the client. The SDK + the bearer key live only in `.server.ts` modules — the browser never sees them.

## Why this shape

Remix's `loader` runs on the server for both the initial render and every client-side navigation. That puts the BD SDK + the bearer key exactly where they belong:

```
browser → / → Remix loader → bd.X.method(...) → BD Package API
                          ↑
                          └ @businessdash/sdk + bearer key on the server
```

Routes read data in `loader`s and mutate in `action`s; non-page endpoints (webhook, auth, sitemap…) are Remix **resource routes** (a route file with a `loader`/`action` and no default export). All SDK access is funnelled through `app/lib/*.server.ts` so it's tree-shaken out of the client bundle.

No client-side SDK. No env exposed to the browser. Analytics is the one client-side thing, booted from a tiny inline script that reads server-injected config.

## What's new (SDK 0.9.53)

Three additions, mirrored across every starter — all of them resource routes or loaders, so the shape above doesn't change:

- **AEO / llms.txt** — `app/routes/[llms.txt].ts` serves the answer-engine index the org curates at BD → Marketing → AI Distribution from this site's own root (`llmsTxtHandler` from `@businessdash/sdk/distribution`). The product feed needs no proxy — submit its BD URL (built by `productFeedUrl`) to merchant programs directly; `app/routes/ai.product-feed.ts` is a convenience redirect to it.
- **MCP connector proxy** — `app/routes/api.mcp.ts` (JSON-RPC via `action`) + `app/routes/[.well-known].[mcp.json].ts` (discovery manifest) give this self-hosted domain the same per-site MCP connector the platform serves natively, via `mcpHandler` + `mcpManifestHandler` from `@businessdash/sdk/mcp`. The URL an org hands to Claude / ChatGPT / Gemini is their own site; BD still enforces the org's MCP opt-in and per-tool write gates.
- **Relational custom collections (`/todos`)** — `bd.data-model.config.ts` declares two related collections (`todos`, and `todoImages` with a required RELATION to `todos`) with the 0.9.50+ `collection()` + `bd` builders. Push with `pnpm sync-data-model`, promote in the dashboard, set the generated "Todo Form" live, then open `/todos` — the loader lists todos (images joined on, in `app/lib/bd-todos.server.ts`) via `dataModel.listRecords`, and creates go through the generated `todo-form` submitted over the existing `/api/bd/forms` proxy. Reads go through the data-model client, writes go through forms; there is no direct row-write API for consumers.

## Setup

```sh
# Install STANDALONE so the template gets its own @businessdash/sdk@^0.9.5 (the
# BD monorepo root hoists an older copy). pnpm needs --ignore-workspace;
# npm and bun are unaffected.
pnpm install --ignore-workspace     # or: npm install / bun install

cp .env.example .env.local
# Fill BD_API_KEY, BD_SITE_ID, BD_PACKAGE_API_BASE_URL
# Optional: BD_PUBLIC_KEY, BD_REVALIDATION_SECRET, BD_AUTH_CALLBACK_URL, BD_SITE_URL

pnpm dev
```

Open <http://localhost:3000>. **Without env, every surface renders local fallbacks or a "not connected" notice** — the app never blanks or 500s.

For production: `pnpm build` then `pnpm start`.

## Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `BD_API_KEY` | yes | Server bearer key. Never sent to the browser. |
| `BD_SITE_ID` | yes | The BD site UUID. |
| `BD_PACKAGE_API_BASE_URL` | yes | API origin (e.g. `https://www.biab.app`). Normalised to `…/api/package/v1`. |
| `BD_PUBLIC_KEY` | no | Narrower analytics-only key (defaults to `BD_API_KEY`). |
| `BD_REVALIDATION_SECRET` | no | `whsec_…` HMAC secret for the revalidation webhook. |
| `BD_AUTH_CALLBACK_URL` | no | Public `/api/bd-auth/callback` URL; enables customer auth + portal. |
| `BD_SITE_URL` | no | Public origin used as `siteUrl` in JSON-LD (defaults to `https://example.com`). |

## CLI scripts

```sh
pnpm sync-schema    # publish bd.config.ts's JSON-Schema to BD's draft slot
pnpm sync-content   # (optional) push a local JSON content tree up to BD
pnpm print-schema   # print the resolved schema for debugging
```

These run `@businessdash/sdk`'s CLI via `tsx` against `bd.config.ts`.

## Surfaces — file by file

```
SDK-Starter-Templates/Remix/
├── bd.config.ts                       # marketing schema + brand tokens + parallel page
├── package.json                         # SDK dep + CLI scripts
├── .env.example
└── app/
    ├── root.tsx                         # HTML shell + analytics bootstrap
    ├── styles.css
    ├── components/
    │   ├── SiteHeader.tsx               # shared nav + cart badge (non-home routes)
    │   └── NewsBanner.tsx               # dismissible bundle.banner bar (client)
    ├── lib/
    │   ├── bd.server.ts               # SDK client, config, suspension-error guards
    │   ├── bd-cache.server.ts         # tag-keyed in-memory TTL cache (webhook target)
    │   ├── bd-bundle.server.ts        # marketing bundle fetch + banner/updates/gallery/reviews extractors
    │   ├── bd-store.server.ts         # storefront / cart / checkout / subscriptions + visitor cookie
    │   ├── bd-portal.server.ts        # session validation + customer portal (getWork, submitReview)
    │   ├── bd-pages.server.ts         # parallel pages (render/listVariants) + reviews-wall pagination
    │   ├── bd-booking.server.ts       # scheduling: event types, slots, confirm booking
    │   ├── bd-seo.server.ts           # localBusiness + website JSON-LD builder
    │   └── sdk-sections.server.ts       # home section loaders (hero/about/services/blog/gallery) + contact
    └── routes/
        ├── _index.tsx                   # home: sections + gallery + banner + JSON-LD
        ├── store._index.tsx             # product list
        ├── store.$id.tsx                # product detail + add-to-cart action
        ├── store.cart.tsx              # cart: update/remove/coupon/clear/checkout (intent-dispatched action)
        ├── store.subscriptions.tsx     # subscription offerings + subscribe checkout
        ├── my-account.tsx              # session → user + getWork() + review-submit action
        ├── reviews.tsx                 # reviews wall: aggregate + first page + load-more
        ├── updates._index.tsx          # bundle.updates feed
        ├── services._index.tsx         # parallel-page variant index (link list)
        ├── services.$service.$area.tsx # rendered parallel page + per-page meta/canonical
        ├── book.tsx                    # scheduling: pick event type → slot → confirm
        ├── api.bd.revalidate.ts      # revalidation webhook (resource route)
        ├── api.bd-auth.$.ts          # auth handler catch-all (resource route)
        ├── api.reviews.ts              # reviews pagination JSON endpoint (resource route)
        ├── [sitemap.xml].ts            # proxy BD's sitemap (resource route)
        └── [robots.txt].ts             # proxy BD's robots.txt (resource route)
```

`.server.ts` is enforced by the bundler: that code never reaches the client bundle. Resource routes (the webhook, auth, sitemap/robots, reviews API) receive a web `Request` and return a web `Response`, which is exactly what the SDK's framework-agnostic handlers (`createAuthHandler`, `createGenericRevalidateHandler`) produce.

## Storefront + cart

`bd-store.server.ts` wraps `storefront` / `cart` / `checkout` / `subscriptions` / `coupons`. The cart is keyed on a visitor token we own — an **httpOnly `bd_cart_visitor` cookie** (`createCookie`), minted on first mutation and attached to the action's response via `Set-Cookie`. Reads parse the token off the request; they never set the cookie.

- `store.$id.tsx` `action` → `addToCart(...)` → `redirect("/store/cart")` (carrying the minted cookie).
- `store.cart.tsx` has one `action` dispatched by an `intent` field: `update` / `remove` / `apply-coupon` / `remove-coupon` / `clear` / `checkout`. Checkout calls `checkout.forVisitor(token).start({ successUrl, cancelUrl })` and `redirect`s to the returned **Stripe-hosted URL** (`res.stripeUrl`).
- `store.subscriptions.tsx` lists `subscriptions.list()` and starts a recurring checkout via `subscriptions.startCheckout(id, …)`.

## Auth + customer portal

`api.bd-auth.$.ts` mounts `createAuthHandler` as a catch-all under `/api/bd-auth/*` (sign-in / sign-up / callback / sign-out / me / password-reset). It sets the `bd_session` httpOnly cookie. Drive it with plain links — no client SDK:

```html
<a href="/api/bd-auth/sign-in">Sign in</a>
<a href="/api/bd-auth/sign-up">Create account</a>
<a href="/api/bd-auth/sign-out">Sign out</a>
```

`my-account.tsx`'s `loader` validates the session with `getTenantSession({ baseUrl, apiKey, cookieValue })` (note: the param is **`cookieValue`** — the raw cookie value, not a token name), then reads the customer's work bundle via `customerPortal(orgId).withSession(token).getWork()`. Its `action` submits a review through `submitReview(...)` (lands `pending` until staff moderates).

## Reviews wall

`reviews.tsx` renders the aggregate (average + count) and the first page off the bundle (`bundle.reviews`, item shape `{ reviewee, description, date, rating }`), then "load more" calls the `api.reviews.ts` resource route which paginates `reviews.list({ offset })` (wall item shape `{ reviewerName, text, timeCreated, rating }`). The two shapes are mapped to a common UI shape at their own call sites.

## News banner + updates feed

The marketing bundle carries `bundle.banner` (scheduled multi-message bar) and `bundle.updates` (Google-Business "Posts"). The home route renders the first active banner message via the dismissible `NewsBanner` component; `updates._index.tsx` renders the updates feed.

## SEO

- `bd-seo.server.ts` builds `localBusiness` + `website` JSON-LD nodes from the bundle's company/brand data and serializes them with `renderJsonLdToHtml`. The home route injects the string server-side via a `<script type="application/ld+json">`.
- `[sitemap.xml].ts` and `[robots.txt].ts` proxy BD's auto-generated endpoints (resolved from `parallelPages.sitemapUrl()` / `.robotsUrl()` against the API base URL). The platform applies crawl rules + the billing-suspension fallbacks; the proxies just stream them through (with an empty/allow-all fallback when unconfigured).

## Parallel pages (programmatic SEO)

`bd.config.ts` declares one `defineParallelPage` (`service-area` → `/services/[service]/[area]`). The high-level client exposes `client.parallelPages` already bound to the site id:

- `services._index.tsx` lists every variant via `parallelPages.listVariants("service-area")`.
- `services.$service.$area.tsx` renders one via `parallelPages.render("service-area", { service, area })` — `meta` (title/description/canonical/ogImage) feeds the route's `meta` export, `body` renders below. Token expansion happens server-side inside BD, so crawlers see resolved HTML.

## Booking / scheduling

`book.tsx` lists event types (`scheduling.listEventTypes()`), shows available slots for the selected one (`scheduling.getAvailableSlots(slug, { from, to })`), and confirms a booking (`scheduling.confirmBooking({ eventTypeSlug, startAt, invitee, … })`).

## Revalidation webhook

`api.bd.revalidate.ts` mounts `createGenericRevalidateHandler` from `@businessdash/sdk/adapters/revalidate`. BD POSTs a signed `content.published` event; the handler verifies the HMAC + replay window and hands us the affected tags.

Remix has no built-in tag cache (unlike Next's `revalidateTag`), so this template includes a small **tag-keyed in-memory TTL cache** (`bd-cache.server.ts`) wrapping the server reads (bundle, parallel pages). The webhook's `onTagsRevalidated(tags, orgId)` callback drops every cache entry carrying a published tag — so a BD publish busts exactly the right slice within seconds, with a 60s TTL as a self-heal. (Swap the in-memory store for Redis in a multi-instance deploy; the call-site contract stays the same.)

One-time setup: register `https://your-site/api/bd/revalidate` at BD's `/dashboard/settings/integrations`, copy the `whsec_…` secret into `BD_REVALIDATION_SECRET`.

## Suspension handling

`bd.server.ts` exposes `isServiceSuspended` / `isPaymentLapsed` guards around the SDK's `BdServiceSuspendedError` / `BdPaymentLapsedError`. Bundle/page reads catch these and render a minimal "temporarily unavailable" state (the parallel-page route throws a 503 so search engines treat the outage as temporary). Lapsed-payment reads still serve.

## Graceful degradation

Every surface no-ops when BD env is unset: section loaders return local defaults, store/auth/booking show a "not connected" notice, sitemap/robots fall back to empty/allow-all, and the webhook/auth resource routes answer with a clear non-200 instead of crashing.


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
