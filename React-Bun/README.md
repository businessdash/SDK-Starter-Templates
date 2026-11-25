# BD SDK — React + Bun starter

A generic business website wired against the **BD SDK** (`@businessdash/sdk`). Use it as a reference for how to consume BD data from a pure React SPA. The same canonical site ships across the other framework starters (Astro, Nuxt, Qwik, Svelte, T3-App, Tanstack-Start) — only the **transport** changes per framework.

## The pattern

A pure React SPA has no server, which means there's no safe place to hide an API key from the browser bundle. This template adds a tiny **Bun HTTP proxy** that:

1. Holds `BD_API_KEY` server-side and instantiates `createBdClient` from `@businessdash/sdk`.
2. Exposes a small set of `/api/bd/*` endpoints — each one is a one-liner wrapper around a single SDK call.
3. In production, serves the Vite-built `dist/` directory; in dev, Vite serves the SPA and forwards `/api/bd/*` to the Bun proxy via `vite.config.ts`.

```
browser → /api/bd/<route> → Bun (server.ts) → BD Package API
```

The browser bundle imports types from `@businessdash/sdk`, but never the runtime — it just hits same-origin paths. The bearer key stays in the Bun process.

## What's new (SDK 0.9.53)

Three additions, mirrored across every starter — all served by the Bun proxy (the key-holder), with the dev-server forwards already wired in `vite.config.ts`:

- **AEO / llms.txt** — the Bun server serves `/llms.txt` (the answer-engine index the org curates at BD → Marketing → AI Distribution) from this site's own root via `llmsTxtHandler` from `@businessdash/sdk/distribution`. The product feed needs no proxy — submit its BD URL (built by `productFeedUrl`) to merchant programs directly; `/ai/product-feed` is a convenience redirect to it.
- **MCP connector proxy** — `/api/mcp` (JSON-RPC) + `/.well-known/mcp.json` (discovery manifest) give this self-hosted domain the same per-site MCP connector the platform serves natively, via `mcpHandler` + `mcpManifestHandler` from `@businessdash/sdk/mcp`. The URL an org hands to Claude / ChatGPT / Gemini is their own site; BD still enforces the org's MCP opt-in and per-tool write gates.
- **Relational custom collections (`/todos`)** — `bd.data-model.config.ts` declares two related collections (`todos`, and `todoImages` with a required RELATION to `todos`) with the 0.9.50+ `collection()` + `bd` builders. Push with `bun run sync-data-model`, promote in the dashboard, set the generated "Todo Form" live, then open `/todos` — the SPA reads `GET /api/bd/todos` (the Bun server joins images onto their todo via `dataModel.listRecords`), and creates go through the generated `todo-form` over the existing forms proxy. Reads go through the data-model client, writes go through forms; there is no direct row-write API for consumers.

## Setup

```sh
bun install
cp .env.example .env.local
# Fill BD_API_KEY, BD_SITE_ID, BD_PACKAGE_API_BASE_URL

bun run dev
```

`bun run dev` starts both processes via `concurrently`:

- **Vite** on http://localhost:5173 (the SPA, with HMR)
- **Bun proxy** on http://localhost:3000 (`/api/bd/*` handler)

Open http://localhost:5173. Vite proxies API calls to the Bun server.

For production:

```sh
bun run build      # tsc + vite build → dist/
bun run preview    # bun server.ts serves dist/ + /api/bd/* on the same port
```

<!-- [bd:tailwind] -->
## Tailwind CSS

Tailwind is set up for your own markup: `src/tailwind.css` is imported in `src/main.tsx`, and `@tailwindcss/vite` builds it. Use its classes anywhere in `src/`. The starter's pages, shop, blog and reviews style themselves with `index.css` and the `bd-*.css` files, so they look the same with Tailwind or without it. Preflight, Tailwind's reset, is off for that reason; `src/tailwind.css` says how to turn it on.

<!-- [/bd:tailwind] -->
## What's in each section

Every section under `src/components/` exercises one SDK surface:

| Section | SDK call | What it shows |
| --- | --- | --- |
| **Hero / About / Services** | `bd.marketing.getPageBundle({ pageKey: "home" })` | Class A — admin-published marketing content with local fallbacks |
| **Gallery** | `bd.gallery.list({ limit: 12, fields: ["id", "src", "title", "category", "blurDataURL"] as const })` | **Typed field selection** — const-generic narrowing means the server SELECTs only the columns you asked for, and TS types `.map((item) => …)` accordingly |
| **Blog** | `bd.blog.listPosts({ limit: 6 })` | Class A — webhook-invalidated; new posts appear within seconds of publish | <!-- [bd-line:blog] -->
| **Booking** | `bd.scheduling.listEventTypes()` → `getAvailableSlots(slug, { from, to })` → `confirmBooking(...)` | Full Calendly-shape flow end-to-end | <!-- [bd-line:booking] -->
| **Contact form** | `bd.forms.schema(slug)` → render fields dynamically → `bd.forms.submit(slug, data, ...)` | Schema-driven form rendering + client-side validation against the same shape BD enforces server-side |

## Feature parity (BD SDK 0.9.5)

This starter is aligned, surface-for-surface, with the production reference
consumer. A tiny client router (`src/lib/router.tsx`) switches between the home
sections and the feature pages; every surface degrades gracefully when BD env
is unset.

| Surface | Route / page | SDK calls (proxied) |
| --- | --- | --- |
| **Home sections** | `/` | `marketing.getPageBundle`, `gallery.list`, `blog.listPosts`, `scheduling.*`, `forms.*` |
| **Storefront** | `/store`, `/store/:id` | `storefront.listProductsWithMeta` (search, category, price, rating, sort in the URL), `storefront.getProduct`, `getProductReviews`, `getRelatedProducts`, `getProductAddons` | <!-- [bd-line:store] -->
| **Wishlist + compare** | `/store/wishlist`, `/store/compare?ids=…` | saved in this browser; compare reads `storefront.getProduct` per id | <!-- [bd-line:store] -->
| **Cart** | `/cart` | `cart.forVisitor(token).{get,addItem,updateItem,removeItem,applyCoupon,removeCoupon,clear}` — `bd_cart_visitor` httpOnly cookie minted by the proxy | <!-- [bd-line:store] -->
| **Checkout** | `/cart` → Stripe | `checkout.forVisitor(token).start` | <!-- [bd-line:store] -->
| **Subscriptions** | `/subscriptions` | `subscriptions.list` | <!-- [bd-line:subscriptions] -->
| **Blog** | `/blog`, `/blog/:slug` | `blog.listPosts`, `listCategories`, `listTags`, `getPost`, `listComments`; likes and comments through `blog.withSession(token)` | <!-- [bd-line:blog] -->
| **Reviews** | `/reviews` | `bundle.reviews` (`rating`, `counts`), `reviews.list({ limit, offset, source })`, `customerPortal(org).withSession(token).submitReview` |
| **News banner + updates** | banner on every page, `/updates` | `bundle.banner`, `bundle.updates` |
| **Auth + portal** | `/api/bd-auth/*`, `/my-account` | `createAuthHandler`, `getTenantSession`, `customerPortal(org).withSession(token).{getWork,submitReview}` |
| **Programmatic SEO** | `/services`, `/services/:service/:area` | `parallelPages.listVariants`, `parallelPages.render` |
| **SEO files** | `/sitemap.xml`, `/robots.txt` | proxied from BD; JSON-LD injected into the served index.html in prod |
| **Revalidation webhook** | `POST /api/bd/revalidate` | `createGenericRevalidateHandler` → busts the proxy's in-memory tag cache |

### Environment

| Var | Required | Purpose |
| --- | --- | --- |
| `BD_API_KEY` / `BD_SITE_ID` / `BD_PACKAGE_API_BASE_URL` | for live data | Server-side SDK credentials (proxy only) |
| `BD_REVALIDATION_SECRET` | for webhook | HMAC secret verifying publish events |
| `BD_SITE_ORIGIN` | dev | The site's own origin (`http://localhost:5173` in dev), where "Continue with Google / Apple / GitHub / Discord" comes back |
| `BD_AUTH_CALLBACK_URL` | no | Only for the older hosted sign-in page; the sign-in screen on /my-account doesn't use it |
| `VITE_BD_SITE_ID` / `VITE_BD_PACKAGE_API_BASE_URL` / `VITE_BD_PUBLIC_KEY` | optional | Client-side analytics (`<BDAnalytics />`) — the public analytics key only |

### Schema CLI

```sh
bun run sync-schema     # publish bd.config.ts schema to BD's draft slot
bun run sync-content    # (optional) push a local content tree
bun run print-schema    # print the resolved schema JSON
```

## Adding a new SDK surface

The pattern is uniform: one entry in the server route table + one method on the browser client.

1. In `server.ts`, add a key like `"GET /api/bd/<your-route>"` with a handler that calls one SDK method and returns its JSON.
2. In `src/lib/bd.ts`, add a method that hits that same path.
3. In a component, import and use it.

That's the whole loop.

## Live updates (webhook revalidation)

BD POSTs to `/api/bd/revalidate` on every publish. The Bun proxy wraps its
SDK reads in a small in-memory **tag cache**, and the webhook
(`createGenericRevalidateHandler` from `@businessdash/sdk/adapters/revalidate`)
verifies the HMAC signature and evicts the matching cache entries — so the next
fetch returns fresh data within seconds of a publish, no redeploy. Set
`BD_REVALIDATION_SECRET` to enable it.

## Project layout

```
.
├── server.ts                 # Bun proxy — key holder, auth, webhook+cache, SEO, JSON-LD
├── bd.config.ts            # Marketing schema + brand tokens + parallel page
├── vite.config.ts            # Vite dev proxy → Bun server (api, auth, sitemap, robots)
├── src/
│   ├── App.tsx               # Router: home sections + feature pages
│   ├── lib/
│   │   ├── bd.ts           # Browser-side typed fetcher (no key) + money/dollars
│   │   └── router.tsx        # Tiny dependency-free client router
│   ├── components/
│   │   ├── Header.tsx  Footer.tsx  Banner.tsx
│   │   ├── Hero.tsx  About.tsx  Services.tsx  Gallery.tsx
<!-- [bd:blog] -->
│   │   ├── Blog.tsx           # latest posts on the home page
│   │   ├── blog/              # blog index, post, likes, comments, safePostHtml
<!-- [/bd:blog] -->
<!-- [bd:booking] -->
│   │   ├── Booking.tsx        # Calendly flow
<!-- [/bd:booking] -->
<!-- [bd:store,subscriptions] -->
│   │   ├── StoreNav.tsx       # store bar: products, plans, wishlist, compare, cart count
<!-- [/bd:store,subscriptions] -->
<!-- [bd:store] -->
│   │   ├── shop/              # product page, compare table, wishlist, save buttons
<!-- [/bd:store] -->
│   │   ├── reviews/           # reviews page parts + reviews.ts rules
│   │   ├── bd-link.tsx        # the link the shared shop/blog/review components use
│   │   └── ContactForm.tsx    # Forms schema + validator
<!-- [bd:store] -->
│   ├── bd-shop.css           # shop styles
<!-- [/bd:store] -->
<!-- [bd:blog] -->
│   ├── bd-blog.css           # blog styles
<!-- [/bd:blog] -->
│   ├── bd-reviews.css        # reviews page styles
│   └── pages/
│       ├── ui.tsx            # useApi hook + ErrorBox + PageHead
<!-- [bd:store] -->
│       ├── Store.tsx  Product.tsx  Wishlist.tsx  Compare.tsx  Cart.tsx
<!-- [/bd:store] -->
<!-- [bd:blog] -->
│       ├── BlogPage.tsx  BlogPostPage.tsx
<!-- [/bd:blog] -->
<!-- [bd:subscriptions] -->
│       ├── Subscriptions.tsx
<!-- [/bd:subscriptions] -->
│       ├── Reviews.tsx  Updates.tsx  MyAccount.tsx
│       └── ServiceAreas.tsx  ServiceArea.tsx
└── .env.example
```

<!-- [bd:store] -->
## The shop

The store is the same shop as the Business Dash demo: a product list with search, category, price, rating and sort filters; product pages with photos, options, add-ons, reviews, related and recently viewed products; a wishlist; side-by-side compare; and the cart. The product page, compare table and wishlist are shared components in `src/components/shop/` (the same in every React starter), styled by `src/bd-shop.css`.

- The product list keeps every filter in the URL (`?q`, `?category`, `?min`, `?max`, `?rating`, `?sort`), so a filtered list can be shared and the back button steps through filters. The router (`src/lib/router.tsx`) tracks the query string for this.
- Add to cart sends the chosen options (`{ Size: "42" }`) through `POST /api/bd/cart/add`, which mints the `bd_cart_visitor` cookie on the first add; the store bar's cart count updates in place.
- The wishlist and compare picks live in this browser (`localStorage`). `/store/compare?ids=a,b,c` can be shared.

### The shop's parts

`<ProductDetail>` is the whole product page, and the store and cart pages are laid out from the same kind of parts. Each part is its own file, so you can move, restyle or drop one, or build your own pages from them:

| Page | Parts |
| --- | --- |
| Store | the filters (`StoreSearch`, `CategoryFilter`, `PriceFilter`, `RatingFilter`, `ClearFilters`, `SortSelect`), `ProductGrid`, `ProductCard`, `StarRating`, `SaveButtons`, `CompareBar` |
| Product (`ProductDetail`) | `ProductBreadcrumbs`, `ProductGallery`, `ProductTitle`, `ProductPrice`, `VariantPicker`, `OptionPicker`, `StockNote`, `QuantityStepper`, `AddToCartButton`, `CartNotice`, `SaveButtons`, `ShareButton`, `ProductPolicies`, `ProductSpecs`, `ProductAddons`, `ProductReviews`, `ProductRail`, `CompareBar` |
| Cart | `CartLine`, `CouponForm`, `CartSummary`, `CartActions` |
| Wishlist, compare | `WishlistView`, `CompareTable` |

The product page's parts are in `src/components/shop/`; so are the store page's (`ProductCard`, `ProductGrid`, and `StoreFilters.tsx`: `StoreSearch`, `CategoryFilter`, `PriceFilter`, `RatingFilter`, `ClearFilters`, `SortSelect`) and the cart's, which take the cart calls as props.
<!-- [/bd:store] -->

<!-- [bd:blog] -->
## The blog

`/blog` lists posts newest first (pinned posts lead the first page) with category and tag filters and "Older posts" paging, all in the URL. `/blog/:slug` shows one post. The Bun server rebuilds the post's HTML from an allowlist (`safePostHtml` in `src/components/blog/blog.ts`) in `GET /api/bd/blog/post`, so only that reaches the browser. Signed-in customers can like posts and comment (`POST /api/bd/blog/like`, `POST /api/bd/blog/comment`, which read the `bd_session` cookie); signed out, those buttons lead to sign-in and back.

### The blog's parts

`<BlogIndex>` and `<BlogPost>` are the whole pages, built from parts in `src/components/blog/`, one file each:

| Page | Parts |
| --- | --- |
| Blog (`BlogIndex`) | `BlogFilters` (categories and tags), `PostCard` |
| Post (`BlogPost`) | `PostMeta`, `PostBody` (or `MembersOnly` for a members-only post signed out), `PostCta`, `PostTags`, `LikeButton`, `Comments` (`CommentForm`, `CommentList`) |
<!-- [/bd:blog] -->

## Reviews

`/reviews` shows the business's reviews from Google, Yelp and the ones added in the dashboard:

- the average and a bar per star, from the marketing bundle's `reviews` (`rating`, `counts`);
- a platform filter (`?source=google`), and "Show more reviews", which is a link (`?shown=20`);
- each review with the reviewer's photo or initial, the stars, the date, the text, any photos, the platform, Verified, and a "Read on Google/Yelp" link;
- "Write a review" for a signed-in customer, which shows once the business approves it. Signed out, it's a link to sign in.

`<ReviewsView>` is the whole page, built from `RatingSummary` (the average and a bar per star, with the writer beside it), `ReviewFilter` (the platform links) and `ReviewCard` (one review), each its own file in `src/components/reviews/`, so you can lay them out your own way.

The Bun server gathers the page in `GET /api/bd/reviews/page` (with `loadReviewsPage` from `src/components/reviews/reviews-page.ts`) and takes a written review in `POST /api/bd/reviews/write`, which checks it again and sends it with `submitReview`. The page parts are `src/components/reviews/` (the same in every React starter), styled by `src/bd-reviews.css`; `reviews.ts` holds the rules every BD starter shares.


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

The browser can't hold the key, so add two routes to `server.ts`, using its `bd` client:

```ts
const url = new URL(req.url)
if (bd && url.pathname === '/api/give') return Response.json(await bd.donations.get())
if (bd && req.method === 'POST' && url.pathname === '/give') {
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
