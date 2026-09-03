# BD SDK — Qwik City starter

Same generic business site as the other framework starters, built on **Qwik City**. Qwik's contribution is *resumability* — the server renders the page, and the client picks up exactly where the server left off without rehydrating. For the SDK pattern, Qwik gives us the cleanest split between server and client without any explicit boundary code.

## Why Qwik's shape is interesting

Qwik has two built-in primitives that map directly onto the consumer-DX principle:

- **`routeLoader$`** — runs on the server during render. We use it in `src/routes/index.tsx` to fan five SDK calls (`marketing.getPageBundle`, `gallery.list`, `scheduling.listEventTypes`, `blog.listPosts`, `forms.schema`) into a single `Promise.all`. The page renders with the data already resolved.
- **`server$`** — defines a function whose body only ever runs on the server, callable from any client component. We use it inside `Booking.tsx` and `ContactForm.tsx` for slot-fetching, booking confirmation, and form submission. Qwik compiles the call sites into transparent fetches — no API endpoint files needed.

The `$` suffix on both is Qwik's marker that everything *inside* is server-only and serializable. The bearer key in `src/lib/bd.ts` is only imported from `$`-wrapped functions, so Qwik's optimizer drops it from the browser bundle.

```
browser → page load → routeLoader$()        → bd.gallery.list(...) → BD
        ↘ client click → server$()          → bd.scheduling.confirm(...) → BD
                                            ↑
                                            └ @businessdash/sdk lives only in server$ scope
```

## What's new (SDK 0.9.53)

Three additions, mirrored across every starter — all `RequestHandler`s or `routeLoader$`/`server$` bodies, so the split above doesn't change:

- **AEO / llms.txt** — `src/routes/llms.txt/index.ts` serves the answer-engine index the org curates at BD → Marketing → AI Distribution from this site's own root (`llmsTxtHandler` from `@businessdash/sdk/distribution`). The product feed needs no proxy — submit its BD URL (built by `productFeedUrl`) to merchant programs directly; `src/routes/ai/product-feed/index.ts` is a convenience redirect to it.
- **MCP connector proxy** — `src/routes/api/mcp/index.ts` (JSON-RPC) + `src/routes/.well-known/mcp.json/index.ts` (discovery manifest) give this self-hosted domain the same per-site MCP connector the platform serves natively, via `mcpHandler` + `mcpManifestHandler` from `@businessdash/sdk/mcp`. The URL an org hands to Claude / ChatGPT / Gemini is their own site; BD still enforces the org's MCP opt-in and per-tool write gates.
- **Relational custom collections (`/todos`)** — `bd.data-model.config.ts` declares two related collections (`todos`, and `todoImages` with a required RELATION to `todos`) with the 0.9.50+ `collection()` + `bd` builders. Push with `pnpm sync-data-model`, promote in the dashboard, set the generated "Todo Form" live, then open `/todos` — `routeLoader$` lists todos (images joined on, in `src/lib/bd-todos.ts`) via `dataModel.listRecords`, and creates go through the generated `todo-form` rendered by `<BdForm>` with a `server$` submit. Reads go through the data-model client, writes go through forms; there is no direct row-write API for consumers.

## Setup

```sh
bun install     # or npm / pnpm
cp .env.example .env.local
# Fill BD_API_KEY, BD_SITE_ID, BD_PACKAGE_API_BASE_URL

bun run dev
```

Open the URL Vite prints. The home page composes every section; on first paint the data is already there (no spinners) because `routeLoader$` resolved on the server.

For production:

```sh
bun run qwik add <adapter>    # node-server | vercel-edge | cloudflare-pages | …
bun run build
```

## What's in each section

| Section | Where it lives | SDK call |
| --- | --- | --- |
| **Hero / About / Services** | `routeLoader$` reads marketing bundle, passes to component props | `bd.marketing.getPageBundle(...)` |
| **Gallery** | `routeLoader$` with const-generic field selection | `bd.gallery.list({ limit: 12, fields: [...] as const })` |
| **Blog** | `routeLoader$` → `<Blog />` | `bd.blog.listPosts({ limit: 6 })` |
| **Booking** | Event-type list from `routeLoader$`; slot fetch + confirm via `server$` RPCs declared inside `Booking.tsx` | `bd.scheduling.listEventTypes()`, `getAvailableSlots(...)`, `confirmBooking(...)` |
| **Contact form** | Form schema from `routeLoader$`; submit via `server$` inside `ContactForm.tsx` | `bd.forms.schema(slug)`, `bd.forms.submit(...)` |

## Adding a new SDK surface

Two patterns, both clean:

1. **Static data (loaded once per page render)** — add fields to the `useBdData` `routeLoader$` return in `src/routes/index.tsx`, and pass them as props to a new component.
2. **Interactive RPC (client event triggers a fresh server call)** — declare `const myCall = server$(async function (args) { … })` at the top of the component file, then call `await myCall(args)` from inside any `$()`-wrapped handler.

No API endpoint files needed for the second case — Qwik generates the transport.

## Full SDK surface (parity with the reference consumer)

Beyond the home page, this starter demonstrates every BD SDK surface the
canonical consumer (DGP-2026) uses — each in a Qwik idiom. The SDK key stays
server-side: everything below runs inside `routeLoader$`, `server$`,
`routeAction$`, or a request handler, all of which Qwik strips from the client
bundle.

### Server-only helper libraries

| File | What it wraps |
| --- | --- |
| `src/lib/bd.ts` | The `createBdClient` factory (returns `null` when unconfigured). |
| `src/lib/bd-store.ts` | Storefront / cart / checkout / subscriptions. Owns the `bd_cart_visitor` httpOnly cookie (read with `getVisitorToken`, mint with `ensureVisitorToken`). |
| `src/lib/bd-portal.ts` | `getTenantSession` on the `bd_session` cookie + `customerPortal(org).withSession(token)` (work bundle, review submit). |
| `src/lib/bd-content.ts` | `bundle.banner` / `bundle.updates` extraction, reviews-wall pagination (`reviews.list`), and `localBusiness` + `website` JSON-LD via `@businessdash/sdk/seo`. |

### Storefront + commerce

| Surface | File | SDK call |
| --- | --- | --- |
| **Product list** | `src/routes/store/index.tsx` | `storefront.listProducts()` |
| **Product detail + add to cart** | `src/routes/store/[id]/index.tsx` | `storefront.getProduct(id)`, `cart.forVisitor(token).addItem(...)` via `server$` |
| **Cart** (update / remove / coupon / clear / checkout) | `src/routes/cart/index.tsx` | `cart.forVisitor(token).*`, `checkout.forVisitor(token).start(...)` via `server$` |
| **Order confirmation** | `src/routes/store/order/index.tsx` | `checkout.getStatus(sessionId)` |
| **Subscriptions** | `src/routes/subscriptions/index.tsx` | `subscriptions.list()`, `subscriptions.startCheckout(id, ...)` |

The cart is keyed on a visitor token we own — an httpOnly `bd_cart_visitor`
cookie minted on the first mutation through Qwik's RequestEvent `cookie` API. No
separate API endpoint files: cart/checkout mutations are `server$` RPCs that
read/write the cookie via `this.cookie` and return a fresh `CartSnapshot`.

### Auth + customer portal

| Surface | File | SDK call |
| --- | --- | --- |
| **Auth handler** (catch-all) | `src/routes/api/bd-auth/[...slug]/index.ts` | `createAuthHandler({...})` — bridged through `onGet`/`onPost`, mirroring the revalidate endpoint |
| **My account** (session + work bundle + review form) | `src/routes/my-account/index.tsx` | `getTenantSession({ cookieValue })`, `customerPortal(org).withSession(token).getWork()` / `.submitReview(...)` |

Auth uses plain links — `/api/bd-auth/sign-in`, `/api/bd-auth/sign-up`,
`/api/bd-auth/sign-out` — no React `SignIn`/`useUser` needed. The header's
sign-in vs. account state is resolved server-side per route from the validated
`bd_session` cookie. Review submission is a `routeAction$` validated with
`zod$`.

### Reviews, banner, updates

| Surface | File | SDK call |
| --- | --- | --- |
| **Reviews wall** (aggregate + load-more) | `src/routes/reviews/index.tsx` | `reviews.list({ limit, offset })` paginated via `server$` |
| **News banner** (dismissible) | `src/components/bd/Banner.tsx` (fed by the home loader) | `bundle.banner` |
| **Updates feed** | `src/routes/updates/index.tsx` | `bundle.updates` |

### SEO

| Surface | File | SDK call |
| --- | --- | --- |
| **JSON-LD** (`localBusiness` + `website`) | built in `src/lib/bd-content.ts`, injected via the home page `head.scripts` | `@businessdash/sdk/seo` |
| **sitemap.xml** (proxy) | `src/routes/sitemap.xml/index.ts` | `parallelPages.sitemapUrl()` |
| **robots.txt** (proxy) | `src/routes/robots.txt/index.ts` | `parallelPages.robotsUrl()` |

### Parallel pages (programmatic SEO)

| Surface | File | SDK call |
| --- | --- | --- |
| **Variant index** | `src/routes/services/index.tsx` | `parallelPages.listVariants("service-area")` |
| **Per-variant render** | `src/routes/services/[service]/[area]/index.tsx` | `parallelPages.render("service-area", { service, area })` |

Token resolution (`{service.type}`, `{area.name}`, …) happens server-side inside
BD, so crawlers see fully-resolved HTML. `meta.title` / `meta.description` /
`meta.canonical` feed the page `head`.

### Suspension handling + graceful degradation

Store, subscriptions, and parallel-page loaders catch
`BdPaymentLapsedError` / `BdServiceSuspendedError` and render a minimal
"temporarily unavailable" state (the parallel-page route also sets HTTP 503).
Every new surface no-ops gracefully when the BD env vars are unset — the page
renders an "isn't connected yet" hint instead of crashing.

## CLI scripts

```sh
bun run sync-schema    # publish bd.config.ts schema to BD's draft slot
bun run sync-content   # (optional) push local JSON content up
bun run print-schema   # print the resolved schema for debugging
```

## Webhook revalidation (built in)

`src/routes/api/bd/revalidate/index.ts` mounts the SDK's framework-agnostic handler via `onPost`. Register the URL in BD at `/dashboard/settings/integrations`, paste the `whsec_…` into `BD_REVALIDATION_SECRET`, and BD will POST a signed `content.published` event on every publish.

Qwik re-runs `routeLoader$` per request so the callback is a logger today — when you add response-level caching (Vercel `Cache-Tag` purge, Cloudflare KV, etc.), the `onTagsRevalidated` callback in `revalidate/index.ts` is where to wire it.

## Project layout (BD-relevant only)

```
bd.config.ts                                 # marketing schema + parallel-page def
src/
├── lib/
│   ├── bd.ts                                # SDK client (server-only)
│   ├── bd-store.ts                          # storefront / cart / checkout / subs + visitor cookie
│   ├── bd-portal.ts                         # session + customer portal
│   └── bd-content.ts                        # banner / updates / reviews / JSON-LD
├── global.css                                 # BD CSS vars + section styles
├── components/bd/
│   ├── Header.tsx                             # home anchor nav
│   ├── SiteHeader.tsx                         # cross-page nav (store/cart/auth)
│   ├── Banner.tsx                             # dismissible bundle.banner bar
│   ├── Footer.tsx
│   ├── Hero.tsx · About.tsx · Services.tsx · Gallery.tsx · Blog.tsx
│   ├── Booking.tsx                            # useSignal + server$ RPCs
│   └── ContactForm.tsx                        # useSignal + server$ RPC
└── routes/
    ├── index.tsx                              # routeLoader$ + banner + JSON-LD
    ├── store/index.tsx                        # product list
    ├── store/[id]/index.tsx                   # product detail + add to cart
    ├── store/order/index.tsx                  # Stripe checkout return
    ├── cart/index.tsx                         # cart mutations + checkout
    ├── subscriptions/index.tsx               # subscription plans
    ├── reviews/index.tsx                      # reviews wall + load more
    ├── updates/index.tsx                      # bundle.updates feed
    ├── my-account/index.tsx                   # portal: work bundle + review form
    ├── services/index.tsx                     # parallel-page variant index
    ├── services/[service]/[area]/index.tsx    # parallel-page render
    ├── sitemap.xml/index.ts                   # SEO proxy
    ├── robots.txt/index.ts                    # SEO proxy
    ├── api/bd-auth/[...slug]/index.ts       # auth handler (onGet/onPost)
    └── api/bd/revalidate/index.ts           # Webhook receiver
```

## Adapters

Out of the box this starter has no production adapter. Pick one:

```sh
npm run qwik add node-server
npm run qwik add vercel-edge
npm run qwik add cloudflare-pages
npm run qwik add netlify-edge
```

The BD layer doesn't change — only the runtime where `routeLoader$` and `server$` execute.


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
