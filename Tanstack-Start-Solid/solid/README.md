# BD SDK — TanStack Solid Start starter (Solid 2)

> **This is the Solid 2 version.** It runs `solid-js` 2.0.3+ on TanStack Start's
> 2.0 release candidate. On Solid 1? Use [`../solid-1`](../solid-1/README.md),
> the same starter on Solid 1.9 and TanStack Start 1.x.

Same generic business site as the other framework starters, built on **TanStack Solid Start** (Solid.js + TanStack Router + TanStack Start SSR + Nitro). The shape is closest to the Qwik starter: route `loader` for SSR data, `createServerFn` for client-callable RPCs — no separate API endpoint files needed for those.

## Why this shape

TanStack Start's `createServerFn` compiles function bodies as RPC endpoints. The bearer key in `src/lib/bd.ts` is only reachable through `createServerFn` handlers, so the bundler drops it from the client chunk. Solid's signals (`createSignal`, `createEffect`) handle reactive client state with fine-grained updates — no virtual DOM, no rehydration cost.

```
browser → page load → loader() → getHomeData() → bd.gallery.list(...) → BD
        ↘ client event → fetchSlots(...) → bd.scheduling.getAvailableSlots(...)
                                          ↑
                                          └ SDK lives only in server-fn scope
```

The home page renders from data returned by the route's `loader`; interactive sections (Booking, ContactForm) use Solid signals + `createServerFn` calls. Beyond the home page the starter demonstrates the full SDK surface — storefront + cart + subscriptions, a blog with likes and comments, customer auth + portal, the business's reviews (rating, filter, write one), news banner + updates feed, JSON-LD + sitemap/robots, and programmatic `/services/[service]/[area]` pages. See the tables below.

## What's new (SDK 0.9.53)

Three additions, mirrored across every starter:

| Surface | Route(s) | SDK entrypoint |
| --- | --- | --- |
| **AEO / llms.txt** | `/llms.txt` (+ `/ai/product-feed` redirect) | `llmsTxtHandler` + `productFeedUrl` from `@businessdash/sdk/distribution` |
| **MCP connector proxy** | `/api/mcp` + `/.well-known/mcp.json` | `mcpHandler` + `mcpManifestHandler` from `@businessdash/sdk/mcp` |
| **Relational custom collections** | `/todos` | `collection()` + `bd` builders, `dataModel.listRecords`, generated `todo-form` |

- **AEO surfaces.** Orgs curate an answer-engine index + product feed at BD → Marketing → AI Distribution; the llms.txt convention only works at the site's own root, so `src/routes/llms[.]txt.tsx` proxies it from this domain. The product feed needs no proxy — submit its BD URL (built by `productFeedUrl`) to merchant programs directly; `/ai/product-feed` is a convenience redirect to it.
- **MCP connector.** `src/routes/api/mcp.tsx` + `src/routes/[.]well-known.mcp[.]json.tsx` give this self-hosted domain the same per-site MCP connector the platform serves natively — the URL an org hands to Claude / ChatGPT / Gemini is their own site. The proxy is thin: BD still enforces the org's MCP opt-in and per-tool write gates.
- **Todos demo.** `bd.data-model.config.ts` declares two related collections (`todos`, and `todoImages` with a required RELATION to `todos`) with the 0.9.50+ `collection()` + `bd` builders. Push with `pnpm sync-data-model`, promote in the dashboard, set the generated "Todo Form" live, then open `/todos` — TanStack Start server functions in `src/lib/bd-server-fns.ts` (`getTodosData`, `submitTodoForm`) do the reads via `dataModel.listRecords` and create todos by submitting the generated `todo-form`. Reads go through the data-model client, writes go through forms; there is no direct row-write API for consumers.

## Setup

```sh
npm install     # or bun / pnpm
cp .env.example .env.local
# Fill BD_API_KEY, BD_SITE_ID, BD_PACKAGE_API_BASE_URL

npm run dev     # vite dev --port 3000
```

Open http://localhost:3000.

For production:

```sh
npm run build
npm run start   # node .output/server/index.mjs
```

## What's in each section

Every surface below is server-driven by a `createServerFn` in `src/lib/bd-server-fns.ts` (the only place the secret key is reachable) and degrades gracefully when BD env is unset.

### Home page (`src/routes/index.tsx`)

| Section | Where it lives | SDK call |
| --- | --- | --- |
| **Hero / About / Services** | `getHomeData` server fn reads marketing bundle, passes props to components | `bd.marketing.getPageBundle(...)` |
| **Gallery** | `getHomeData` with const-generic field selection | `bd.gallery.list({ limit: 12, fields: [...] as const })` |
| **Blog** | `getHomeData` | `bd.blog.listPosts({ limit: 6 })` | <!-- [bd-line:blog] -->
| **Booking** | Event-type list server-rendered; slots + confirm via `fetchSlots` + `confirmBooking` | `bd.scheduling.listEventTypes()`, `getAvailableSlots(...)`, `confirmBooking(...)` | <!-- [bd-line:booking] -->
| **Contact form** | Form schema server-rendered; submit via `submitContactForm` | `bd.forms.schema(slug)`, `bd.forms.submit(...)` |
| **News banner** | `getSiteContentExtras` → `NewsBanner` (dismissible bar) | `bundle.banner` (untyped passthrough) |
| **JSON-LD** | `getHomeJsonLd` injected via the route `head` `scripts` | `localBusiness()` + `website()` from `@businessdash/sdk/seo` |

### Commerce

| Surface | File | SDK call |
| --- | --- | --- |
| **Product list** (search, category, price, rating, sort; save and compare on each card) | `src/routes/store.index.tsx` | `storefront.listProductsWithMeta(...)`, `storefront.listCategories()` | <!-- [bd-line:store] -->
| **Product page** (option photos, options, add to cart, add-ons, reviews, related) | `src/routes/store.$id.tsx` → `<bd-product>` | `storefront.getProduct(id)`, reviews, add-ons, related (`getProductPage` in `src/lib/bd-shop-fns.ts`) | <!-- [bd-line:store] -->
| **Add to cart** for `<bd-product>` | `src/routes/api/bd/cart/add.tsx` (`POST`, JSON) | `cart.forVisitor(token).addItem(...)` | <!-- [bd-line:store] -->
| **Wishlist** · **Compare** | `src/routes/store.wishlist.tsx` · `src/routes/store.compare.tsx` | `storefront.getProduct(id)` per compared product | <!-- [bd-line:store] -->
| **Cart** (update / remove / coupon / clear / checkout) | `src/routes/store.cart.tsx` | `cart.forVisitor(t)` get/update/remove/coupon/clear + `checkout.forVisitor(t).start(...)` | <!-- [bd-line:store] -->
| **Order confirmation** | `src/routes/store.order.tsx` | `checkout.getStatus(sessionId)` | <!-- [bd-line:store] -->
| **Subscriptions** | `src/routes/subscriptions.tsx` | `subscriptions.list()`, `subscriptions.startCheckout(id, ...)` | <!-- [bd-line:subscriptions] -->

<!-- [bd:store] -->
The cart is keyed on a visitor UUID we own, stored in an httpOnly cookie `bd_cart_visitor`. It's read on cart loads and minted on the first write — all inside the server fns via TanStack Start's `getCookie` / `setCookie` (`@tanstack/solid-start/server`). The add-to-cart endpoint reaches the same token through `cartVisitorToken`, a `createServerOnlyFn`, which keeps the cookie code out of the browser bundle. Checkout and subscription "subscribe" return a Stripe-hosted URL; the client redirects to it. Cart amounts are dollars; product prices are cents (`formatMoney`).

The store's filters live in the URL (`?q`, `?category`, `?min`, `?max`, `?rating`, `?sort`): `validateSearch` reads them and `loaderDeps` re-runs the route loader on the server for each change, so a filtered list can be shared.

#### Shop elements

The product page, wishlist, compare table, save buttons and the store bar's
counts are custom elements in `src/lib/shop/` (`shop-elements.ts`), the same
ones every BD starter ships. A loader reads the data on the server and the
page writes it into the element as JSON (`elementHtml` in
`src/lib/bd-elements.ts`, set as a wrapper's `innerHTML`); `<StoreNav />`
loads the elements in the browser. The wishlist and the compare picks are
saved in the browser. Styles: `src/bd-shop.css`.
<!-- [/bd:store] -->

<!-- [bd:blog] -->
### Blog

| Surface | File | SDK call |
| --- | --- | --- |
| **Post list** (pinned first, category and tag filters, older posts) | `src/routes/blog.index.tsx` | `blog.listPosts(...)`, `blog.listCategories()`, `blog.listTags()` |
| **Post** (body, cover, call to action, tags) | `src/routes/blog.$slug.tsx` | `blog.getPost(slug)`, `blog.likeStatus(slug)`, `blog.listComments(slug)` |
| **Like** · **Comment** (signed-in customers) | `src/routes/api/bd/blog/post.$slug.like.tsx` · `post.$slug.comment.tsx` | `blog.withSession(token).toggleLike(slug)` · `.postComment(slug, …)` |

The server functions are in `src/lib/bd-blog-fns.ts`. The post's HTML is
rebuilt from an allowlist (`safePostHtml` in `src/lib/shop/blog.ts`), so the
raw HTML never reaches the page. The like button and comments are
`<bd-post-like>` and `<bd-post-comments>` (`src/lib/shop/blog-elements.ts`);
signed out, they lead to sign-in and back to the post. Styles:
`src/bd-blog.css`.
<!-- [/bd:blog] -->

### Auth + customer portal

| Surface | File | SDK call |
| --- | --- | --- |
| **Auth handler** | `src/routes/api/bd-auth.$.tsx` (catch-all) | `createAuthHandler(...)` → `/api/bd-auth/{sign-in,sign-up,callback,sign-out,me}` |
| **My account** | `src/routes/my-account.tsx` | `getTenantSession(...)` on `bd_session`, `customerPortal(org).withSession(t).getWork()`, `.submitReview(...)` |

Sign-in / sign-up / sign-out are plain links to the catch-all handler (no client SDK needed). The handler sets a `bd_session` httpOnly cookie; `my-account`'s loader validates it server-side, shows the user + a work-summary (jobs / quotes / invoices), and offers a moderated review-submission form.

### Reviews, updates, SEO, programmatic pages

| Surface | File | SDK call |
| --- | --- | --- |
| **Reviews**: the average and a bar per star, a platform filter (`?source=`), each review with its photos, Verified and a "Read on Google/Yelp" link, "Show more" (`?shown=`), and "Write a review" for signed-in customers | `src/routes/reviews.tsx` (data from `getReviewsPage` → `loadReviewsPage`, `src/lib/shop/reviews-page.ts`); `<bd-review-writer>` (`src/lib/shop/reviews-elements.ts`) posts to `src/routes/api/bd/reviews/write.tsx` | `bundle.reviews` (`rating`, `counts`), `reviews.list({ limit, offset, source })`, `customerPortal(org).withSession(t).submitReview(...)` |
| **Updates feed** | `src/routes/updates.tsx` | `bundle.updates` (untyped passthrough) |
| **Sitemap** | `src/routes/sitemap[.]xml.tsx` | proxies `parallelPages.sitemapUrl()` |
| **Robots** | `src/routes/robots[.]txt.tsx` | proxies `parallelPages.robotsUrl()` |
| **Service areas (index)** | `src/routes/services.index.tsx` | `parallelPages.listVariants("service-area")` |
| **Service × area page** | `src/routes/services.$service.$area.tsx` | `parallelPages.render("service-area", { service, area })`, meta lifted into the route `head` |

Bundle review items (`{ reviewee, description, date }`) and `reviews.list` wall items (`{ reviewerName, text, timeCreated }`) have different shapes — each is mapped at its own call site.

### Suspension handling

Bundle / store / parallel-page reads catch `BdPaymentLapsedError` / `BdServiceSuspendedError` (both extend `BdAccessRejectedError`) and render a minimal "temporarily unavailable" state instead of crashing.

## Adding a new SDK surface

1. **Static data** — add a field to `HomeData` and the `getHomeData` handler in `src/lib/bd-server-fns.ts`. Pass it through the route loader to a component as a prop.
2. **Interactive RPC** — add another `createServerFn({ method: ... }).validator(...).handler(...)` in `bd-server-fns.ts`. Import and `await` it from any Solid component.

No API route file needed for the RPC case — TanStack Start generates the transport.

## Webhook revalidation (built in)

`src/routes/api/bd/revalidate.tsx` mounts the SDK's framework-agnostic handler via `createServerFileRoute` + `POST`. Register the URL in BD at `/dashboard/settings/integrations`, paste the `whsec_…` into `BD_REVALIDATION_SECRET`, and BD will POST a signed `content.published` event on every publish. The callback in `revalidate.tsx` is where you wire response-level cache purging once you add it.

## Configuration + env

| Var | Purpose |
| --- | --- |
| `BD_API_KEY` | Server-only bearer key (Site Settings → API Keys). |
| `BD_SITE_ID` | The site UUID this app represents. |
| `BD_PACKAGE_API_BASE_URL` | Where BD is hosted (e.g. `https://businessdash.us`). |
| `BD_REVALIDATION_SECRET` | HMAC secret for the revalidate webhook. |
| `BD_AUTH_CALLBACK_URL` | Public URL of `/api/bd-auth/callback` — required for auth + portal. |

All are **server-only** — never prefix with `VITE_` or they leak to the browser bundle. `bd.config.ts` (root) is the dashboard-editable content schema; `npm run sync-schema` / `sync-content` / `print-schema` publish + inspect it.

## Project layout (BD-relevant only)

```
bd.config.ts                                 # marketing schema + defineParallelPage("service-area")
src/
├── lib/
│   ├── bd.ts                                # SDK client + bundle/banner/updates/reviews helpers (server-only)
│   ├── bd-server-fns.ts                     # all createServerFn RPCs + sitemap/robots/SEO builders
<!-- [bd:store] -->
│   ├── bd-shop-fns.ts                       # product page, compare, cart count, order status
<!-- [/bd:store] -->
<!-- [bd:blog] -->
│   ├── bd-blog-fns.ts                       # post list and post, with likes and comments
<!-- [/bd:blog] -->
│   ├── bd-elements.ts                       # writes a custom element with its data
<!-- [bd:store] -->
│   ├── shop/shop.ts · shop-elements.ts      # product page, wishlist, compare, save buttons
<!-- [/bd:store] -->
<!-- [bd:blog] -->
│   ├── shop/blog.ts · blog-elements.ts      # safePostHtml, like button, comments
<!-- [/bd:blog] -->
│   ├── shop/reviews.ts · reviews-page.ts · reviews-elements.ts  # review rules, page data, writer
│   └── shop/bd-dom.ts                       # the elements' small DOM helpers
├── components/bd/
│   ├── Header.tsx · Footer.tsx · Hero.tsx · About.tsx · Services.tsx
│   ├── Gallery.tsx
│   ├── Blog.tsx                                # latest posts on the home page <!-- [bd-line:blog] -->
│   ├── Booking.tsx                             # createSignal + createEffect <!-- [bd-line:booking] -->
│   ├── ContactForm.tsx                         # createSignal + createEffect
<!-- [bd:store,subscriptions] -->
│   ├── StoreNav.tsx                            # store bar: products, plans, wishlist, compare, cart
<!-- [/bd:store,subscriptions] -->
<!-- [bd:store] -->
│   ├── ShopStars.tsx                           # star rating in the shop's markup
<!-- [/bd:store] -->
│   ├── NewsBanner.tsx                          # dismissible bundle.banner bar
│   └── money.ts                                # price/interval formatters
├── routes/
│   ├── index.tsx                              # home: loader composes sections + injects JSON-LD
<!-- [bd:store] -->
│   ├── store.index.tsx                        # product list
│   ├── store.$id.tsx                          # product page (<bd-product>)
│   ├── store.wishlist.tsx · store.compare.tsx # saved products, products side by side
│   ├── store.cart.tsx                         # cart mutations + checkout
│   ├── store.order.tsx                        # Stripe checkout return
<!-- [/bd:store] -->
<!-- [bd:subscriptions] -->
│   ├── subscriptions.tsx
<!-- [/bd:subscriptions] -->
<!-- [bd:blog] -->
│   ├── blog.index.tsx · blog.$slug.tsx        # post list + filters; post, likes, comments
<!-- [/bd:blog] -->
│   ├── reviews.tsx                             # reviews: rating + bars, filter, show more, write one
│   ├── updates.tsx
│   ├── my-account.tsx                          # session + work bundle + review form
│   ├── services.index.tsx · services.$service.$area.tsx   # programmatic SEO
│   ├── sitemap[.]xml.tsx · robots[.]txt.tsx    # SEO proxies
│   └── api/
│       ├── bd/revalidate.tsx                # webhook receiver
│       ├── bd/cart/add.tsx                  # add to cart for <bd-product> <!-- [bd-line:store] -->
│       ├── bd/reviews/write.tsx             # write a review (signed in)
<!-- [bd:blog] -->
│       ├── bd/blog/post.$slug.like.tsx      # like (signed in)
│       ├── bd/blog/post.$slug.comment.tsx   # comment (signed in)
<!-- [/bd:blog] -->
│       └── bd-auth.$.tsx                     # auth catch-all (createAuthHandler)
├── styles.css                                 # Existing tokens + appended BD tokens
├── bd-shop.css                                # shop styles <!-- [bd-line:store] -->
├── bd-blog.css                                # blog styles <!-- [bd-line:blog] -->
└── bd-reviews.css                             # reviews page styles
```

## Solid 2 idioms used

- `createSignal()` returns `[get, set]` as before. Given a **function**, it's a
  writable derived signal: `Booking` seeds the selected event type with
  `createSignal(() => props.eventTypes[0]?.slug ?? "")`, which follows the prop
  until the visitor picks one.
- `createEffect(compute, apply)` takes two functions: what to watch, then what
  to do. `Booking` re-loads slots with it, and `apply` returns a cleanup that
  drops a stale response when the visitor switches event type mid-load.
- `onSettled()` replaces `onMount()` and returns its cleanup instead of calling
  `onCleanup` (the analytics tracker in `__root.tsx`, the setup banner, the
  subscribe form's local hint).
- `<Loading>` replaces `<Suspense>` in the root shell.
- `class={["base", { modifier: on() }]}` replaces `classList`. The store
  pages build their classes as template strings instead, which read the same
  on Solid 1 and 2.
- ARIA state attributes take strings: `aria-pressed={on() ? "true" : "false"}`
  (the store facets). Solid 2's JSX types reject a boolean there.
- DOM APIs come from `@solidjs/web` instead of `solid-js/web` (here, just
  `HydrationScript` in `__root.tsx`), and `tsconfig.json` sets
  `"jsxImportSource": "@solidjs/web"`.
- `<For>` / `<Show>`, reading `props.x` instead of destructuring, and
  `onInput` / `onClick` handlers are unchanged from 1.x.

### What changed from the Solid 1.9 version

| | `solid-1/` | `solid/` |
| --- | --- | --- |
| `solid-js` | 1.9 | 2.0.3+, plus `@solidjs/web` |
| TanStack Router / Start | 1.x | `2.0.0-rc.10` (pinned, see below) |
| Vite plugin | `vite-plugin-solid` | `@solidjs/vite-plugin`, after `tanstackStart()` |
| TanStack Query | 5 (`createQuery`) | 6 release candidate (`useQuery`) |
| Form and Store demos | included | removed: `@tanstack/solid-form` and `@tanstack/solid-store` have no Solid 2 build yet |

**Why rc.10 and not the newest release candidate:** `@tanstack/solid-start@2.0.0-rc.11`
(19 Nov 2026) imports `@tanstack/start-server-core/request-scope`, an export no
published `start-server-core` has, so its server build fails. Move to a later
release candidate once one builds.

**SDK version:** `<BdForm>` (the contact form and `/todos`) needs
`@businessdash/sdk` 0.9.91 or later on Solid 2, which this starter pins. On
0.9.90, Solid 2 throws when the form reads its client context, and the page
shows TanStack's error screen.

The BD layer doesn't care which framework lives on top — Solid components just receive plain data from the loader and call typed server functions.


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

Server functions in `src/routes/give.tsx`:

```ts
const bd = () =>
  createBdApiClient({ apiKey: process.env.BD_API_KEY!, baseUrl: process.env.VITE_BD_PACKAGE_API_BASE_URL! })
const origin = () =>
  `${getRequestHeader('x-forwarded-proto') ?? 'https'}://${getRequestHeader('host')}`

const getPage = createServerFn().handler(() => bd().donations.get())

const give = createServerFn({ method: 'POST' })
  .validator((form: FormData) => form)
  .handler(async ({ data }) => {
    const { url } = await bd().donations.startCheckout({
      amountCents: Number(data.get('amount')),
      frequency: data.get('monthly') ? 'monthly' : 'one_time',
      donor: { name: String(data.get('name')), email: String(data.get('email')) },
      successUrl: `${origin()}/give/thanks`,
      cancelUrl: `${origin()}/give`,
    })
    throw redirect({ href: url })
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
