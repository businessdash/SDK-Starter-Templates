# BIAB SDK — T3 App starter

Same generic business site as the other framework starters, built on the **T3 Stack** (Next.js App Router + tRPC + Drizzle + Tailwind). The unique shape here is **tRPC for the SDK surface** — instead of REST endpoints or server functions, every BIAB call is a typed tRPC procedure with end-to-end type inference into the React components.

## What's new (SDK 0.9.53)

Three additions, mirrored across every starter:

| Surface | Route(s) | SDK entrypoint |
| --- | --- | --- |
| **AEO / llms.txt** | `/llms.txt` (+ `/ai/product-feed` redirect) | `llmsTxtHandler` + `productFeedUrl` from `@businessdash/sdk/distribution` |
| **MCP connector proxy** | `/api/mcp` + `/.well-known/mcp.json` | `mcpHandler` + `mcpManifestHandler` from `@businessdash/sdk/mcp` |
| **Relational custom collections** | `/todos` | `collection()` + `bd` builders, `dataModel.listRecords`, generated `todo-form` |

- **AEO surfaces.** Orgs curate an answer-engine index + product feed at BIAB → Marketing → AI Distribution; the llms.txt convention only works at the site's own root, so `src/app/llms.txt/route.ts` proxies it from this domain. The product feed needs no proxy — submit its BIAB URL (built by `productFeedUrl`) to merchant programs directly; `/ai/product-feed` is a convenience redirect to it.
- **MCP connector.** `src/app/api/mcp/route.ts` + `src/app/.well-known/mcp.json/route.ts` give this self-hosted domain the same per-site MCP connector the platform serves natively — the URL an org hands to Claude / ChatGPT / Gemini is their own site. The proxy is thin: BIAB still enforces the org's MCP opt-in and per-tool write gates.
- **Todos demo.** `biab.data-model.config.ts` declares two related collections (`todos`, and `todoImages` with a required RELATION to `todos`) with the 0.9.50+ `collection()` + `bd` builders. Push with `pnpm sync-data-model`, promote in the dashboard, set the generated "Todo Form" live, then open `/todos` — it lists todos (images joined on) via `dataModel.listRecords` and creates todos by submitting the generated `todo-form`. Reads go through the data-model client, writes go through forms; there is no direct row-write API for consumers.

## Why T3's shape is interesting

T3's whole identity is end-to-end type safety. For the BIAB integration that means:

- **One `biabRouter`** declares every SDK call as a tRPC procedure. Inputs validated with Zod, returns inferred. The TypeScript that flows from the SDK in `src/server/lib/biab.ts` through the tRPC router to the React components is unbroken — no type-script-shaped fetch wrappers, no manual response types.
- **Server Components call procedures directly** via `api.biab.home()`. No HTTP round-trip — the procedure runs in the same Node process as the page render.
- **Client Components use the tRPC react hooks** (`useQuery`, `useMutation`) — fully typed inputs, fully typed responses, optimistic updates and refetches handled by the existing TanStack Query layer the T3 template already wires up.
- **`src/server/lib/biab.ts`** uses `import "server-only";` so Next throws a build error if any client component imports it. The bearer key is impossible to leak.

```
browser → Server Component → api.biab.home() → biabRouter.home → biab.gallery.list(...) → BIAB
        ↘ Client Component → api.biab.confirmBooking.useMutation → biab.scheduling.confirmBooking(...)
                                                                  ↑
                                                                  └ SDK only in src/server/
```

## Setup

```sh
pnpm install     # or npm / bun
cp .env.example .env
# Fill DATABASE_URL + BIAB_API_KEY + BIAB_SITE_ID + BIAB_PACKAGE_API_BASE_URL

pnpm dev
```

Open http://localhost:3000.

For production:

```sh
pnpm build
pnpm start
```

## What's in each section

### Home page (`src/app/page.tsx`)

| Section | Where it lives | SDK call |
| --- | --- | --- |
| **Hero / About / Services** | `api.biab.home()` (server) reads marketing bundle, passes to React components | `biab.marketing.getPageBundle(...)` |
| **Gallery** | Same `api.biab.home()` with const-generic field selection | `biab.gallery.list({ limit: 12, fields: [...] as const })` |
| **Blog** | Same `api.biab.home()` | `biab.blog.listPosts({ limit: 6 })` |
| **Booking** | Event-type list from `home()`; slots via `api.biab.fetchSlots.useQuery`, confirm via `api.biab.confirmBooking.useMutation` | `biab.scheduling.listEventTypes()`, `getAvailableSlots(...)`, `confirmBooking(...)` |
| **Contact form** | Form schema from `home()`; submit via `api.biab.submitForm.useMutation` | `biab.forms.schema(slug)`, `biab.forms.submit(...)` |
| **Reviews wall** | `Reviews.tsx` (aggregate + first page from the bundle) + `ReviewsLoadMore.tsx` paginating via `api.biab.reviewsPage` | `bundle.reviews`, `biab.reviews.list({ offset })` |
| **News banner** | `NewsBanner.tsx` (dismissible bar, `sessionStorage`) fed by `bundle.banner` | `bundle.banner` (passthrough) |
| **Updates feed** | `Updates.tsx` fed by `bundle.updates` (Google Business posts) | `bundle.updates` (passthrough) |
| **JSON-LD (SEO)** | `homeJsonLd()` in `src/server/lib/biab-seo.ts`, injected server-side into the page | `localBusiness()` + `website()` from `@businessdash/sdk/seo` |

### Storefront (`src/app/store/*`)

The cart is keyed on a visitor token we own — an httpOnly `biab_cart_visitor`
cookie minted by the cart Server Actions on first mutation. All cart/checkout
logic lives in `src/app/_actions/store.ts` (Server Actions); the SDK only ever
runs server-side.

| Route | Where it lives | SDK call |
| --- | --- | --- |
| `/store` | product list (`page.tsx`) | `biab.storefront.listProducts(...)` |
| `/store/[id]` | product detail + `AddToCart.tsx` | `biab.storefront.getProduct(id)`, `cart.forVisitor(token).addItem(...)` |
| `/store/cart` | `CartClient.tsx` — qty ±, remove, clear, coupon, checkout | `cart.forVisitor(token).{updateItem,removeItem,clear,applyCoupon,removeCoupon}`, `checkout.forVisitor(token).start(...)` |
| `/store/subscriptions` | subscription offerings list | `biab.subscriptions.list()` |
| `/store/order` | Stripe return page — confirms payment | `biab.checkout.getStatus(sessionId)` |

### Auth + customer portal

| Surface | Where it lives | SDK call |
| --- | --- | --- |
| Auth handler | `src/app/api/biab-auth/[...slug]/route.ts` (catch-all: sign-in / sign-up / callback / sign-out / me) | `createAuthHandler({...})` |
| Header sign-in/up/out | `src/app/_components/biab/AuthButtons.tsx` (`SignIn`/`SignUp`/`SignOut`/`useUser` from `@businessdash/sdk/react`) | — |
| `/my-account` | signed-in user + work bundle + review form | `getTenantSession(...)`, `customerPortal(org).withSession(token).getWork()` |
| Review submit | `src/app/_actions/review.ts` + `ReviewForm.tsx` | `customerPortal(org).withSession(token).submitReview(...)` |

### SEO routes + programmatic pages

| Route | Where it lives | SDK call |
| --- | --- | --- |
| `/sitemap.xml` | proxies the BIAB endpoint | `parallelPages.sitemapUrl()` (path) |
| `/robots.txt` | proxies the BIAB endpoint | `parallelPages.robotsUrl()` (path) |
| `/services/[service]/[area]` | programmatic SEO page (`generateStaticParams` + render) | `biab.parallelPages.listVariants("service-area")`, `.render("service-area", { service, area })` |

### Suspension handling

`src/server/lib/biab.ts` exports `readOrUnavailable(...)` and a
`SiteUnavailableError`. Reads that can hit a suspended org (the marketing
bundle, the storefront) are wrapped so a fully-suspended account surfaces a
minimal "site unavailable" state instead of a stack trace. The parallel-page
route re-throws `BiabServiceSuspendedError` to the framework error boundary.

Every surface no-ops gracefully when the BIAB env is unset — the home page
renders local fallback content, and the store / account / SEO routes show a
"not connected" notice or an empty-but-valid response.

## Adding a new SDK surface

One pattern, two halves:

1. **Server** — add a procedure to `src/server/api/routers/biab.ts`:
   ```ts
   myNewCall: publicProcedure
     .input(z.object({ ... }))
     .query(async ({ input }) => {
       const biab = getBiab();
       return await biab.x.y(input);
     }),
   ```
2. **Client** — call it from a component:
   - Server Component: `await api.biab.myNewCall({...})`
   - Client Component: `api.biab.myNewCall.useQuery({...})` or `.useMutation()`

That's it. tRPC handles transport + types end-to-end.

## Webhook revalidation (built in)

`src/app/api/biab/revalidate/route.ts` is one line:

```ts
export { POST } from "@businessdash/sdk/next/revalidate";
```

The SDK handler reads `BIAB_REVALIDATION_SECRET` from env, verifies the HMAC, and calls Next's `revalidateTag(...)`. Register the URL at BIAB → Settings → Integrations and paste the revealed `whsec_…` into your env.

Since this starter uses `export const dynamic = "force-dynamic"` on the home page, every request re-renders server-side — the webhook is the right wiring for once you add cache-tag-based ISR.

## Environment variables

Validated in `src/env.js`, documented in `.env.example`:

| Var | Required for | Notes |
| --- | --- | --- |
| `BIAB_API_KEY` | everything | secret site key (server-only) |
| `BIAB_SITE_ID` | everything | site UUID |
| `BIAB_PACKAGE_API_BASE_URL` | everything | e.g. `https://www.biab.app` |
| `BIAB_REVALIDATION_SECRET` | webhook | `whsec_…` HMAC secret |
| `BIAB_AUTH_CALLBACK_URL` | auth / portal | your `/api/biab-auth/callback` URL, registered as a WorkOS redirect URI |
| `NEXT_PUBLIC_SITE_URL` | JSON-LD | production origin; defaults to `https://example.com` |

## Project layout (BIAB-relevant only)

```
.
├── biab.config.ts                                # marketing schema + parallel-page def
├── src/
│   ├── env.js                                    # BIAB env vars (+ auth callback, site URL)
│   ├── server/
│   │   ├── lib/
│   │   │   ├── biab.ts                           # SDK client + bundle/banner/updates/reviews + suspension
│   │   │   ├── biab-store.ts                     # storefront / cart / checkout / subscriptions helpers
│   │   │   ├── biab-portal.ts                    # session + customer-portal helpers
│   │   │   └── biab-seo.ts                        # server-side JSON-LD builder
│   │   └── api/
│   │       ├── root.ts                           # registers biabRouter
│   │       └── routers/biab.ts                   # tRPC procedures (home + RPCs + reviewsPage)
│   ├── app/
│   │   ├── page.tsx                              # home: sections + banner + updates + reviews + JSON-LD
│   │   ├── _actions/                             # Server Actions
│   │   │   ├── store.ts                          # cart / checkout (mints biab_cart_visitor cookie)
│   │   │   └── review.ts                         # customer review submit
│   │   ├── _components/biab/
│   │   │   ├── Header.tsx / Footer.tsx / Hero.tsx / About.tsx / Services.tsx
│   │   │   ├── Gallery.tsx / Blog.tsx / Booking.tsx / ContactForm.tsx
│   │   │   ├── AuthButtons.tsx                   # SignIn/SignUp/SignOut + useUser
│   │   │   ├── ReviewForm.tsx                    # "use client" review submit form
│   │   │   ├── Reviews.tsx / ReviewsLoadMore.tsx # reviews wall + load-more
│   │   │   ├── Updates.tsx                       # bundle.updates feed
│   │   │   └── NewsBanner.tsx                    # dismissible bundle.banner bar
│   │   ├── store/                                # /store, /store/[id], /store/cart, /store/subscriptions, /store/order
│   │   ├── my-account/page.tsx                   # signed-in portal + review form
│   │   ├── services/[service]/[area]/page.tsx    # programmatic SEO page
│   │   ├── sitemap.xml/route.ts                  # proxies BIAB sitemap
│   │   ├── robots.txt/route.ts                   # proxies BIAB robots
│   │   └── api/
│   │       ├── biab/revalidate/route.ts          # one-liner webhook receiver
│   │       └── biab-auth/[...slug]/route.ts      # createAuthHandler catch-all
│   └── styles/globals.css                        # Tailwind + BIAB tokens + parity-surface styles
├── .env.example
├── README.md
└── package.json
```

The BIAB layer plugs into the existing T3 conventions cleanly — the tRPC client/server boundary, the Drizzle DB layer, the Tailwind setup all stay as-is.


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
