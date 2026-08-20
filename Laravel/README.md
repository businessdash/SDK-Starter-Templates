# BIAB SDK — Laravel starter

The same generic business site every BIAB starter renders, built on **Laravel + Blade**. Every page is server-rendered; the browser gets HTML, and the bearer key never leaves PHP.

## Why this one is different

This is the first starter that **cannot use `@businessdash/sdk`**. The SDK is TypeScript, and Laravel is PHP — so instead of wrapping it, this starter talks to the Package API directly.

That turns out to be a small job, because the platform surface is plain REST with a bearer key. `app/Biab/` is roughly 700 lines and covers everything the twelve pages here need. What it deliberately does *not* do is reimplement the parts of the SDK that are genuinely hard:

| Hard part | How this starter avoids porting it |
| --- | --- |
| The form renderer (conditional blocks, availability pickers, uploads) | `<biab-form>` from esm.sh, pointed at this app's own `/api/biab/forms` proxy |
| Analytics beacon | `analytics-core` from esm.sh, one module script in the layout |
| Schema + data-model CLI, and its canonical checksum | `npm run sync-schema` runs the real `biab-dev` CLI against the TypeScript config files |

Node is **not** a runtime dependency. `package.json` exists only so `npx biab-dev` can resolve; `php artisan serve` needs nothing but PHP.

## Setup

```sh
composer install
cp .env.example .env
php artisan key:generate

# Fill BIAB_SITE_ID, BIAB_API_KEY, BIAB_AUTH_CALLBACK_URL
php artisan serve
```

Open <http://localhost:8000>. **With no BIAB credentials at all the site still renders** — every section falls back to local copy and a banner tells you what to set. That is deliberate: a starter you can't run before signing up isn't a starter.

For the schema + custom-database flows:

```sh
npm install                  # dev-only, for the CLI
npm run sync-schema          # push biab.config.ts to BIAB's draft slot
npm run sync-data-model      # push the todos data model (+ generated form)
npm run seed                 # upsert the rows in ./biab-records
npm run view-data-model      # what's LIVE in BIAB right now
```

The CLI is Node, and it is the **only** part of any starter that needs Node.
It runs through `tsx` so the TypeScript config files load on any supported
Node version — the schema artifact carries a canonical checksum the platform
verifies, and reimplementing that in another language would mean matching the
canonicalisation byte for byte.

Seeding is language-neutral: `biab-records/` is plain JSON, identical across
every starter. Only the *schema* files are TypeScript.

## The shape, file-by-file

```
app/Biab/
  Client.php          transport: bearer, Origin, access gate, query encoding
  Biab.php            app-facing entry: memoised client, tagged cache, fallbacks
  Auth.php            sign-in / callback / sign-out / session validation
  Webhook.php         HMAC verification for the publish webhook
  BiabException.php   BiabApiException + BiabAccessRejectedException
  Resources/          Storefront Cart Checkout Blog Forms Marketing
                      ParallelPages Portal DataModel Reviews
                      Subscriptions Followers
app/Http/Controllers/ one per surface
app/Support/Money.php cents vs decimal — see the note below
config/biab.php       every knob, all server-side
routes/web.php        twelve pages + four machine endpoints
resources/views/      layout.blade.php + pages/
```

## Feature parity

| Surface | Route(s) | Calls |
| --- | --- | --- |
| **Home sections** | `/` | `marketing.getPageBundle`, `storefront.listProducts`, `blog.listPosts` |
| **Storefront** | `/store`, `/store/{id}` | `storefront.listProductsWithMeta`, `getProduct`, `getRelatedProducts`, `getProductReviews` |
| **Cart** | `/cart` + mutations | `cart.{get,addItem,updateItem,removeItem,applyCoupon,removeCoupon,clear}` — `biab_cart_visitor` httpOnly cookie |
| **Checkout** | `POST /cart/checkout` | `checkout.start` → 303 to `stripeUrl` |
| **Subscriptions** | `/subscriptions` | `subscriptions.list`, `subscriptions.checkout` |
| **Blog** | `/blog`, `/blog/{slug}` | `blog.listPosts`, `getPost`, `listComments` |
| **Reviews wall** | `/reviews` | `reviews.list({limit, offset})` |
| **Updates** | `/updates` | `bundle.updates` |
| **Programmatic SEO** | `/services`, `/services/{service}/{area}` | `parallelPages.listVariants`, `render` |
| **Auth + portal** | `/api/biab-auth/*`, `/my-account` | `auth.{start,exchange,me,signOut}`, `portal.{getWork,submitReview}` |
| **Custom database** | `/todos` | `dataModel.listRecords` + `forms.submit` |
| **Newsletter** | `POST /subscribe` | `followers.join` (site action) |
| **SEO / AEO** | `/sitemap.xml`, `/robots.txt`, `/llms.txt` | proxied |
| **Forms proxy** | `/api/biab/forms/{slug}` | `forms.schema`, `forms.submit` |
| **Revalidation** | `POST /api/biab/revalidate` | HMAC verify → drop cache tags |

## Four things that will bite you

**1. The revalidate webhook needs the RAW body.** `Webhook::verify()` takes `$request->getContent()`. Passing `$request->all()` re-encodes the JSON, which changes key order and whitespace, and the HMAC silently stops matching. The route is CSRF-exempt because it's authenticated by signature, not session.

**2. Money has two shapes.** Product, subscription, and checkout amounts are **integer cents**; cart `unitPrice`/`subtotal` come back **decimal**. `Money::cents()` and `Money::amount()` exist so you pick deliberately — mixing them is a 100× error in either direction. Check which shape a field is before rendering a new one.

**3. Two different session headers.** `auth/me` takes a lowercase `x-biab-session`. The cart and customer-portal routes take `X-BIAB-Session-Token`. They are not interchangeable, and sending the wrong one reads as "not signed in" rather than as an error.

**4. Tagged cache needs a tag-capable store.** `file` and `database` don't support tags, so the publish webhook falls back to flushing everything. Use `redis` or `memcached` in production.

## The CDN pin

`layout.blade.php` and `pages/home.blade.php` import the SDK islands from esm.sh at an **exact version**, not `@latest`. A CDN import has no lockfile: `@latest` would roll this page forward on somebody else's release, with no PR and no way to pin a rollback. Bump it deliberately, and keep it in step with `package.json`.

## What this starter does not do

- **No native chatbot UI.** Front Desk chat is a polling API (`chatbot/messages`, every 3–5s while open). A Blade page can poll it, but the SDK's widget isn't ported. Wire `<biab-chat>` from the CDN, or build it.
- **No typed models.** Responses are PHP arrays; the views use `data_get()` with defaults. Real DTOs would be the natural next step if this graduates from a starter to a package.
- **No shipping / address / coupons-admin surfaces.** The endpoints exist; the client covers what these twelve pages use.

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

```php
$dataModel = $client->dataModel($siteId);

$page = $dataModel->listRecords('projects');
$everything = $dataModel->listAllRecords('projects');
```

Record **writes** go through the CLI/seed file above rather than this client:
they are batched and keyed on row identity (`universalIdentifier`), which is
what makes a re-run update the row rather than create a second one.
