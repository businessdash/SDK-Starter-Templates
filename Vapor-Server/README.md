# BIAB SDK — Vapor starter

The same generic business site every BIAB starter renders, on **server-side Swift**. Every page is Leaf-rendered; the browser gets HTML, and the bearer key never leaves the process.

## ⚠️ The directory name matters

This ships as `Vapor-Server`, not `Vapor`, and that is not cosmetic. SwiftPM derives a package's identity from its **directory name**, so a folder called `Vapor` collides with the `vapor` dependency and resolution dies with:

```
error: 'vapor': product 'Vapor' required by package 'vapor' target 'App'
       not found in package 'vapor'
```

…which reads like the dependency is broken when it's your folder. Rename the folder if you copy this somewhere; don't chase the dependency.

## Not the same client as the Swift app starter

The native Swift starter's `BiabKit` **traps on an `sk_…` key**, because an app ships its credential inside the binary where `strings` finds it. A server is the opposite case: the key never leaves this process, so the client here takes a **secret key** and gets the full API rather than the publishable subset.

Keeping them separate also keeps each starter clonable on its own, which is how every other template in this repo works.

## Setup

```sh
cp .env.example .env
# Fill BIAB_SITE_ID and BIAB_API_KEY

swift run App serve --port 8080
```

Open <http://localhost:8080>. **With no BIAB credentials at all the site still renders** — every section falls back to local copy and a banner says what to set.

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
Sources/App/
  configure.swift        Leaf + the client, nil-when-unconfigured
  routes.swift           every route in one place
  Biab/
    BiabClient.swift     transport: bearer, Origin, the access gate
    BiabCache.swift      actor, tag-addressed; + Application storage
    BiabWebhook.swift    HMAC verification
    Models.swift         Content structs
    JSONValue.swift      for the two schema-driven surfaces
    Money.swift          cents vs decimal
    Resources.swift      the call surface
  Controllers/           one per surface + Contexts.swift
Resources/Views/         Leaf templates
```

## Feature parity

| Surface | Route(s) | Calls |
| --- | --- | --- |
| **Home sections** | `/` | `pageBundle`, `products` |
| **Storefront** | `/store`, `/store/:id` | `productGrid`, `product`, `productReviews` |
| **Cart** | `/cart` + mutations | `cart`, `cartAdd`, `cartClear` — `biab_cart_visitor` httpOnly cookie |
| **Checkout** | `POST /cart/checkout` | `startCheckout` → redirect to `stripeUrl` |
| **Subscriptions** | `/subscriptions` | `subscriptions` |
| **Blog** | `/blog`, `/blog/:slug` | `posts`, `post` |
| **Reviews wall** | `/reviews` | `reviews` |
| **Programmatic SEO** | `/services`, `/services/:service/:area` | `parallelVariants`, `renderParallelPage` |
| **Custom database** | `/todos` | `allRecords` |
| **SEO / AEO** | `/sitemap.xml`, `/robots.txt`, `/llms.txt` | proxied |
| **Forms proxy** | `/api/biab/forms/:slug` | `formSchema`, `submitForm` |
| **Revalidation** | `POST /api/biab/revalidate` | HMAC verify → purge cache tags |

## Five things that will bite you

**1. The webhook needs the RAW body.** `WebhookController` reads `req.body.string`, never `req.content.decode`. Decoding and re-encoding changes key order and whitespace, so the HMAC stops matching — and it fails looking exactly like a wrong secret. Vapor doesn't consume the body before your handler the way Phoenix's `Plug.Parsers` does, so no custom body reader is needed here; just don't round-trip it.

**2. The access gate answers reads with HTTP 200.** A lapsed plan returns `{"available": false, …}` in the *body*. `BiabClient` checks the body *before* the status, deliberately — a status-first check renders an empty page and never notices.

**3. Money has two shapes.** Product, subscription and invoice totals are **integer cents**; cart `unitPrice`/`subtotal` arrive **decimal**. `Money.cents` and `Money.amount` are separate so you pick deliberately. Leaf can't call methods, so contexts format money in Swift — which is also what keeps the decision where the type system helps.

**4. Checkout returns `stripeUrl`, not `url`.**

**5. The cart visitor token is generated locally.** There is no endpoint that mints one — `cart/session` is a tokenized iframe embed, a different feature. It lives in an httpOnly cookie; the cart itself lives at BIAB, which is why this works behind a load balancer with no sticky sessions.

## What this starter does not do

- **No native form renderer.** `<biab-form>` from esm.sh handles conditional blocks, availability pickers and uploads, pointed at this app's own `/api/biab/forms` proxy so the key stays server-side.
- **No customer portal.** The endpoints exist and the tenant-auth flow is the same three calls the other starters make; it isn't wired here.
- **No tests.** The client is exercised by running it; a `XCTVapor` suite would be the natural next step.

## Verification

`swift build` passes under **Swift 6 language mode**. The server has not been run against a live BIAB site from this machine.

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

```swift
let page = try await client.dataModel.records(object: "projects")

// Follows the cursor for you, capped so a background refresh cannot hang.
let everything = try await client.dataModel.allRecords(object: "projects")
```

Record **writes** go through the CLI/seed file above rather than this client:
they are batched and keyed on row identity (`universalIdentifier`), which is
what makes a re-run update the row rather than create a second one.
