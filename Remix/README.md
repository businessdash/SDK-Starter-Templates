# BIAB SDK — Remix starter

The generic business site every BIAB starter ships, built on **Remix 2 (Vite + Single Fetch)**. Loaders + actions run on the server; React hydrates on the client. The SDK + the bearer key live only in `.server.ts` modules — the browser never sees them.

## Why this shape

Remix's `loader` runs on the server for both the initial render and every client-side navigation. That puts the BIAB SDK + the bearer key exactly where they belong:

```
browser → / → Remix loader → biab.X.method(...) → BIAB Package API
                          ↑
                          └ @businessdash/sdk + bearer key on the server
```

Routes read data in `loader`s and mutate in `action`s; non-page endpoints (webhook, auth, sitemap…) are Remix **resource routes** (a route file with a `loader`/`action` and no default export). All SDK access is funnelled through `app/lib/*.server.ts` so it's tree-shaken out of the client bundle.

No client-side SDK. No env exposed to the browser. Analytics is the one client-side thing, booted from a tiny inline script that reads server-injected config.

## What's new (SDK 0.9.53)

Three additions, mirrored across every starter — all of them resource routes or loaders, so the shape above doesn't change:

- **AEO / llms.txt** — `app/routes/[llms.txt].ts` serves the answer-engine index the org curates at BIAB → Marketing → AI Distribution from this site's own root (`llmsTxtHandler` from `@businessdash/sdk/distribution`). The product feed needs no proxy — submit its BIAB URL (built by `productFeedUrl`) to merchant programs directly; `app/routes/ai.product-feed.ts` is a convenience redirect to it.
- **MCP connector proxy** — `app/routes/api.mcp.ts` (JSON-RPC via `action`) + `app/routes/[.well-known].[mcp.json].ts` (discovery manifest) give this self-hosted domain the same per-site MCP connector the platform serves natively, via `mcpHandler` + `mcpManifestHandler` from `@businessdash/sdk/mcp`. The URL an org hands to Claude / ChatGPT / Gemini is their own site; BIAB still enforces the org's MCP opt-in and per-tool write gates.
- **Relational custom collections (`/todos`)** — `biab.data-model.config.ts` declares two related collections (`todos`, and `todoImages` with a required RELATION to `todos`) with the 0.9.50+ `collection()` + `bd` builders. Push with `pnpm sync-data-model`, promote in the dashboard, set the generated "Todo Form" live, then open `/todos` — the loader lists todos (images joined on, in `app/lib/biab-todos.server.ts`) via `dataModel.listRecords`, and creates go through the generated `todo-form` submitted over the existing `/api/biab/forms` proxy. Reads go through the data-model client, writes go through forms; there is no direct row-write API for consumers.

## Setup

```sh
# Install STANDALONE so the template gets its own @businessdash/sdk@^0.9.5 (the
# BIAB monorepo root hoists an older copy). pnpm needs --ignore-workspace;
# npm and bun are unaffected.
pnpm install --ignore-workspace     # or: npm install / bun install

cp .env.example .env.local
# Fill BIAB_API_KEY, BIAB_SITE_ID, BIAB_PACKAGE_API_BASE_URL
# Optional: BIAB_PUBLIC_KEY, BIAB_REVALIDATION_SECRET, BIAB_AUTH_CALLBACK_URL, BIAB_SITE_URL

pnpm dev
```

Open <http://localhost:3000>. **Without env, every surface renders local fallbacks or a "not connected" notice** — the app never blanks or 500s.

For production: `pnpm build` then `pnpm start`.

## Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `BIAB_API_KEY` | yes | Server bearer key. Never sent to the browser. |
| `BIAB_SITE_ID` | yes | The BIAB site UUID. |
| `BIAB_PACKAGE_API_BASE_URL` | yes | API origin (e.g. `https://www.biab.app`). Normalised to `…/api/package/v1`. |
| `BIAB_PUBLIC_KEY` | no | Narrower analytics-only key (defaults to `BIAB_API_KEY`). |
| `BIAB_REVALIDATION_SECRET` | no | `whsec_…` HMAC secret for the revalidation webhook. |
| `BIAB_AUTH_CALLBACK_URL` | no | Public `/api/biab-auth/callback` URL; enables customer auth + portal. |
| `BIAB_SITE_URL` | no | Public origin used as `siteUrl` in JSON-LD (defaults to `https://example.com`). |

## CLI scripts

```sh
pnpm sync-schema    # publish biab.config.ts's JSON-Schema to BIAB's draft slot
pnpm sync-content   # (optional) push a local JSON content tree up to BIAB
pnpm print-schema   # print the resolved schema for debugging
```

These run `@businessdash/sdk`'s CLI via `tsx` against `biab.config.ts`.

## Surfaces — file by file

```
SDK-Starter-Templates/Remix/
├── biab.config.ts                       # marketing schema + brand tokens + parallel page
├── package.json                         # SDK dep + CLI scripts
├── .env.example
└── app/
    ├── root.tsx                         # HTML shell + analytics bootstrap
    ├── styles.css
    ├── components/
    │   ├── SiteHeader.tsx               # shared nav + cart badge (non-home routes)
    │   └── NewsBanner.tsx               # dismissible bundle.banner bar (client)
    ├── lib/
    │   ├── biab.server.ts               # SDK client, config, suspension-error guards
    │   ├── biab-cache.server.ts         # tag-keyed in-memory TTL cache (webhook target)
    │   ├── biab-bundle.server.ts        # marketing bundle fetch + banner/updates/gallery/reviews extractors
    │   ├── biab-store.server.ts         # storefront / cart / checkout / subscriptions + visitor cookie
    │   ├── biab-portal.server.ts        # session validation + customer portal (getWork, submitReview)
    │   ├── biab-pages.server.ts         # parallel pages (render/listVariants) + reviews-wall pagination
    │   ├── biab-booking.server.ts       # scheduling: event types, slots, confirm booking
    │   ├── biab-seo.server.ts           # localBusiness + website JSON-LD builder
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
        ├── api.biab.revalidate.ts      # revalidation webhook (resource route)
        ├── api.biab-auth.$.ts          # auth handler catch-all (resource route)
        ├── api.reviews.ts              # reviews pagination JSON endpoint (resource route)
        ├── [sitemap.xml].ts            # proxy BIAB's sitemap (resource route)
        └── [robots.txt].ts             # proxy BIAB's robots.txt (resource route)
```

`.server.ts` is enforced by the bundler: that code never reaches the client bundle. Resource routes (the webhook, auth, sitemap/robots, reviews API) receive a web `Request` and return a web `Response`, which is exactly what the SDK's framework-agnostic handlers (`createAuthHandler`, `createGenericRevalidateHandler`) produce.

## Storefront + cart

`biab-store.server.ts` wraps `storefront` / `cart` / `checkout` / `subscriptions` / `coupons`. The cart is keyed on a visitor token we own — an **httpOnly `biab_cart_visitor` cookie** (`createCookie`), minted on first mutation and attached to the action's response via `Set-Cookie`. Reads parse the token off the request; they never set the cookie.

- `store.$id.tsx` `action` → `addToCart(...)` → `redirect("/store/cart")` (carrying the minted cookie).
- `store.cart.tsx` has one `action` dispatched by an `intent` field: `update` / `remove` / `apply-coupon` / `remove-coupon` / `clear` / `checkout`. Checkout calls `checkout.forVisitor(token).start({ successUrl, cancelUrl })` and `redirect`s to the returned **Stripe-hosted URL** (`res.stripeUrl`).
- `store.subscriptions.tsx` lists `subscriptions.list()` and starts a recurring checkout via `subscriptions.startCheckout(id, …)`.

## Auth + customer portal

`api.biab-auth.$.ts` mounts `createAuthHandler` as a catch-all under `/api/biab-auth/*` (sign-in / sign-up / callback / sign-out / me / password-reset). It sets the `biab_session` httpOnly cookie. Drive it with plain links — no client SDK:

```html
<a href="/api/biab-auth/sign-in">Sign in</a>
<a href="/api/biab-auth/sign-up">Create account</a>
<a href="/api/biab-auth/sign-out">Sign out</a>
```

`my-account.tsx`'s `loader` validates the session with `getTenantSession({ baseUrl, apiKey, cookieValue })` (note: the param is **`cookieValue`** — the raw cookie value, not a token name), then reads the customer's work bundle via `customerPortal(orgId).withSession(token).getWork()`. Its `action` submits a review through `submitReview(...)` (lands `pending` until staff moderates).

## Reviews wall

`reviews.tsx` renders the aggregate (average + count) and the first page off the bundle (`bundle.reviews`, item shape `{ reviewee, description, date, rating }`), then "load more" calls the `api.reviews.ts` resource route which paginates `reviews.list({ offset })` (wall item shape `{ reviewerName, text, timeCreated, rating }`). The two shapes are mapped to a common UI shape at their own call sites.

## News banner + updates feed

The marketing bundle carries `bundle.banner` (scheduled multi-message bar) and `bundle.updates` (Google-Business "Posts"). The home route renders the first active banner message via the dismissible `NewsBanner` component; `updates._index.tsx` renders the updates feed.

## SEO

- `biab-seo.server.ts` builds `localBusiness` + `website` JSON-LD nodes from the bundle's company/brand data and serializes them with `renderJsonLdToHtml`. The home route injects the string server-side via a `<script type="application/ld+json">`.
- `[sitemap.xml].ts` and `[robots.txt].ts` proxy BIAB's auto-generated endpoints (resolved from `parallelPages.sitemapUrl()` / `.robotsUrl()` against the API base URL). The platform applies crawl rules + the billing-suspension fallbacks; the proxies just stream them through (with an empty/allow-all fallback when unconfigured).

## Parallel pages (programmatic SEO)

`biab.config.ts` declares one `defineParallelPage` (`service-area` → `/services/[service]/[area]`). The high-level client exposes `client.parallelPages` already bound to the site id:

- `services._index.tsx` lists every variant via `parallelPages.listVariants("service-area")`.
- `services.$service.$area.tsx` renders one via `parallelPages.render("service-area", { service, area })` — `meta` (title/description/canonical/ogImage) feeds the route's `meta` export, `body` renders below. Token expansion happens server-side inside BIAB, so crawlers see resolved HTML.

## Booking / scheduling

`book.tsx` lists event types (`scheduling.listEventTypes()`), shows available slots for the selected one (`scheduling.getAvailableSlots(slug, { from, to })`), and confirms a booking (`scheduling.confirmBooking({ eventTypeSlug, startAt, invitee, … })`).

## Revalidation webhook

`api.biab.revalidate.ts` mounts `createGenericRevalidateHandler` from `@businessdash/sdk/adapters/revalidate`. BIAB POSTs a signed `content.published` event; the handler verifies the HMAC + replay window and hands us the affected tags.

Remix has no built-in tag cache (unlike Next's `revalidateTag`), so this template includes a small **tag-keyed in-memory TTL cache** (`biab-cache.server.ts`) wrapping the server reads (bundle, parallel pages). The webhook's `onTagsRevalidated(tags, orgId)` callback drops every cache entry carrying a published tag — so a BIAB publish busts exactly the right slice within seconds, with a 60s TTL as a self-heal. (Swap the in-memory store for Redis in a multi-instance deploy; the call-site contract stays the same.)

One-time setup: register `https://your-site/api/biab/revalidate` at BIAB's `/dashboard/settings/integrations`, copy the `whsec_…` secret into `BIAB_REVALIDATION_SECRET`.

## Suspension handling

`biab.server.ts` exposes `isServiceSuspended` / `isPaymentLapsed` guards around the SDK's `BiabServiceSuspendedError` / `BiabPaymentLapsedError`. Bundle/page reads catch these and render a minimal "temporarily unavailable" state (the parallel-page route throws a 503 so search engines treat the outage as temporary). Lapsed-payment reads still serve.

## Graceful degradation

Every surface no-ops when BIAB env is unset: section loaders return local defaults, store/auth/booking show a "not connected" notice, sitemap/robots fall back to empty/allow-all, and the webhook/auth resource routes answer with a clear non-200 instead of crashing.


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
