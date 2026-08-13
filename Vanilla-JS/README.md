# BIAB SDK — Vanilla JS starter

The same generic business site as the React-Bun starter, but with **zero framework** in the browser. Pure HTML + ES modules + DOM. One Bun process serves both the static files and the same-origin `/api/biab/*` proxy.

## What's new (SDK 0.9.53)

Three additions. The Bun server is the key-holder here as always, and the SDK's new handlers are plain web `Request → Response` functions, so they mount straight into the dispatch in `server.ts`:

- **AEO / `llms.txt`** — `GET /llms.txt` serves the org-curated llms.txt (Dashboard → Marketing → AI Distribution) from this domain's root via `llmsTxtHandler` from `@businessdash/sdk/distribution` — the only place AI crawlers look for it. The companion **product feed** needs no route: build its URL with `productFeedUrl({ siteId, baseUrl })` and submit it straight to merchant/feed programs (it's an OpenAI merchant-feed-shaped artifact, submittable as-is).
- **MCP connector proxy** — `POST /api/mcp` (JSON-RPC, with the spec's 405 on GET) and `GET /.well-known/mcp.json` (discovery manifest) via `mcpHandler` / `mcpManifestHandler` from `@businessdash/sdk/mcp`, so the URL an org hands to Claude / ChatGPT / Gemini is *this site's* `/api/mcp`. Thin by design — the platform still enforces the org's MCP opt-in and per-tool write gates. These take the BIAB app *origin* (`hostBase`), not the package API base.
- **Todos — relational custom-collections demo** — `biab.data-model.config.ts` declares two collections with the `collection()` + `bd` builders: `todos` (title / done / notes) and `todoImages`, whose `todo` field is a **relation** back to `todos`. `bun run sync-data-model` pushes the model (promote it in the dashboard, then set the generated "Todo Form" Live). `/todos` (`public/pages/todos.js`) lists todos with their images through `biab.todos.list()` → `GET /api/biab/todos`, where the server reads both collections via `dataModel.listRecords({ object })` and joins the relation links; creating a todo goes through `biab.forms.submit("todo-form", …)` — the same forms proxy the contact form uses, and the SDK's documented create path for custom collections. Reads need the `metadata:read_records` scope on your key.

```sh
bun run sync-data-model    # push the todos data model (+ generated form) to BIAB's draft slot
bun run print-data-model   # print the resolved data model as JSON
```

## Why this exists

Two reasons to keep a no-build starter around:

1. **It's the clearest read of what the browser actually does** — no JSX, no Suspense, no virtual DOM. Each section is a function that takes a parent element and renders into it via `document.createElement`.
2. **The SDK pattern is framework-agnostic.** This template makes that visible: every section calls `biab.X.method(...)` from `/public/biab.js`, which hits same-origin `/api/biab/*`, which the Bun server forwards to BIAB through `@businessdash/sdk`. The same shape ships in the React, Astro, Nuxt, Svelte, Qwik, T3, and Tanstack starters — only the rendering layer differs.

## Setup

```sh
bun install
cp .env.example .env.local
# Fill BIAB_API_KEY, BIAB_SITE_ID, BIAB_PACKAGE_API_BASE_URL

bun run dev    # auto-reload Bun process serves public/ + /api/biab/*
# or
bun run start  # same, no watcher
```

Open http://localhost:3000. With no BIAB env set, the API routes return 503 and
every page renders its empty/fallback state — so the site is never blank.

## How it's wired

```
browser → /api/biab/<route> → Bun (server.ts) → BIAB Package API
        ↑                    ↑
        └ vanilla JS fetch   └ @businessdash/sdk holds the API key
```

- `server.ts` — Bun HTTP server. Builds `createBiabClient` once with the bearer key, mounts the WorkOS auth handler + revalidation webhook, proxies every SDK surface under `/api/biab/*`, proxies `/sitemap.xml` + `/robots.txt`, and server-renders the feature pages (with JSON-LD injected into `<head>`).
- `lib/cache.ts` — tiny in-memory, tag-keyed TTL cache. The revalidation webhook busts it (a plain server has no `revalidateTag`).
- `public/index.html` — the home shell with anchor divs (`#hero`, `#gallery`, …) + the news-banner mount.
- `public/biab.js` — vanilla client mirroring the SDK's method names (JSDoc-typed, no build step). Exports `el` / `money` / `dollars` DOM helpers.
- `public/banner.js` — the dismissible `bundle.banner`.
- `public/sections/*.js` — the home-page sections (one `render(target)` each).
- `public/pages/*.js` — one module per feature page (store, cart, subscriptions, my-account, reviews, updates, services, …).
- `public/main.js` — home entry point; mounts every section.

## Feature parity (BIAB SDK 0.9.5)

This starter is aligned, surface-for-surface, with the production reference
consumer. Everything below is wired and degrades gracefully when BIAB env is
unset.

| Surface | Route(s) / page | SDK calls |
| --- | --- | --- |
| **Home sections** | `/` (`sections/*`) | `marketing.getPageBundle`, `gallery.list`, `blog.listPosts`, `scheduling.*`, `forms.*` |
| **Storefront** | `/store`, `/store/:id` | `storefront.listProductsWithMeta` (sidebar facets: category counts, price range, min-rating, sort), `storefront.listCategories`, `storefront.getProduct`, `storefront.getProductReviews`, `storefront.getRelatedProducts`, `storefront.getProductAddons` |
| **Newsletter** | About section + footer | `followers.join` via the browser-safe publishable token (`window.__BIAB_PUBLIC__`), with a `biab.followers.<siteId>` localStorage "already subscribed" hint |
| **Cart** | `/cart` | `cart.forVisitor(token).{get,addItem,updateItem,removeItem,applyCoupon,removeCoupon,clear}` — visitor token in an httpOnly `biab_cart_visitor` cookie |
| **Checkout** | `/cart` → Stripe | `checkout.forVisitor(token).start` (→ Stripe URL), `checkout.getStatus` |
| **Subscriptions** | `/subscriptions` | `subscriptions.list` |
| **Reviews wall** | `/reviews` | `reviews.list({ limit, offset })` with "load more" |
| **News banner + updates** | banner on every page, `/updates` | `bundle.banner`, `bundle.updates` |
| **Auth + portal** | `/api/biab-auth/*`, `/my-account` | `createAuthHandler`, `getTenantSession`, `customerPortal(org).withSession(token).{getWork,submitReview}` |
| **Programmatic SEO** | `/services`, `/services/:service/:area` | `parallelPages.listVariants`, `parallelPages.render` |
| **SEO files** | `/sitemap.xml`, `/robots.txt` | proxied from BIAB; JSON-LD via `@businessdash/sdk/seo` (`localBusiness` + `website`) |
| **Revalidation webhook** | `POST /api/biab/revalidate` | `createGenericRevalidateHandler` → busts `lib/cache.ts` |

### Schema CLI

`biab.config.ts` declares the marketing schema + brand tokens + managed-data
sections + a `defineParallelPage`. Publish/inspect it with:

```sh
bun run sync-schema     # push the schema to BIAB's draft slot (then promote in the dashboard)
bun run sync-content    # (optional) push a local content tree
bun run print-schema    # print the resolved schema JSON
```

## Environment

| Var | Required | Purpose |
| --- | --- | --- |
| `BIAB_API_KEY` | for live data | Server-side bearer key |
| `BIAB_SITE_ID` | for live data | Your site UUID |
| `BIAB_PACKAGE_API_BASE_URL` | for live data | BIAB host (e.g. `https://www.biab.app`) |
| `BIAB_PK` | for newsletter | Browser-safe publishable token (`pk_…`, `followers:self`). Injected as `window.__BIAB_PUBLIC__`; unset → subscribe form shows a "coming soon" placeholder |
| `BIAB_REVALIDATION_SECRET` | for webhook | HMAC secret (`whsec_…`) verifying publish events |
| `BIAB_AUTH_CALLBACK_URL` | for auth/portal | This server's `/api/biab-auth/callback` URL (register in WorkOS) |
| `PORT` | no | Defaults to 3000 |

## Adding a new SDK surface

One entry in the server route table + one method on the browser client.

1. In `server.ts`, add an entry to `routes` (or `patternRoutes` for dynamic segments) that wraps the SDK call — wrap reads in `cached(key, tags, fn)` so the webhook can invalidate them.
2. In `public/biab.js`, add a method that hits that path.
3. Call it from a section or page module.

## Project layout

```
.
├── server.ts                       # Bun proxy — key holder, auth, webhook, SEO, page render
├── biab.config.ts                  # Marketing schema + brand tokens + parallel page
├── lib/
│   └── cache.ts                    # In-memory tag cache (webhook target)
├── public/
│   ├── index.html                  # Home shell + banner mount
│   ├── styles.css                  # BIAB CSS vars + section + feature-page styles
│   ├── biab.js                     # Typed browser fetcher (JSDoc) + el/money/dollars
│   ├── banner.js                   # Dismissible bundle.banner
│   ├── main.js                     # Mounts home sections
│   ├── sections/                   # Home sections (hero/about/services/gallery/blog/booking/contact-form)
│   └── pages/                      # Feature pages
│       ├── _ui.js                  # Shared errBox / pageHead
│       ├── store.js  product.js  cart.js  subscriptions.js
│       ├── reviews.js  updates.js  my-account.js
│       └── services.js  services-area.js
├── tsconfig.json                   # Server-only TS settings
├── .env.example
└── package.json
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

This starter ships a basic **Acme** demo content tree under `src/content/en/` (`companyInfo`, `brand`, `hero`, `about`) so the site renders out of the box — replace it with your own and re-run `sync-content`.
