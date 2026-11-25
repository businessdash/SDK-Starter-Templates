# BD SDK — Angular starter

The same generic business site as the other BD starters (React-Bun, Astro, Vanilla-JS, Nuxt), built on **Angular 21 standalone components + signals** with **SSR (Express) + client hydration**, and brought to full BD SDK parity with the reference consumer.

## What's new (SDK 0.9.53)

Three additions, all mounted on the Express SSR server (`src/server/bd-api.ts`) with the SDK's web-standard `Request → Response` handlers bridged the same way as the auth handler:

- **AEO / `llms.txt`** — `GET /llms.txt` serves the org-curated llms.txt (Dashboard → Marketing → AI Distribution) from this domain's root via `llmsTxtHandler` from `@businessdash/sdk/distribution` — the only place AI crawlers look for it. The companion **product feed** needs no route: build its URL with `productFeedUrl({ siteId, baseUrl })` and submit it straight to merchant/feed programs (it's an OpenAI merchant-feed-shaped artifact, submittable as-is).
- **MCP connector proxy** — `POST /api/mcp` (JSON-RPC, with the spec's 405 on GET) and `GET /.well-known/mcp.json` (discovery manifest) via `mcpHandler` / `mcpManifestHandler` from `@businessdash/sdk/mcp`, so the URL an org hands to Claude / ChatGPT / Gemini is *this site's* `/api/mcp`. Thin by design — the platform still enforces the org's MCP opt-in and per-tool write gates. These take the BD app *origin* (`getBdHostBase()`), not the package API base.
- **Todos — relational custom-collections demo** — `bd.data-model.config.ts` declares two collections with the `collection()` + `bd` builders: `todos` (title / done / notes) and `todoImages`, whose `todo` field is a **relation** back to `todos`. `pnpm sync-data-model` pushes the model (promote it in the dashboard, then set the generated "Todo Form" Live). The lazy `/todos` route (`src/app/pages/todos.page.ts`, signals + OnPush) lists todos with their images via `GET /api/bd/todos`, where the server reads both collections through `dataModel.listRecords({ object })` and joins the relation links; `POST /api/bd/todos` creates one by submitting the generated form via `bd.forms.submit` — the SDK's documented create path for custom collections. Reads need the `metadata:read_records` scope on your key; the browser still holds **no SDK, no key**.

```sh
pnpm sync-data-model    # push the todos data model (+ generated form) to BD's draft slot
pnpm print-data-model   # print the resolved data model as JSON
```

## Architecture: the API key never reaches the browser

The BD package API key is an org-bound **server secret**. This template keeps it on the Node SSR server only. The Angular browser bundle talks exclusively to a small set of local JSON endpoints; those endpoints hold the key and call `@businessdash/sdk`.

```
browser (Angular SPA)                 Node SSR server (Express)            BD Package API
─────────────────────                 ─────────────────────────            ────────────────
fetch /api/bd/*          ───────▶   src/server/bd-api.ts      ───────▶  @businessdash/sdk
BdService (signals)                 + tag-keyed TTL cache                  (apiKey: Bearer)
bd-api.client.ts                    + createAuthHandler
                                       + revalidate webhook
                                       + sitemap/robots proxy
                                       + JSON-LD head injection
```

- `src/server/bd-server.ts` — the SDK client factory, env resolution, the **in-memory tag-keyed TTL cache**, suspension guard (`BdPaymentLapsedError` / `BdServiceSuspendedError`), and the customer-portal session resolver. Server-only.
- `src/server/bd-api.ts` — every Express endpoint the browser calls (mounted in `src/server.ts`).
- `src/server/bd-seo.ts` — server-built `localBusiness` + `website` JSON-LD, injected into the home `<head>`.
- `src/app/lib/bd-api.client.ts` — the browser's typed `fetch` client for the endpoints above. **No SDK, no key.**

Everything **no-ops gracefully** when BD env is unset: the endpoints answer with empty/placeholder shapes and the components keep their demo content.

## Setup

```sh
pnpm install --ignore-workspace   # standalone install → this template's own SDK 0.9.5
cp .env.example .env              # the Node server reads process.env
# Fill BD_API_KEY, BD_SITE_ID, BD_PACKAGE_API_BASE_URL

pnpm start                        # ng serve (dev) on http://localhost:4200
```

For production SSR:

```sh
pnpm build
node dist/Angular/server/server.mjs   # honours PORT (default 4000)
```

> **SSR host allow-list.** `angular.json → security.allowedHosts` ships empty, which makes Angular fall back to client-side rendering for unknown hosts (the JSON-LD head injection runs only on true server render). Add your dev/prod hostnames there to enable full SSR, e.g. `"allowedHosts": ["localhost", "www.your-site.com"]`.

<!-- [bd:tailwind] -->
## Tailwind CSS

Tailwind is set up for your own markup: `src/tailwind.css` is listed in `angular.json`'s `styles`, and `.postcssrc.json` runs it through `@tailwindcss/postcss`. Use its classes in any component's template. The starter's pages, shop, blog and reviews style themselves with `styles.scss` and the `bd-*.css` files, so they look the same with Tailwind or without it. Preflight, Tailwind's reset, is off for that reason; `src/tailwind.css` says how to turn it on.

<!-- [/bd:tailwind] -->
## CLI scripts (schema sync)

```sh
pnpm sync-schema    # publish bd.config.ts schema to BD's draft slot
pnpm sync-content   # (optional) push local JSON content to BD
pnpm print-schema   # print the resolved schema as JSON
```

These run the SDK CLI via `tsx` against `bd.config.ts` (the marketing schema + brand tokens + managed-data sections + the `service-area` parallel page).

## Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `BD_API_KEY` | yes | Per-site package key. **Server-side only.** |
| `BD_SITE_ID` | yes | Your site uuid. |
| `BD_PACKAGE_API_BASE_URL` | yes | BD origin (default `https://businessdash.us`). |
| `BD_REVALIDATION_SECRET` | for webhook | HMAC secret (`whsec_…`) for `/api/bd/revalidate`. |
| `BD_AUTH_CALLBACK_URL` | for auth | Public URL of `/api/bd-auth/callback` (prove its host once in Business Dash → Developer & API keys → Sign-in). |
| `BD_PUBLIC_ANALYTICS_KEY` | optional | The **only** key ever sent to the browser, for client analytics. Leave blank to keep analytics off. |

## Routes (Angular Router)

| Path | Component | What it shows |
| --- | --- | --- |
| `/` | `pages/home.page.ts` | Hero, About, Services, reviews teaser, updates, blog, contact. |
| `/store` | `pages/store.page.ts` | Products with search, category, price, rating and sort, all in the URL; each card saves to the wishlist or the comparison. | <!-- [bd-line:store] -->
| `/store/:id` | `pages/product-detail.page.ts` | One product, laid out by `<bd-product-detail>`: option photos, option and size buttons, add to cart with the chosen options, save, compare, share, add-ons, reviews, related and recently viewed. | <!-- [bd-line:store] -->
| `/store/wishlist` | `pages/wishlist.page.ts` | Products saved in this browser (`<bd-wishlist>`). | <!-- [bd-line:store] -->
| `/store/compare?ids=a,b` | `pages/compare.page.ts` | Up to four products side by side (`<bd-compare>`). | <!-- [bd-line:store] -->
| `/cart` | `pages/cart.page.ts` | Cart: qty update/remove, coupon apply/remove (reactive form), clear, Stripe checkout. | <!-- [bd-line:store] -->
| `/subscriptions` | `pages/subscriptions.page.ts` | Recurring plans list. | <!-- [bd-line:subscriptions] -->
| `/blog` | `pages/blog.page.ts` | Posts with category and tag filters and paging, all in the URL. | <!-- [bd-line:blog] -->
| `/blog/:slug` | `pages/blog-post.page.ts` | One post, its HTML made safe on the server; likes and comments for signed-in customers. | <!-- [bd-line:blog] -->
| `/my-account` | `pages/my-account.page.ts` | Signed-in user + work bundle (jobs) + review-submit form. |
| `/reviews` | `pages/reviews.page.ts` | The average and a bar per star, a platform filter (`?source=`), each review with its photos, Verified and a "Read on Google/Yelp" link, "Show more" (`?shown=`), and "Write a review" for signed-in customers (`<bd-review-writer>`). |
| `/updates` | `pages/updates.page.ts` | News/updates feed (`bundle.updates`). |
| `/booking` | `pages/booking.page.ts` | Scheduling: event types → slots → confirm booking. | <!-- [bd-line:booking] -->
| `/services` | `pages/services-index.page.ts` | Lists `service × area` parallel-page variants. |
| `/services/:service/:area` | `pages/service-area.page.ts` | Renders one programmatic SEO page (`parallelPages.render`). |

All page routes are lazy (`loadComponent`). The app shell (`src/app/app.ts` + `app.html`) is the dismissible **news banner** (`bundle.banner`) + header nav + `<router-outlet>` + footer.

## Server endpoints (browser → server)

Mounted by `mountBdApi(app)` in `src/server.ts`, all in `src/server/bd-api.ts`:

| Method + path | SDK surface |
| --- | --- |
| `GET /api/bd/home` | `marketing.getPageBundle` → hero/about/services/reviews/banner/updates |
| `GET /api/bd/blog` | `blog.listPosts` (the home section) | <!-- [bd-line:blog] -->
| `GET /api/bd/blog/posts` `…/categories` `…/tags` | `blog.listPosts` / `listCategories` / `listTags` | <!-- [bd-line:blog] -->
| `GET /api/bd/blog/post/:slug` | `blog.getPost` (HTML rebuilt by `safePostHtml`), `likeStatus`, `listComments` | <!-- [bd-line:blog] -->
| `POST /api/bd/blog/post/:slug/like` `…/comment` | `blog.withSession(token).toggleLike` / `postComment` | <!-- [bd-line:blog] -->
| `GET /api/bd/store/products` `…/:id` | `storefront.listProducts` / `getProduct` | <!-- [bd-line:store] -->
| `GET /api/bd/store/products-meta` `…/categories` | `storefront.listProductsWithMeta` / `listCategories` | <!-- [bd-line:store] -->
| `GET /api/bd/store/products/:id/reviews` `…/related` `…/addons` | `storefront.getProductReviews` / `getRelatedProducts` / `getProductAddons` | <!-- [bd-line:store] -->
| `POST /api/bd/cart/add` | `cart.forVisitor(token).addItem` with options → `{ ok, itemCount }` | <!-- [bd-line:store] -->
| `GET /api/bd/subscriptions` | `subscriptions.list` | <!-- [bd-line:subscriptions] -->
| `GET /api/bd/cart`, `POST …/items`, `PATCH/DELETE …/items/:id`, `POST/DELETE …/coupon`, `POST …/clear` | `cart.forVisitor(token).*` | <!-- [bd-line:store] -->
| `POST /api/bd/checkout/start` | `checkout.forVisitor(token).start` → Stripe URL | <!-- [bd-line:store] -->
| `POST /api/bd/contact` | `forms.submit(slug, data, opts)` |
| `GET /api/bd/reviews` | `reviews.list({ limit, offset })` |
| `GET /api/bd/reviews/page` | the reviews page's data: `bundle.reviews` (`rating`, `counts`) + `reviews.list({ limit, offset, source })` (`loadReviewsPage`, `src/app/shop/reviews-page.ts`) |
| `POST /api/bd/reviews/write` | `customerPortal(…).submitReview`, JSON only, for the signed-in customer |
| `GET /api/bd/portal/me` | `getTenantSession` + `customerPortal(org).withSession(token).getWork` |
| `POST /api/bd/portal/review` | `customerPortal(…).submitReview` |
| `GET /api/bd/scheduling/event-types` `…/:slug/slots` `POST …/:slug/book` | `scheduling.*` | <!-- [bd-line:booking] -->
| `GET /api/bd/services` `…/:service/:area` | `parallelPages.listVariants` / `render` |
| `GET /api/bd/public-config` | browser-safe config (analytics key only, never the server key) |
| `ALL /api/bd-auth/{*splat}` | `createAuthHandler` (sign-in/up/out/callback/me) |
| `POST /api/bd/revalidate` | `createGenericRevalidateHandler` (HMAC-verified) |
| `GET /sitemap.xml`, `/robots.txt` | proxied from `parallelPages.sitemapUrl()` / `robotsUrl()` |

<!-- [bd:store] -->
### Shop parts

Every store page is laid out from Angular components in
`src/app/sections/shop/`, one file each, so you can move, restyle or drop
one, or build your own pages from them:

| Page | Parts |
| --- | --- |
| Store | `<bd-store-search>`, `<bd-category-filter>`, `<bd-price-filter>`, `<bd-rating-filter>`, `<bd-clear-filters>`, `<bd-sort-select>` (one file each; each takes what's chosen and tells the page when it changes), `<bd-product-grid>`, `<bd-product-card>`, `<bd-save-buttons [product]>` |
| Product (`<bd-product-detail [data]>`) | `<bd-product-breadcrumbs>`, `<bd-product-gallery>`, `<bd-product-title>`, `<bd-product-price>`, `<bd-variant-picker>`, `<bd-option-picker>`, `<bd-stock-note>`, `<bd-quantity-stepper>`, `<bd-add-to-cart-button>`, `<bd-cart-notice>`, `<bd-save-buttons [product]>`, `<bd-share-button>`, `<bd-product-policies>`, `<bd-product-specs>`, `<bd-product-addons>`, `<bd-product-reviews>`, `<bd-product-rail>`, `<bd-recently-viewed [product]>` |
| Cart | `<li bd-cart-line>`, `<bd-coupon-form>`, `<bd-cart-summary>`, `<bd-cart-actions>` (each emits what the shopper did; the cart page calls the server) |

The parts are ordinary standalone components (`:host { display: contents }`,
so their tags add no box). What changes in the browser on the product page
comes from small framework-free custom elements in `src/app/shop/`, shared
with the other starters: `<bd-product-form>` keeps the price, options, stock,
quantity and add to cart in step with what's chosen, `<bd-gallery>` follows
the chosen option's photos, and `<bd-share>`, `<bd-addon>`,
`<bd-save-buttons>`, `<bd-recently-viewed>` and `<bd-compare-bar>` do one job
each. They find the parts by their `data-bd-*` attributes, so keep those when
you change a part's markup. The wishlist and compare table (`<bd-wishlist>`,
`<bd-compare>`) and the store bar's counts draw themselves, since those lists
live in the shopper's browser. Angular renders the elements as ordinary tags
(`schemas: [CUSTOM_ELEMENTS_SCHEMA]`), and the browser loads them after the
first render (`afterNextRender` → `import()`), so server rendering never
touches them. Their styles are `src/bd-shop.css`, pulled into `styles.scss`.
Product prices are cents; cart amounts are dollars.
<!-- [/bd:store] -->

<!-- [bd:blog] -->
### Blog parts

The blog's pages are laid out from components in `src/app/sections/blog/`:
`<bd-blog-filters>` and `<li bd-post-card>` for the list; `<bd-post-meta>`,
`<bd-post-body>` (or `<bd-members-only>`), `<bd-post-cta>`, `<bd-post-tags>`,
`<bd-like-button>` and `<bd-comments>` for a post. Likes and comments are the
shared custom elements `<bd-post-like>` and `<bd-post-comments>`
(`src/app/shop/blog-elements.ts`), loaded after the first render. Styles:
`src/bd-blog.css`.
<!-- [/bd:blog] -->

### Reviews

`/reviews` draws the business's reviews with the rules every BD starter
shares (`src/app/shop/reviews.ts`), laid out from components in
`src/app/sections/reviews/`: `<bd-rating-summary>` (the average, a bar per
star and the writer), `<bd-review-filter>` (the platform links) and
`<li bd-review-card>` (one review). Writing one is `<bd-review-writer>`
(`src/app/shop/reviews-elements.ts`), loaded the same way as the shop's and
blog's elements: it posts JSON to `/api/bd/reviews/write`, which checks the
review again and sends it with the customer's session; signed out, it's a
link to sign in. The styles are `src/bd-reviews.css`, pulled into
`styles.scss`.

### Cart visitor token

Cart mutations mint an httpOnly `bd_cart_visitor` cookie (UUID, 180-day) on first write, then bind every cart call with `cart.forVisitor(token)`.

### Revalidation webhook (real cache purge)

`POST /api/bd/revalidate` verifies the BD HMAC over the **raw** request body, then `onTagsRevalidated(tags)` drops every entry in the server's tag-keyed TTL cache whose tags intersect — so the webhook actually invalidates, it isn't decorative. Register the endpoint + `BD_REVALIDATION_SECRET` in your BD dashboard integrations.

### Auth + customer portal

`createAuthHandler` is mounted at `/api/bd-auth/*`. Sign-in / sign-up / sign-out are plain links (`<a href="/api/bd-auth/sign-in">`) that 302 through WorkOS; the handler sets an httpOnly `bd_session` cookie. `/my-account` reads it server-side and renders the user, their work bundle, and a review form.

### SEO

`localBusiness` + `website` JSON-LD is built server-side from the marketing bundle and spliced into the home `<head>` (see `src/server.ts`). `sitemap.xml` / `robots.txt` proxy the BD-generated artifacts.

### Suspension handling

Every server-side SDK read is wrapped in `runGuarded(...)`. `BdPaymentLapsedError` / `BdServiceSuspendedError` become a `503 { unavailable: true }` response, which the store/product pages render as a minimal "temporarily unavailable" state instead of crashing.

## File map

```
src/
├── server.ts                       # Express: mounts BD API, serves SSR, injects JSON-LD
├── server/
│   ├── bd-server.ts              # SDK client + TTL cache + suspension guard + session
│   ├── bd-api.ts                 # all /api/bd* + /api/bd-auth + sitemap/robots endpoints
│   └── bd-seo.ts                 # localBusiness + website JSON-LD for the home head
├── styles.scss                     # global visual language (reaches routed components)
├── bd-shop.css                     # the store's styles <!-- [bd-line:store] -->
├── bd-blog.css                     # the blog's styles <!-- [bd-line:blog] -->
└── app/
    ├── app.ts / app.html           # shell: banner + header + <router-outlet> + footer
    ├── app.routes.ts               # lazy routes for every surface
    ├── app.routes.server.ts        # RenderMode.Server (live per-request data)
    ├── app.config.ts               # router + hydration + analytics (via /public-config)
    ├── lib/
    │   ├── bd-api.client.ts      # browser → /api/bd* fetch client (no key)
    │   └── bd.service.ts         # signals facade (hero/about/services/blog/banner/updates/reviews)
    ├── pages/                       # one component per route (the table above)
    ├── shop/                        # the store's rules, and the store's, blog's and reviews' custom elements + safePostHtml
    └── sections/                    # hero, about, services, reviews-summary, updates,
        ├── …                        # blog, contact-form, news-banner, header, footer, store-nav
        ├── shop/                    # the store's parts: product page, store, cart <!-- [bd-line:store] -->
        ├── blog/                    # the blog's parts: post card, meta, body, likes, comments <!-- [bd-line:blog] -->
        └── reviews/                 # the reviews page's parts: summary, filter, card
```

## Angular conventions

Standalone components, `ChangeDetectionStrategy.OnPush`, signals + `computed()`, `input()`/`output()` where applicable, native control flow (`@if`/`@for`), `inject()`, Reactive forms (contact, coupon, review, booking). No NgModules, no `ngClass`/`ngStyle`.

## Extending

Add a surface in three steps: (1) add a server endpoint in `src/server/bd-api.ts` calling the SDK, (2) add a method to `src/app/lib/bd-api.client.ts`, (3) add a lazy route + page component. Keep all key-bearing code under `src/server/`.


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

Two endpoints inside `mountBdApi(app)` in `src/server/bd-api.ts`, using `getBd()`; the component reads `/api/give` and posts its form to `/give`:

```ts
app.get('/api/give', async (_req, res) => {
  const bd = getBd()
  if (!bd) return res.status(503).end()
  res.json(await bd.donations.get())
})
app.post('/give', express.urlencoded({ extended: false }), async (req, res) => {
  const bd = getBd()
  if (!bd) return res.status(503).end()
  const origin = `${req.protocol}://${req.get('host')}`
  const { url } = await bd.donations.startCheckout({
    amountCents: Number(req.body.amount),
    frequency: req.body.monthly ? 'monthly' : 'one_time',
    donor: { name: String(req.body.name), email: String(req.body.email) },
    successUrl: `${origin}/give/thanks`,
    cancelUrl: `${origin}/give`,
  })
  res.redirect(303, url)
})
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
