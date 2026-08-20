# BIAB SDK — HTMX starter

Same generic business site as the other starters, built on **HTMX + Bun** with zero client-side JavaScript framework. Every section is server-rendered HTML; the browser asks for fragments and HTMX swaps them in.

## What's new (SDK 0.9.53)

Three additions — and because the SDK's new handlers are plain web `Request → Response` functions, they mount straight into `Bun.serve` with no adapter:

- **AEO / `llms.txt`** — `GET /llms.txt` (in `server.ts`) serves the org-curated llms.txt (Dashboard → Marketing → AI Distribution) from this domain's root via `llmsTxtHandler` from `@businessdash/sdk/distribution` — the only place AI crawlers look for it. The companion **product feed** needs no route: build its URL with `productFeedUrl({ siteId, baseUrl })` and submit it straight to merchant/feed programs (it's an OpenAI merchant-feed-shaped artifact, submittable as-is).
- **MCP connector proxy** — `POST /api/mcp` (JSON-RPC, with the spec's 405 on GET) and `GET /.well-known/mcp.json` (discovery manifest) via `mcpHandler` / `mcpManifestHandler` from `@businessdash/sdk/mcp`, so the URL an org hands to Claude / ChatGPT / Gemini is *this site's* `/api/mcp`. Thin by design — the platform still enforces the org's MCP opt-in and per-tool write gates. These take the BIAB app *origin* (`hostBase`), not the package API base.
- **Todos — relational custom-collections demo** — `biab.data-model.config.ts` declares two collections with the `collection()` + `bd` builders: `todos` (title / done / notes) and `todoImages`, whose `todo` field is a **relation** back to `todos`. `bun run sync-data-model` pushes the model (promote it in the dashboard, then set the generated "Todo Form" Live). `/todos` is a fully server-rendered page (`todosPage` in `src/pages.ts`) that lists todos with their images via `dataModel.listRecords({ object })` — relations come back as links, joined server-side — and the create form is pure HTMX: `hx-post="/todos"` re-renders the whole region, with the server calling `biab.forms.submit("todo-form", …)`, the SDK's documented create path for custom collections. Reads need the `metadata:read_records` scope on your key.

```sh
bun run sync-data-model    # push the todos data model (+ generated form) to BIAB's draft slot
bun run print-data-model   # print the resolved data model as JSON
```

## Why this shape

HTMX inverts the usual "build a JS app, fetch JSON" pattern:

```
browser → hx-get /sections/hero → Bun server → BIAB SDK → HTML fragment → swap
```

No bundler, no hydration step, no client-side state library. The same Bun server that holds the BIAB API key renders every section as HTML and returns it. The browser only ever sees HTML — your BIAB bearer key never leaves the server.

Five sections render server-side with the BIAB data:

- **Hero / About / Services** read the marketing bundle (Services also reads the product catalog) and fall back to local defaults
- **Blog** lists posts via `biab.blog.listPosts(...)`
- **Header / Footer** are pure static

One section is browser-interactive — and HTMX handles it without a single line of JS:

- **ContactForm** — the SDK's `<biab-form>` web component (loaded from the CDN, mounted in `public/index.html`). It renders the full `general-inquiry` schema client-side — flex-row layout, the conditional preferred-method block, the availability picker — which a hand-rolled server fragment can't. Schema + submit go through the same-origin `/api/biab/forms/{schema,submit}` proxy in `server.ts`, so the bearer key stays server-side.

Analytics boots from a tiny `<script type="module">` that dynamically imports `@businessdash/sdk/analytics-core` from esm.sh once the page loads. Config is injected into the HTML shell server-side, so no env-reading code lives in the static file.

## Setup

```sh
bun install
cp .env.example .env.local
# Fill BIAB_API_KEY, BIAB_SITE_ID, BIAB_PACKAGE_API_BASE_URL

bun run dev
```

Open <http://localhost:3000>. Sections load progressively as HTMX fires each `hx-get`. Without BIAB env configured, every section renders its local defaults (no crash, no blank page).

For production:

```sh
bun run start
```

## The shape, file-by-file

```
SDK-Starter-Templates/HTMX/
├── package.json
├── biab.config.ts             # Marketing schema + brand tokens + parallel page
├── tsconfig.json
├── server.ts                  # Bun server — sections, feature pages, auth, webhook, SEO
├── public/
│   ├── index.html             # HTMX shell — banner + every region is hx-get-driven
│   └── styles.css             # shared section + feature-page styles
└── src/
    ├── biab.ts                # SDK client + auth handler + session + webhook (server-only)
    ├── cache.ts               # in-memory tag cache (the webhook's target)
    ├── html.ts                # tag template helper with auto-escaping
    ├── layout.ts              # page shell, nav, banner, JSON-LD, money/cookie helpers
    ├── pages.ts               # feature-page + fragment renderers
    └── sections/
        ├── header.ts          # also exports renderFooter()
        └── hero.ts  about.ts  services.ts  blog.ts  subscribe.ts
```

> The contact form is the SDK's `<biab-form>` web component (loaded from the CDN
> and mounted in `public/index.html`), backed by the same-origin
> `/api/biab/forms/{schema,submit}` proxy in `server.ts` — so it renders the full
> `general-inquiry` schema (conditional fields, availability picker) that a
> hand-rolled server fragment couldn't.

## How a section renders

```ts
// src/sections/hero.ts
export async function renderHero(): Promise<string> {
  let hero = defaults;
  const biab = getBiab();
  if (biab) {
    try {
      const bundle = await biab.marketing.getPageBundle({
        pageKey: "home", locale: "en",
      });
      // ...read bundle.sections.hero...
    } catch { /* keep defaults */ }
  }
  return render(html`
    <section class="hero" id="hero">
      <h1 class="hero__title">${hero.title}</h1>
      <p class="hero__sub">${hero.tagline}</p>
      <a class="biab-btn" href="${hero.ctaHref}">${hero.ctaLabel}</a>
    </section>
  `);
}
```

`html` is a tiny tag function that escapes every interpolation by default. `render()` returns the final HTML string. Pre-built HTML can be inlined via `raw(...)` or by nesting another `html` call.

## Two ways to do forms

**Simple forms — HTMX server-post (no JavaScript).** The newsletter subscribe is an `hx-post`:

```html
<form hx-post="/sections/subscribe" hx-target="this" hx-swap="outerHTML">
  <input name="email" type="email" required />
  <button type="submit">Subscribe</button>
</form>
```

The browser posts to the server, the Bun handler calls the SDK, and the server returns a fragment HTMX swaps in place. If you've used Rails or Django server-rendered forms, the pattern feels identical — except the server is Bun + the BIAB SDK.

**Rich forms — the `<biab-form>` web component.** The contact form's `general-inquiry` schema has conditional fields and an availability picker, which need client interactivity a server fragment can't provide. So `public/index.html` mounts the SDK's `<biab-form>` (loaded from the CDN) and registers a same-origin proxy client; the element fetches the schema, renders every field type, validates, and submits through `/api/biab/forms/{schema,submit}` — the bearer key never leaves the server.

## How analytics get loaded

The Bun server injects the BIAB analytics config into the shell HTML right before `</body>`:

```html
<script>window.__BIAB_ANALYTICS__={"siteId":"...","baseUrl":"...","apiKey":"..."};</script>
```

A `<script type="module">` already in the shell reads that config and dynamically imports `@businessdash/sdk/analytics-core` from esm.sh — only when env is configured. DNT + GPC are honoured by the SDK; no cookies are set.

For production you'd probably swap the esm.sh import for a self-hosted bundle, but for a starter, the CDN import keeps the build step at zero.

## Adding a section

Three steps:

1. **Write the renderer** in `src/sections/your-thing.ts`:
   ```ts
   export async function renderYourThing(): Promise<string> { ... }
   ```
2. **Register the route** in `server.ts`'s `sectionHandlers` map:
   ```ts
   "GET /sections/your-thing": () => renderYourThing(),
   ```
3. **Add the placeholder** in `public/index.html`:
   ```html
   <div hx-get="/sections/your-thing" hx-trigger="load" hx-swap="outerHTML"></div>
   ```

That's it. No tsconfig update, no router setup, no component registration.

## Feature parity (BIAB SDK 0.9.5)

This starter is aligned with the production reference consumer — every surface
below is server-rendered HTML and degrades gracefully when BIAB env is unset.

| Surface | Route(s) | SDK calls |
| --- | --- | --- |
| **Home sections** | `/` (`hx-get /sections/*`) | `marketing.getPageBundle`, `storefront.listProducts`, `blog.listPosts`, `forms.*` |
| **Storefront** | `/store`, `/store/:id` | `storefront.listProducts`, `storefront.getProduct` |
| **Cart** | `/cart` + `hx-post /cart/*` | `cart.forVisitor(token).{get,addItem,updateItem,removeItem,applyCoupon,removeCoupon,clear}` — `biab_cart_visitor` httpOnly cookie; mutations return the `#cart-region` fragment |
| **Checkout** | `POST /cart/checkout` → Stripe | `checkout.forVisitor(token).start` (303 redirect) |
| **Subscriptions** | `/subscriptions` | `subscriptions.list` |
| **Reviews wall** | `/reviews` + `hx-get /sections/reviews-more` | `reviews.list({ limit, offset })` |
| **News banner + updates** | `hx-get /sections/banner`, `/updates` | `bundle.banner`, `bundle.updates` |
| **Auth + portal** | `/api/biab-auth/*`, `/my-account`, `POST /account/review` | `createAuthHandler`, `getTenantSession`, `customerPortal(org).withSession(token).{getWork,submitReview}` |
| **Programmatic SEO** | `/services`, `/services/:service/:area` | `parallelPages.listVariants`, `parallelPages.render` |
| **SEO files** | `/sitemap.xml`, `/robots.txt` | proxied from BIAB; JSON-LD via `@businessdash/sdk/seo` |
| **Revalidation webhook** | `POST /api/biab/revalidate` | `createGenericRevalidateHandler` → busts `src/cache.ts` |

Cart, reviews, and the contact form all work with **zero client JS framework** —
just HTMX attributes (`hx-post` / `hx-get` + `hx-target` + `hx-swap`).

### Environment

| Var | Required | Purpose |
| --- | --- | --- |
| `BIAB_API_KEY` / `BIAB_SITE_ID` / `BIAB_PACKAGE_API_BASE_URL` | for live data | Server-side SDK credentials |
| `BIAB_REVALIDATION_SECRET` | for webhook | HMAC secret verifying publish events |
| `BIAB_AUTH_CALLBACK_URL` | for auth/portal | This server's `/api/biab-auth/callback` URL (register in WorkOS) |
| `PORT` | no | Defaults to 3000 |

### Schema CLI

```sh
bun run sync-schema     # publish biab.config.ts schema to BIAB's draft slot
bun run sync-content    # (optional) push a local content tree
bun run print-schema    # print the resolved schema JSON
```

## Why HTMX for BIAB

HTMX is the closest shape to BIAB's own philosophy: the data + the business logic live on the server, the rendered output lives on your domain. Most JS frameworks ship a bundle that re-fetches the same data the server already has. HTMX renders once, swaps fragments on interaction, and never ships a JSON-fetcher. For a service business with mostly static content + a few forms, this is the lightest possible architecture.


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

## Data: environment, schema, seeding, CRUD

Everything below is the same in every starter — the CLI and the seed module are
the same tools whatever language the app is written in.

### 1. Environment variables

Three, from **Dashboard → Developers → API keys**:

| Variable | What it is |
|---|---|
| `BIAB_API_KEY` | The key. **Server-side only** unless it is a publishable key. |
| `BIAB_SITE_ID` | Which site this app is. |
| `BIAB_PACKAGE_API_BASE_URL` | e.g. `https://businessdash.us/api/package/v1` |

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
const site = client.site(process.env.BIAB_SITE_ID!)

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
