# BIAB SDK — Phoenix starter

The same generic business site every BIAB starter renders, built on **Phoenix + Elixir**. Every page is server-rendered; the browser gets HTML, and the bearer key never leaves the BEAM.

## Why this one exists

Phoenix is the second starter that **cannot use `@businessdash/sdk`** — the SDK is TypeScript. `lib/biab_starter/biab/` is a ~600-line client that talks to the Package API directly, which turns out to be a small job: the surface is plain REST with a bearer key.

But unlike the Laravel starter, Phoenix isn't just a translation. It does one thing none of the JS starters can.

## The thing that makes this worth having

**The entire BIAB real-time surface is polling.** There is no SSE and no WebSocket anywhere in the Package API. The SDK's own guidance is `chatbot/messages` every **3–5 seconds** while a widget is open, and `chatbot/availability` every **20–30 seconds**.

In a browser-rendered starter that cost is *per tab*. Ten people watching a conversation is ten browsers independently hitting BIAB every few seconds, and the org pays for every one.

Here, `BiabStarter.Biab.ChatSession` is one GenServer per conversation. It polls once and broadcasts deltas over `Phoenix.PubSub` to every attached LiveView. **N viewers collapse to 1 upstream request.** Open `/chat` in two tabs and watch both update from a single poll.

The same shape applies to the revalidation webhook: instead of busting a local cache map, a publish becomes a cluster-wide PubSub broadcast that drops the named tags on every node.

## Setup

```sh
mix deps.get
cp .env.example .env
# Fill BIAB_SITE_ID, BIAB_API_KEY, BIAB_AUTH_CALLBACK_URL

mix phx.server
```

Open <http://localhost:4000>. **With no BIAB credentials at all the site still renders** — every section falls back to local copy and a banner tells you what to set. A starter you can't run before signing up isn't a starter.

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

Node is **not** a runtime dependency — Phoenix ships a standalone esbuild binary. `package.json` exists only so `npx biab-dev` resolves.

## The shape, file-by-file

```
lib/biab_starter/biab/
  client.ex          transport: bearer, Origin, access gate, query encoding
  cache.ex           ETS + tag index; purge broadcasts on PubSub
  auth.ex            sign-in / callback / sign-out / session validation
  webhook.ex         HMAC verification for the publish webhook
  chat_session.ex    ONE poller per conversation, fanned out over PubSub
  resources/         storefront cart checkout blog forms marketing
                     parallel_pages portal data_model reviews
                     subscriptions followers
lib/biab_starter/biab.ex     app-facing entry: cache tags + fallbacks
lib/biab_starter_web/
  plugs/cache_body_reader.ex the raw-body stash (see below)
  live/chat_live.ex          the one LiveView
  controllers/               one per surface, all dead views
```

## Feature parity

| Surface | Route(s) | Calls |
| --- | --- | --- |
| **Home sections** | `/` | `marketing.page_bundle`, `storefront.list`, `blog.list` |
| **Storefront** | `/store`, `/store/:id` | `storefront.grid`, `get`, `related`, `reviews` |
| **Cart** | `/cart` + mutations | `cart.*` — `biab_cart_visitor` httpOnly cookie |
| **Checkout** | `POST /cart/checkout` | `checkout.start` → 303 to `stripeUrl` |
| **Subscriptions** | `/subscriptions` | `subscriptions.list`, `checkout` |
| **Blog** | `/blog`, `/blog/:slug` | `blog.list`, `get`, `comments` |
| **Reviews wall** | `/reviews` | `reviews.list` |
| **Programmatic SEO** | `/services`, `/services/:service/:area` | `parallel_pages.variants`, `render` |
| **Auth + portal** | `/api/biab-auth/*`, `/my-account` | `auth.*`, `portal.work`, `submit_review` |
| **Custom database** | `/todos` | `data_model.list` + `forms.submit` |
| **Front Desk chat** | `/chat` (LiveView) | `chatbot/messages` via one shared poller |
| **SEO / AEO** | `/sitemap.xml`, `/robots.txt`, `/llms.txt` | proxied |
| **Revalidation** | `POST /api/biab/revalidate` | HMAC verify → PubSub purge |

## Five things that will bite you

**1. The webhook needs the RAW body.** `Plug.Parsers` reads the body stream to exhaustion, and re-encoding the decoded map produces different bytes — different key order, different whitespace — so the HMAC never matches. It fails looking *exactly* like a wrong secret. `Plugs.CacheBodyReader` stashes the raw payload for that one path; it's wired via `body_reader:` in `endpoint.ex`. This is the single most common way a Phoenix webhook integration fails.

**2. LiveView and web components fight over the DOM.** `<biab-form>` mutates its own subtree; LiveView's patcher wants to own those nodes. In a dead view (every page here except `/chat`) that never comes up. If you move a form into a LiveView, wrap it:

```heex
<div id="contact-form" phx-update="ignore">
  <biab-form slug="general-inquiry"></biab-form>
</div>
```

**3. Money has two shapes.** Product, subscription, and checkout amounts are **integer cents**; cart `unitPrice`/`subtotal` arrive **decimal**. `Money.cents/2` and `Money.amount/2` exist so you pick deliberately — mixing them is a 100× error in either direction.

**4. Two different session headers.** `auth/me` takes a lowercase `x-biab-session`. Cart and customer-portal routes take `X-BIAB-Session-Token`. Not interchangeable, and the wrong one reads as "signed out" rather than as an error.

**5. The access gate answers reads with HTTP 200.** A lapsed plan returns `{"available": false, …}` in the *body*, not a 4xx — so a client that only matches on status renders a silently empty page. `Client.handle/1` checks the body clause first, deliberately above the status clause.

## The CDN pin

`root.html.heex` imports the `<biab-form>` element and its stylesheet from esm.sh at an **exact version**, not `@latest`. A CDN import has no lockfile: `@latest` would roll this page forward on somebody else's release, with no PR and no way to pin a rollback. Bump it deliberately, in step with `package.json`.

## What this starter does not do

- **No native form renderer.** The `<biab-form>` component handles conditional blocks, availability pickers and uploads; reimplementing that in HEEx is its own project.
- **No typed structs.** Responses are maps with string keys. Real structs would be the natural next step if this graduates from a starter to a Hex package.
- **No shipping / address / coupons-admin surfaces.** The endpoints exist; the client covers what these pages use.
- **`/chat` assumes a session already exists.** Minting one (`chatbot/session`) and the human-handoff queue are wired in the API but not in this UI.

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

```elixir
alias BiabStarter.Biab.Resources.DataModel

{:ok, page} = DataModel.list(client, site_id, "projects")
{:ok, everything} = DataModel.all(client, site_id, "projects")
```

Record **writes** go through the CLI/seed file above rather than this client:
they are batched and keyed on row identity (`universalIdentifier`), which is
what makes a re-run update the row rather than create a second one.
