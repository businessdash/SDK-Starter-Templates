# BIAB SDK — Nuxt 4 starter

Same generic business site as the other starters, built on **Nuxt 4** (Vue 3 + Nitro). The shape is closest to the Astro + SvelteKit starters: every render runs on Nitro, the SDK lives in `server/utils/`, and the home page is `useFetch`-loaded against a Nitro endpoint that aggregates all the data.

## What's new (SDK 0.9.53)

Three additions, all following the same Nitro conventions as the rest of the starter:

- **AEO / `llms.txt`** — `server/routes/llms.txt.ts` serves the org-curated llms.txt (Dashboard → Marketing → AI Distribution) from this domain's root via `llmsTxtHandler` from `@businessdash/sdk/distribution` — the only place AI crawlers look for it. The companion **product feed** needs no route at all: build its URL with `productFeedUrl({ siteId, baseUrl })` and submit it straight to merchant/feed programs (it's an OpenAI merchant-feed-shaped artifact, submittable as-is).
- **MCP connector proxy** — `server/api/mcp.{post,get}.ts` + `server/routes/.well-known/mcp.json.ts` mount `mcpHandler` / `mcpManifestHandler` from `@businessdash/sdk/mcp`, so the URL an org hands to Claude / ChatGPT / Gemini is *this site's* `/api/mcp`. The proxy is thin by design — the platform still enforces the org's MCP opt-in and per-tool write gates.
- **Todos — relational custom-collections demo** — `biab.data-model.config.ts` declares two collections with the `collection()` + `bd` builders: `todos` (title / done / notes) and `todoImages`, whose `todo` field is a **relation** back to `todos`. `npm run sync-data-model` pushes the model (promote it in the dashboard, then set the generated "Todo Form" Live). `/todos` (`app/pages/todos.vue`) lists todos with their images via `dataModel.listRecords({ object })` — relations come back as links, joined in `server/api/biab/todos.get.ts` — and creates todos by submitting the generated form through the existing `/api/biab/forms/[slug]` proxy. Reads need the `metadata:read_records` scope on your key.

```sh
npm run sync-data-model    # push the todos data model (+ generated form) to BIAB's draft slot
npm run print-data-model   # print the resolved data model as JSON
```

## Why Nuxt's shape is clean

Nuxt 4 has clear conventions for the SDK boundary:

- **`server/utils/biab.ts`** — Nuxt auto-imports this into every Nitro route. It only bundles to the server output. The bearer key never enters the client chunk.
- **`server/api/biab/*.ts`** — file-based Nitro endpoints. One file per HTTP method (`home.get.ts`, `bookings.post.ts`). No router setup.
- **`useFetch`** in the page runs server-side during SSR and reuses the result on the client — no second round-trip. The home payload is one request that fans out five SDK calls server-side.
- **`runtimeConfig`** keeps env values under a non-public namespace by default — they're read at request time, never inlined into the bundle.

```
browser → page request → useFetch('/api/biab/home') → biab.gallery.list(...) → BIAB
        ↘ client event → $fetch('/api/biab/scheduling/slots') → biab.scheduling.getAvailableSlots(...) → BIAB
                                                              ↑
                                                              └ SDK only in server/utils + server/api
```

## Setup

```sh
npm install     # or pnpm / bun
cp .env.example .env
# Fill NUXT_BIAB_API_KEY, NUXT_BIAB_SITE_ID, NUXT_BIAB_PACKAGE_API_BASE_URL

npm run dev
```

### Env vars (Nuxt `runtimeConfig`)

Nuxt maps `NUXT_*` process env onto non-public `runtimeConfig` keys, so none of these reach the client bundle.

| Env var | `runtimeConfig` key | Used by |
| --- | --- | --- |
| `NUXT_BIAB_API_KEY` | `biabApiKey` | Every SDK call (server-only). |
| `NUXT_BIAB_SITE_ID` | `biabSiteId` | Site binding. |
| `NUXT_BIAB_PACKAGE_API_BASE_URL` | `biabPackageApiBaseUrl` | BIAB host (default `https://www.biab.app`). |
| `NUXT_BIAB_REVALIDATION_SECRET` | `biabRevalidationSecret` | Revalidation webhook HMAC. |
| `NUXT_BIAB_AUTH_CALLBACK_URL` | `biabAuthCallbackUrl` | Auth handler `/callback` (sign-in/up + customer portal). Register it as a WorkOS redirect URI: `https://your-site.com/api/biab-auth/callback`. |

Every surface no-ops gracefully when these are unset — pages still render with placeholder/empty states.

### CLI scripts (schema sync)

```sh
npm run sync-schema    # publish biab.config.ts schema to BIAB's draft slot
npm run sync-content   # (optional) push local JSON content tree to BIAB
npm run print-schema   # print the resolved schema as JSON
```

Open http://localhost:3000.

For production:

```sh
npm run build
node .output/server/index.mjs
```

The output is a Node server by default; Nitro presets cover Vercel / Cloudflare / Netlify / Deno / Bun / static — set the preset via `NITRO_PRESET=vercel npm run build` or `nuxt.config.ts`.

## What's in each section

### Home (baseline)

| Section | Where it lives | SDK call |
| --- | --- | --- |
| **Hero / About / Services** | `useFetch('/api/biab/home')` reads marketing bundle, passes to component props | `biab.marketing.getPageBundle(...)` |
| **Gallery** | Same endpoint with const-generic field selection | `biab.gallery.list({ limit: 12, fields: [...] as const })` |
| **Blog** | Same endpoint | `biab.blog.listPosts({ limit: 6 })` |
| **Booking** | Event-type list server-rendered; slots + confirm via `/api/biab/scheduling/{slots,bookings}` | `biab.scheduling.listEventTypes()`, `getAvailableSlots(...)`, `confirmBooking(...)` |
| **Contact form** | Form schema server-rendered; submit via `/api/biab/forms/[slug]` | `biab.forms.schema(slug)`, `biab.forms.submit(...)` |
| **News banner** | `bundle.banner` surfaced by the home aggregator → `components/biab/NewsBanner.vue` (dismissible bar) | `biab.marketing.getPageBundle(...)` (untyped `banner` passthrough) |
| **JSON-LD** | `useFetch('/api/biab/jsonld')` → injected into `<head>` via `useHead({ script })` | `localBusiness()` + `website()` + `renderJsonLdToHtml()` from `@businessdash/sdk/seo` |

### Storefront / commerce

Visitor-token cart pattern: a UUID stored in an httpOnly cookie named `biab_cart_visitor` (`server/utils/biab-cart.ts`) keys the cart. Reads never mint the cookie; the first mutation does.

| Surface | Page | Endpoint(s) | SDK call |
| --- | --- | --- | --- |
| **Product list** | `app/pages/store/index.vue` | `GET /api/biab/store/products` | `biab.storefront.listProducts(...)` |
| **Product detail** | `app/pages/store/[id].vue` | `GET /api/biab/store/product/[id]` | `biab.storefront.getProduct(id)` |
| **Cart** | `app/pages/cart.vue` (via `composables/useCart.ts`) | `GET /api/biab/cart`, `POST /api/biab/cart/{add,update,remove,coupon,clear}` | `biab.cart.forVisitor(token).{get,addItem,updateItem,removeItem,applyCoupon,removeCoupon,clear}` |
| **Checkout** | Cart page "Checkout" button | `POST /api/biab/checkout/start` → redirect to Stripe | `biab.checkout.forVisitor(token).start({ successUrl, cancelUrl })` |
| **Subscriptions** | `app/pages/subscriptions.vue` | `GET /api/biab/store/subscriptions` | `biab.subscriptions.list()` |

### Auth + customer portal

| Surface | Page / route | SDK call |
| --- | --- | --- |
| **Auth handler** | `server/api/biab-auth/[...slug].ts` (catch-all) — bridges H3 ⇄ web `Request`/`Response` via `toWebRequest` + `sendWebResponse` | `createAuthHandler({ ... })` → `{ GET, POST }`. Sub-routes: `sign-in`, `sign-up`, `callback`, `sign-out`, `password-reset`, `me`. Mints the `biab_session` cookie. |
| **My account** | `app/pages/my-account.vue` | `GET /api/biab/portal/context` → `getTenantSession(...)` + `customerPortal(org).withSession(token).getWork()` |
| **Review submission** | `components/biab/ReviewForm.vue` | `POST /api/biab/portal/submit-review` → `customerPortal(org).withSession(token).submitReview(...)` |

Sign-in / sign-up / sign-out are plain links (`<a href="/api/biab-auth/sign-in">` …) — no client SDK needed.

### Reviews wall, updates, SEO, parallel pages

| Surface | Page / route | Endpoint | SDK call |
| --- | --- | --- | --- |
| **Reviews wall** | `app/pages/reviews.vue` (aggregate + first page + "load more") | `GET /api/biab/reviews?limit=&offset=` | `biab.reviews.list({ limit, offset })` |
| **Updates feed** | `app/pages/updates.vue` | `GET /api/biab/home` (`updates`) | `bundle.updates` (untyped passthrough) |
| **Sitemap** | `server/routes/sitemap.xml.ts` (proxy) | `GET /sitemap.xml` | `biab.parallelPages.sitemapUrl()` |
| **robots.txt** | `server/routes/robots.txt.ts` (proxy) | `GET /robots.txt` | `biab.parallelPages.robotsUrl()` |
| **Service-area index** | `app/pages/services/index.vue` | `GET /api/biab/parallel/variants?key=service-area` | `biab.parallelPages.listVariants("service-area")` |
| **Service-area page** | `app/pages/services/[service]/[area].vue` | `GET /api/biab/parallel/render?key=service-area&service=&area=` | `biab.parallelPages.render("service-area", { service, area })` |

The static `public/robots.txt` was removed so the dynamic `server/routes/robots.txt.ts` proxy serves it (Nitro serves `public/` files ahead of server routes).

### Suspension handling

The store, subscriptions, and parallel-page render endpoints catch `BiabPaymentLapsedError` / `BiabServiceSuspendedError` and degrade to a "temporarily unavailable" state (the parallel-page render returns a 503 when suspended).

## Adding a new SDK surface

1. **Static section** — add a field to `HomeData` in `server/api/biab/home.get.ts` and a new component that takes the prop.
2. **Interactive surface** — add a new file under `server/api/biab/<route>.<method>.ts` (Nuxt auto-routes based on filename), then `$fetch('/api/biab/<route>', …)` from the Vue component.

## Webhook revalidation (built in)

`server/api/biab/revalidate.post.ts` mounts the SDK's framework-agnostic handler. Register the URL in BIAB at `/dashboard/settings/integrations`, paste the `whsec_…` into `NUXT_BIAB_REVALIDATION_SECRET`, and BIAB POSTs a signed `content.published` event on every publish.

Nuxt SSR re-fetches per request so the callback is a logger today — when you add response caching (Nitro route rules with `cache: true`, Vercel edge `Cache-Tag` purge, etc.), the `onTagsRevalidated` callback is where to wire it.

## Project layout (BIAB-relevant only)

```
.
├── biab.config.ts                              # Marketing schema + parallel-page def
├── nuxt.config.ts                              # CSS, runtimeConfig
├── server/
│   ├── utils/
│   │   ├── biab.ts                             # High-level SDK client (auto-imported)
│   │   ├── biab-env.ts                         # Raw baseUrl/apiKey/callback resolution
│   │   ├── biab-cart.ts                        # Visitor-token cookie + cart-mutation runner
│   │   └── biab-portal.ts                      # Session + customer-portal helpers
│   ├── routes/
│   │   ├── sitemap.xml.ts                      # Proxy → parallelPages.sitemapUrl()
│   │   └── robots.txt.ts                       # Proxy → parallelPages.robotsUrl()
│   └── api/
│       ├── biab-auth/
│       │   └── [...slug].ts                    # createAuthHandler catch-all (H3 ⇄ Fetch)
│       └── biab/
│           ├── home.get.ts                     # Aggregator (sections + banner + updates + company)
│           ├── jsonld.get.ts                   # JSON-LD (LocalBusiness + WebSite)
│           ├── reviews.get.ts                  # Reviews wall page (paginated)
│           ├── revalidate.post.ts              # Webhook receiver
│           ├── cart/
│           │   ├── index.get.ts                # Read-only snapshot
│           │   ├── add.post.ts  update.post.ts  remove.post.ts
│           │   ├── coupon.post.ts  clear.post.ts
│           ├── checkout/start.post.ts          # Stripe-hosted checkout
│           ├── store/
│           │   ├── products.get.ts  subscriptions.get.ts
│           │   └── product/[id].get.ts
│           ├── portal/
│           │   ├── context.get.ts              # Session + work bundle
│           │   └── submit-review.post.ts
│           ├── parallel/
│           │   ├── variants.get.ts  render.get.ts
│           │   ├── scheduling/{slots.get.ts,bookings.post.ts}
│           └── forms/[slug].post.ts
├── app/
│   ├── app.vue                                 # Root layout
│   ├── composables/useCart.ts                  # Client cart helper + formatMoney
│   ├── pages/
│   │   ├── index.vue                           # Home (useFetch + sections + banner + JSON-LD)
│   │   ├── store/index.vue  store/[id].vue
│   │   ├── cart.vue  subscriptions.vue
│   │   ├── my-account.vue  reviews.vue  updates.vue
│   │   └── services/index.vue  services/[service]/[area].vue
│   ├── components/biab/
│   │   ├── BiabHeader.vue  BiabFooter.vue
│   │   ├── Hero.vue  About.vue  Services.vue  Gallery.vue  Blog.vue
│   │   ├── Booking.vue  ContactForm.vue
│   │   ├── NewsBanner.vue                      # Dismissible bundle.banner bar
│   │   └── ReviewForm.vue                      # Customer review form
│   └── assets/css/biab-tokens.css              # BIAB CSS variables
├── .env.example
└── package.json
```

## Vue 3 idioms used

- `<script setup lang="ts">` + Composition API throughout
- `defineProps<{ … }>()` for typed component props
- `ref` / `reactive` for client state, `watch` for "re-run when X changes"
- `v-for`, `v-if`, `v-else`, `<template v-if=…>` for control flow
- `v-model` two-way binding on form inputs
- `$fetch` for client-side calls to the Nitro endpoints
- `useFetch` for SSR-aware data loading

The BIAB layer doesn't care which framework lives on top — Vue components just receive plain data from the endpoint and call `$fetch` for mutations.


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
