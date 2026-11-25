# BD SDK — Vanilla JS starter

The same generic business site as the React-Bun starter, but with **zero framework** in the browser. Pure HTML + ES modules + DOM. One Bun process serves both the static files and the same-origin `/api/bd/*` proxy.

## What's new (SDK 0.9.53)

Three additions. The Bun server is the key-holder here as always, and the SDK's new handlers are plain web `Request → Response` functions, so they mount straight into the dispatch in `server.ts`:

- **AEO / `llms.txt`** — `GET /llms.txt` serves the org-curated llms.txt (Dashboard → Marketing → AI Distribution) from this domain's root via `llmsTxtHandler` from `@businessdash/sdk/distribution` — the only place AI crawlers look for it. The companion **product feed** needs no route: build its URL with `productFeedUrl({ siteId, baseUrl })` and submit it straight to merchant/feed programs (it's an OpenAI merchant-feed-shaped artifact, submittable as-is).
- **MCP connector proxy** — `POST /api/mcp` (JSON-RPC, with the spec's 405 on GET) and `GET /.well-known/mcp.json` (discovery manifest) via `mcpHandler` / `mcpManifestHandler` from `@businessdash/sdk/mcp`, so the URL an org hands to Claude / ChatGPT / Gemini is *this site's* `/api/mcp`. Thin by design — the platform still enforces the org's MCP opt-in and per-tool write gates. These take the BD app *origin* (`hostBase`), not the package API base.
- **Todos — relational custom-collections demo** — `bd.data-model.config.ts` declares two collections with the `collection()` + `bd` builders: `todos` (title / done / notes) and `todoImages`, whose `todo` field is a **relation** back to `todos`. `bun run sync-data-model` pushes the model (promote it in the dashboard, then set the generated "Todo Form" Live). `/todos` (`public/pages/todos.js`) lists todos with their images through `bd.todos.list()` → `GET /api/bd/todos`, where the server reads both collections via `dataModel.listRecords({ object })` and joins the relation links; creating a todo goes through `bd.forms.submit("todo-form", …)` — the same forms proxy the contact form uses, and the SDK's documented create path for custom collections. Reads need the `metadata:read_records` scope on your key.

```sh
bun run sync-data-model    # push the todos data model (+ generated form) to BD's draft slot
bun run print-data-model   # print the resolved data model as JSON
```

## Why this exists

Two reasons to keep a no-build starter around:

1. **It's the clearest read of what the browser actually does** — no JSX, no Suspense, no virtual DOM. Each section is a function that takes a parent element and renders into it via `document.createElement`.
2. **The SDK pattern is framework-agnostic.** This template makes that visible: every section calls `bd.X.method(...)` from `/public/bd.js`, which hits same-origin `/api/bd/*`, which the Bun server forwards to BD through `@businessdash/sdk`. The same shape ships in the React, Astro, Nuxt, Svelte, Qwik, T3, and Tanstack starters — only the rendering layer differs.

## Setup

```sh
bun install
cp .env.example .env.local
# Fill BD_API_KEY, BD_SITE_ID, BD_PACKAGE_API_BASE_URL

bun run dev    # auto-reload Bun process serves public/ + /api/bd/*
# or
bun run start  # same, no watcher
```

Open http://localhost:3000. With no BD env set, the API routes return 503 and
every page renders its empty/fallback state — so the site is never blank.

<!-- [bd:tailwind] -->
## Tailwind CSS

Tailwind is set up for your own markup. There's no bundler here, so the server builds `src/tailwind.css` with Tailwind's engine (`lib/tailwind.ts`) and serves it at `/tailwind.css`, which every page links. Use Tailwind's classes anywhere in `public/` or `src/`; in development a new class shows up on reload, and in production the CSS is built once. The starter's pages, shop, blog and reviews style themselves with `public/styles.css` and the `bd-*.css` files, so they look the same with Tailwind or without it. Preflight, Tailwind's reset, is off for that reason; `src/tailwind.css` says how to turn it on.

<!-- [/bd:tailwind] -->
## How it's wired

```
browser → /api/bd/<route> → Bun (server.ts) → BD Package API
        ↑                    ↑
        └ vanilla JS fetch   └ @businessdash/sdk holds the API key
```

- `server.ts` — Bun HTTP server. Builds `createBdClient` once with the bearer key, mounts the WorkOS auth handler + revalidation webhook, proxies every SDK surface under `/api/bd/*`, proxies `/sitemap.xml` + `/robots.txt`, and server-renders the feature pages (with JSON-LD injected into `<head>`).
- `lib/cache.ts` — tiny in-memory, tag-keyed TTL cache. The revalidation webhook busts it (a plain server has no `revalidateTag`).
- `lib/shop/*.ts` — the shop's rules (`shop.ts`: prices, options, photos), the small framework-free custom elements that bring the shop's and blog's parts to life (`<bd-product-form>`, `<bd-gallery>`, `<bd-share>`, `<bd-addon>`, `<bd-save-buttons>`, `<bd-recently-viewed>`, `<bd-compare-bar>`, `<bd-wishlist>`, `<bd-compare>`, `<bd-post-like>`, `<bd-post-comments>`), and `safePostHtml`, which the server runs on every post. The pages load plain ES modules, so the server bundles `shop.ts`, `shop-elements.ts` and `blog-elements.ts` with Bun.build and serves them at `/shop/*.js`. Styled by `public/bd-shop.css` and `public/bd-blog.css`. <!-- [bd-line:store,blog] -->
- `lib/shop/reviews*.ts` — the business reviews: the rules every BD starter shares (`reviews.ts`), the page's data (`reviews-page.ts`, which `GET /api/bd/reviews/page` runs) and `<bd-review-writer>` (`reviews-elements.ts`, served at `/shop/reviews-elements.js`), which posts to `POST /api/bd/reviews/write`. Styled by `public/bd-reviews.css`.
- `public/index.html` — the home shell with anchor divs (`#hero`, `#gallery`, …) + the news-banner mount.
- `public/bd.js` — vanilla client mirroring the SDK's method names (JSDoc-typed, no build step). Exports `el` / `money` / `dollars` DOM helpers.
- `public/banner.js` — the dismissible `bundle.banner`.
- `public/sections/*.js` — the home-page sections (one `render(target)` each).
- `public/sections/shop/*.js` — the shop's parts, one function per file, each returning its markup, so you can move, restyle or drop one, or build your own pages from them. Store: `storeSearch`, `categoryFilter`, `priceFilter`, `ratingFilter`, `clearFilters`, `sortSelect` (with `store-filters.js` for the URL), `productGrid`, `productCard`, `saveButtons`, `compareBar`. Product (`productDetail`): `productBreadcrumbs`, `productGallery`, `productTitle`, `productPrice`, `variantPicker`, `optionPicker`, `stockNote`, `quantityStepper`, `addToCartButton`, `cartNotice`, `saveButtons`, `shareButton`, `productPolicies`, `productSpecs`, `productAddons`, `productReviews`, `productRail`, `recentlyViewed`, `compareBar`. Cart: `cartLine`, `couponForm`, `cartSummary`, `cartActions`. `<bd-product-form>` and `<bd-gallery>` find the product parts by their `data-bd-*` attributes, so keep those when you change a part's markup. <!-- [bd-line:store] -->
- `public/sections/blog/*.js` — the blog's parts: `blogFilters` and `postCard` for the list; `postMeta`, `postBody` (or `membersOnly`), `postCta`, `postTags`, `likeButton` and `comments` for a post. <!-- [bd-line:blog] -->
- `public/sections/reviews/*.js` — the reviews page's parts: `ratingSummary` (the average, a bar per star and the writer), `reviewFilter` (the platform links) and `reviewCard` (one review).
- `public/pages/*.js` — one module per feature page (store, cart, subscriptions, my-account, reviews, updates, services, …).
- `public/main.js` — home entry point; mounts every section.

## Feature parity (BD SDK 0.9.5)

This starter is aligned, surface-for-surface, with the production reference
consumer. Everything below is wired and degrades gracefully when BD env is
unset.

| Surface | Route(s) / page | SDK calls |
| --- | --- | --- |
| **Home sections** | `/` (`sections/*`) | `marketing.getPageBundle`, `gallery.list`, `blog.listPosts`, `scheduling.*`, `forms.*` |
| **Storefront** | `/store`, `/store/:id` | `storefront.listProductsWithMeta` (search, category, price, rating and sort, all in the URL), `storefront.listCategories`, `storefront.getProduct`, `storefront.getProductReviews`, `storefront.getRelatedProducts`, `storefront.getProductAddons`. The product page has option photos, option and size buttons, add to cart with the chosen options, save, compare, share, add-ons, reviews, related and recently viewed. | <!-- [bd-line:store] -->
| **Wishlist + compare** | `/store/wishlist`, `/store/compare?ids=a,b` | Saved in the shopper's browser; the compare table loads each product with `storefront.getProduct` | <!-- [bd-line:store] -->
| **Blog** | `/blog`, `/blog/:slug` | `blog.listPosts` (category, tag, paging), `blog.listCategories`, `blog.listTags`, `blog.getPost` (HTML made safe on the server), `blog.withSession(token).{likeStatus,toggleLike,postComment}`, `blog.listComments` — liking and commenting need a signed-in customer | <!-- [bd-line:blog] -->
| **Newsletter** | About section + footer | `followers.join` via the browser-safe publishable token (`window.__BD_PUBLIC__`), with a `bd.followers.<siteId>` localStorage "already subscribed" hint |
| **Cart** | `/cart` | `cart.forVisitor(token).{get,addItem,updateItem,removeItem,applyCoupon,removeCoupon,clear}` — visitor token in an httpOnly `bd_cart_visitor` cookie | <!-- [bd-line:store] -->
| **Checkout** | `/cart` → Stripe | `checkout.forVisitor(token).start` (→ Stripe URL), `checkout.getStatus` | <!-- [bd-line:store] -->
| **Subscriptions** | `/subscriptions` | `subscriptions.list` | <!-- [bd-line:subscriptions] -->
| **Reviews** | `/reviews` | `bundle.reviews` (`rating`, `counts`) for the average and a bar per star; `reviews.list({ limit, offset, source })` for the platform filter (`?source=`) and "Show more" (`?shown=`), with each review's photos, Verified and a "Read on Google/Yelp" link; `customerPortal(org).withSession(token).submitReview` for "Write a review" (signed in) |
| **News banner + updates** | banner on every page, `/updates` | `bundle.banner`, `bundle.updates` |
| **Auth + portal** | `/api/bd-auth/*`, `/my-account` | `createAuthHandler`, `getTenantSession`, `customerPortal(org).withSession(token).{getWork,submitReview}` |
| **Programmatic SEO** | `/services`, `/services/:service/:area` | `parallelPages.listVariants`, `parallelPages.render` |
| **SEO files** | `/sitemap.xml`, `/robots.txt` | proxied from BD; JSON-LD via `@businessdash/sdk/seo` (`localBusiness` + `website`) |
| **Revalidation webhook** | `POST /api/bd/revalidate` | `createGenericRevalidateHandler` → busts `lib/cache.ts` |

### Schema CLI

`bd.config.ts` declares the marketing schema + brand tokens + managed-data
sections + a `defineParallelPage`. Publish/inspect it with:

```sh
bun run sync-schema     # push the schema to BD's draft slot (then promote in the dashboard)
bun run sync-content    # (optional) push a local content tree
bun run print-schema    # print the resolved schema JSON
```

## Environment

| Var | Required | Purpose |
| --- | --- | --- |
| `BD_API_KEY` | for live data | Server-side bearer key |
| `BD_SITE_ID` | for live data | Your site UUID |
| `BD_PACKAGE_API_BASE_URL` | for live data | BD host (e.g. `https://businessdash.us`) |
| `BD_PK` | for newsletter | Browser-safe publishable token (`pk_…`, `followers:self`). Injected as `window.__BD_PUBLIC__`; unset → subscribe form shows a "coming soon" placeholder |
| `BD_REVALIDATION_SECRET` | for webhook | HMAC secret (`whsec_…`) verifying publish events |
| `BD_AUTH_CALLBACK_URL` | for auth/portal | This server's `/api/bd-auth/callback` URL (register in WorkOS) |
| `PORT` | no | Defaults to 3000 |

## Adding a new SDK surface

One entry in the server route table + one method on the browser client.

1. In `server.ts`, add an entry to `routes` (or `patternRoutes` for dynamic segments) that wraps the SDK call — wrap reads in `cached(key, tags, fn)` so the webhook can invalidate them.
2. In `public/bd.js`, add a method that hits that path.
3. Call it from a section or page module.

## Project layout

```
.
├── server.ts                       # Bun proxy — key holder, auth, webhook, SEO, page render
├── bd.config.ts                  # Marketing schema + brand tokens + parallel page
├── lib/
│   ├── cache.ts                    # In-memory tag cache (webhook target)
│   └── shop/                       # Shop rules, and shop, blog and review custom elements, served at /shop/*.js
├── public/
│   ├── index.html                  # Home shell + banner mount
│   ├── styles.css                  # BD CSS vars + section + feature-page styles
│   ├── bd-shop.css                 # The store's styles <!-- [bd-line:store] -->
│   ├── bd-blog.css                 # The blog's styles <!-- [bd-line:blog] -->
│   ├── bd-reviews.css              # The reviews page's styles
│   ├── bd.js                     # Typed browser fetcher (JSDoc) + el/money/dollars
│   ├── banner.js                   # Dismissible bundle.banner
│   ├── main.js                     # Mounts home sections
│   ├── sections/                   # Home sections (hero/about/services/gallery/blog/booking/contact-form)
<!-- [bd:store] -->
│   │   ├── shop/                   # The shop's parts: product page, store, cart
<!-- [/bd:store] -->
<!-- [bd:blog] -->
│   │   ├── blog/                   # The blog's parts: post card, meta, body, likes, comments
<!-- [/bd:blog] -->
│   │   └── reviews/                # The reviews page's parts: summary, filter, card
│   └── pages/                      # Feature pages
│       ├── _ui.js                  # Shared errBox / pageHead
<!-- [bd:store] -->
│       ├── store.js  product.js  wishlist.js  compare.js  cart.js
<!-- [/bd:store] -->
<!-- [bd:store,subscriptions] -->
│       ├── _store-nav.js           # The store bar: products, plans, wishlist, compare, cart
<!-- [/bd:store,subscriptions] -->
<!-- [bd:blog] -->
│       ├── blog.js  blog-post.js
<!-- [/bd:blog] -->
<!-- [bd:subscriptions] -->
│       ├── subscriptions.js
<!-- [/bd:subscriptions] -->
│       ├── reviews.js  updates.js  my-account.js
│       └── services.js  services-area.js
├── tsconfig.json                   # Server-only TS settings
├── .env.example
└── package.json
```


<!-- [bd:donations] -->
## Donations

One-time and monthly gifts, paid to the org's own Stripe account. Your app
reads the giving page, posts the gift, and sends the donor to the Stripe URL it
gets back; BusinessDash records the gift, adds the donor as a contact, notifies
the org and emails the receipt. The full guide, with this starter's code in its
own tab: [Donations](https://businessdash.us/docs/developer/byFeature/donations).

> `client.donations` needs `@businessdash/sdk` 0.9.91 or later, which this
> starter pins. An app made from an older copy upgrades zod in the same step,
> since 0.9.91 is built on zod 4: `pnpm up @businessdash/sdk zod@^4.6.7`.

Two routes in `server.ts`, using its `bd` client; `public/pages/give.js` fetches `/api/give` and renders the form:

```ts
if (bd && pathname === '/api/give') return Response.json(await bd.donations.get())
if (bd && method === 'POST' && pathname === '/give') {
  const form = await req.formData()
  const { url: stripe } = await bd.donations.startCheckout({
    amountCents: Number(form.get('amount')),
    frequency: form.get('monthly') ? 'monthly' : 'one_time',
    donor: { name: String(form.get('name')), email: String(form.get('email')) },
    successUrl: `${url.origin}/give/thanks`,
    cancelUrl: `${url.origin}/give`,
  })
  return Response.redirect(stripe, 303)
}
```

Set `taxStatement` with `textContent`, not `innerHTML`.

Three rules:

- **Render `taxStatement` as given.** It says whether the gift is
  tax-deductible (it isn't, unless the org registered as a 501(c)(3) and
  entered its EIN), and it matches the receipt word for word. Don't write that
  sentence yourself.
- **Check `unavailable` first.** `"disabled"` or `"payments_not_ready"` means
  no form; show a fallback instead.
- **The key needs `donations:give`.** Keys made under Site Builder ▸ Developer
  include it by default; keys made before donations shipped don't, and scopes
  can't be added later, so mint a new key.
- **Return URLs must be on a verified domain** (Settings → Organization), or
  the call fails with `400 return_url_not_verified`. `localhost` works in
  development.
<!-- [/bd:donations] -->

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

This starter ships a basic **Acme** demo content tree under `src/content/en/` (`companyInfo`, `brand`, `hero`, `about`) so the site renders out of the box — replace it with your own and re-run `sync-content`.

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
