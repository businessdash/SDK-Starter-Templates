# BD SDK — Laravel starter

The same generic business site every BD starter renders, built on **Laravel + Blade**. Every page is server-rendered; the browser gets HTML, and the bearer key never leaves PHP.

## Why this one is different

This is the first starter that **cannot use `@businessdash/sdk`**. The SDK is TypeScript, and Laravel is PHP — so instead of wrapping it, this starter talks to the Package API directly.

That turns out to be a small job, because the platform surface is plain REST with a bearer key. The client in `app/Bd/` is roughly 700 lines and covers everything the twelve pages here need. What it deliberately does *not* do is reimplement the parts of the SDK that are genuinely hard:

| Hard part | How this starter avoids porting it |
| --- | --- |
| Analytics beacon | `analytics-core` from esm.sh, one module script in the layout |
| Schema + data-model CLI, and its canonical checksum | `npm run sync-schema` runs the real `bd` CLI against the TypeScript config files |

Forms and quizzes used to be on that list. They're native now: the SDK's form
and quiz engine ported to PHP and drawn by Livewire, checked against the
TypeScript original — see [Forms and quizzes](#forms-and-quizzes).

Node is **not** a runtime dependency. `package.json` exists only so `npx bd` can resolve; `php artisan serve` needs nothing but PHP.

## Setup

```sh
composer install
cp .env.example .env
php artisan key:generate

# Fill BD_SITE_ID, BD_API_KEY (sign-in on /my-account needs nothing more)
php artisan serve
```

Open <http://localhost:8000>. **With no BD credentials at all the site still renders** — every section falls back to local copy and a banner tells you what to set. That is deliberate: a starter you can't run before signing up isn't a starter.

For the schema + custom-database flows:

```sh
npm install                  # dev-only, for the CLI
npm run sync-schema          # push bd.config.ts to BD's draft slot
npm run sync-data-model      # push the todos data model (+ generated form)
npm run seed                 # upsert the rows in ./bd-records
npm run view-data-model      # what's LIVE in BD right now
```

The CLI is Node, and it is the **only** part of any starter that needs Node.
It runs through `tsx` so the TypeScript config files load on any supported
Node version — the schema artifact carries a canonical checksum the platform
verifies, and reimplementing that in another language would mean matching the
canonicalisation byte for byte.

Seeding is language-neutral: `bd-records/` is plain JSON, identical across
every starter. Only the *schema* files are TypeScript.

## PHP version

PHP **8.2.36, 8.3.37, 8.4.28 or 8.5.13**, or later: the 19 November 2026
security releases. Every earlier build of those branches has critical holes,
including remote code execution through the session extension
(CVE-2026-126714, CVE-2026-115560, CVE-2026-129481) and request smuggling in
PHP-FPM (CVE-2026-129289), on top of October's "PHP2Shell" (CVE-2026-109618,
CVE-2026-109619). PHP 8.1 and older get no fixes at all.

- `composer install` refuses an older PHP (`require.php` in `composer.json`).
- The site checks again when it runs (`App\Support\PhpSecurity`), because a
  server can run an older PHP than the one that installed it: a warning in the
  log once a day, and a banner when `APP_ENV=local`. Never a public banner,
  which would tell attackers.
- It tells BusinessDash the PHP it runs on: every request sends
  `X-BD-Client: laravel/1 php/8.4.28 laravel-framework/12.73.0`, and nothing
  else about the app. When a PHP release fixes something serious, your org's
  admins get a security advisory (Developer → Security) listing the sites
  still on an older build, until each one reports a fixed version.
- Check with `php -v` on the server that serves the site, and restart PHP-FPM's
  workers after updating. Some distributions backport the fixes under the old
  version number; if yours does, the warning is a false alarm, so check its
  security advisory.
- Can't update today? php.net says updating is the only complete fix. Its
  stopgap for the session upload-progress path is
  `session.upload_progress.enabled=0` in `php.ini` (or the FPM pool), then a
  restart of every worker; `ini_set()` and `.user.ini` apply too late.

PHP 8.2's security fixes end on 31 December 2026, and the check flags it after
that. Use 8.4 or later for anything new.

## The shape, file-by-file

```
app/Bd/
  Client.php          transport: bearer, Origin, access gate, query encoding
  Bd.php            app-facing entry: memoised client, tagged cache, fallbacks
  Auth.php            session validation / sign-out / older hosted page
  Webhook.php         HMAC verification for the publish webhook
  BdException.php   BdApiException + BdAccessRejectedException
  Resources/          Storefront Cart Checkout Blog Forms Marketing
                      ParallelPages Portal DataModel Reviews
                      Subscriptions Followers Donations
  Forms/              the form + quiz engine, ported from the SDK (see below)
app/Http/Controllers/ one per surface
app/Livewire/         SignIn, BdForm, BdQuiz
app/Support/Money.php cents vs decimal — see the note below
config/bd.php       every knob, all server-side
routes/web.php        twelve pages + four machine endpoints
resources/views/      layout.blade.php, pages/, livewire/, forms/, quiz/
```

## Feature parity

| Surface | Route(s) | Calls |
| --- | --- | --- |
| **Home sections** | `/` | `marketing.getPageBundle`, `storefront.listProducts`, `blog.listPosts` |
| **Storefront** | `/store`, `/store/{id}` | `storefront.listProductsWithMeta`, `getProduct`, `getRelatedProducts`, `getProductReviews` |
| **Cart** | `/cart` + mutations | `cart.{get,addItem,updateItem,removeItem,applyCoupon,removeCoupon,clear}` — `bd_cart_visitor` httpOnly cookie |
| **Checkout** | `POST /cart/checkout` | `checkout.start` → 303 to `stripeUrl` |
| **Subscriptions** | `/subscriptions` | `subscriptions.list`, `subscriptions.checkout` |
| **Blog** | `/blog`, `/blog/{slug}` | `blog.listPosts`, `getPost`, `listComments` |
| **Reviews wall** | `/reviews` | `reviews.list({limit, offset})` |
| **Updates** | `/updates` | `bundle.updates` |
| **Programmatic SEO** | `/services`, `/services/{service}/{area}` | `parallelPages.listVariants`, `render` |
| **Auth + portal** | `/my-account` (sign-in screen, a Livewire component: `App\Livewire\SignIn`, words, checks and brand colours in `App\Bd\SignInCore`; `?next=/path` comes back after), `/api/bd-auth/customer/*`, `/api/bd-auth/*` | `auth/customer/*` (password, codes, Google / Apple / GitHub / Discord links — WorkOS underneath), `auth.{me,signOut}`, `portal.{getWork,submitReview}` |
| **Custom database** | `/todos` | `dataModel.listRecords` + `forms.submit` |
| **Newsletter** | `POST /subscribe` | `followers.join` (site action) |
| **SEO / AEO** | `/sitemap.xml`, `/robots.txt`, `/llms.txt` | proxied |
| **Forms** | `/forms/{slug}`, the home page's contact section (`BD_CONTACT_FORM`) | `forms/{slug}` — schema, collection options, uploads, submit (`App\Livewire\BdForm`) |
| **Quizzes** | `/quiz` (`BD_QUIZ`, or a sample), `/quiz/{slug}`, `/quiz-invite/{token}` | `quizzes/{slug}`, `quizzes/invitations/{token}` and their actions (`App\Livewire\BdQuiz`) |
| **Revalidation** | `POST /api/bd/revalidate` | HMAC verify → drop cache tags |

## Forms and quizzes

Forms and quizzes are drawn on this server. `app/Bd/Forms` is the SDK's form
and quiz engine in PHP — conditions, steps, calculations, validation, uploads
and submission; quizzes, their clock and grading — and two Livewire components
draw it: `<livewire:bd-form slug="…" />` and
`<livewire:bd-quiz source="practice" ref="…" />`. They use the SDK's
`bd-form__*` / `bd-quiz__*` classes, styled by `bd-forms.css` and
`public/forms.css`, and Livewire sends each change and button back so the page
updates in place.

- **It's checked against the SDK.** `tests/Fixtures/*-parity.json` are the
  TypeScript engine's answers to the same inputs, and `FormsData.php` its data
  tables; `pnpm gen:native-forms` in BD's `sdk/` writes them. `composer test`
  fails if the PHP drifts. Fix a difference in the PHP, not the fixtures.
- **The secret key stays here.** Uploads and submissions go through this server
  with `BD_API_KEY`; the browser never talks to BD. A picked file is held by
  Livewire until the form is sent, then uploaded to BD and submitted with it.
- **Quiz runs live in the cache.** A practice run (or the sample) is kept for
  3 hours under `bd.quiz.run.*` and found again by the `bd_quiz_run` cookie, so
  a reload picks up where it was. Behind several instances, use a shared cache
  (`redis`). Invitations are read from BD on every page — BD keeps their
  answers and clock.
- **Invitation links.** Set the quiz's invite domain (in BD's quiz builder) to
  this site and BD's invite emails link to `/quiz-invite/<token>`. One that
  needs the invited account sends the visitor to `/my-account?next=…` and back.

## Four things that will bite you

**1. The revalidate webhook needs the RAW body.** `Webhook::verify()` takes `$request->getContent()`. Passing `$request->all()` re-encodes the JSON, which changes key order and whitespace, and the HMAC silently stops matching. The route is CSRF-exempt because it's authenticated by signature, not session.

**2. Money has two shapes.** Product, subscription, and checkout amounts are **integer cents**; cart `unitPrice`/`subtotal` come back **decimal**. `Money::cents()` and `Money::amount()` exist so you pick deliberately — mixing them is a 100× error in either direction. Check which shape a field is before rendering a new one.

**3. Two different session headers.** `auth/me` takes a lowercase `x-bd-session`. The cart and customer-portal routes take `X-BD-Session-Token`. They are not interchangeable, and sending the wrong one reads as "not signed in" rather than as an error.

**4. Tagged cache needs a tag-capable store.** `file` and `database` don't support tags, so the publish webhook falls back to flushing everything. Use `redis` or `memcached` in production.

## The CDN pin

`layout.blade.php` imports the analytics island, and `forms/styles.blade.php` the forms stylesheet, from esm.sh at an **exact version**, not `@latest`. A CDN import has no lockfile: `@latest` would roll this page forward on somebody else's release, with no PR and no way to pin a rollback. Bump it deliberately, and keep it in step with `package.json`.

## What this starter does not do

- **No native chatbot UI.** Front Desk chat is a polling API (`chatbot/messages`, every 3–5s while open). A Blade page can poll it, but the SDK's widget isn't ported. Wire `<bd-chat>` from the CDN, or build it.
- **No typed models.** Responses are PHP arrays; the views use `data_get()` with defaults. Real DTOs would be the natural next step if this graduates from a starter to a package.
- **No shipping / address / coupons-admin surfaces.** The endpoints exist; the client covers what these twelve pages use.

<!-- [bd:donations] -->
## Donations

One-time and monthly gifts, paid to the org's own Stripe account. Your app
reads the giving page, posts the gift, and sends the donor to the Stripe URL it
gets back; BusinessDash records the gift, adds the donor as a contact, notifies
the org and emails the receipt. The full guide, with this starter's code in its
own tab: [Donations](https://businessdash.us/docs/developer/byFeature/donations).

`App\Bd\Resources\Donations`, reached through `Bd::client()`:

```php
Route::get('/give', fn () => view('give', ['page' => Bd::client()?->donations()->page()]));

Route::post('/give', function (Request $request) {
    $checkout = Bd::client()->donations()->startCheckout([
        'amountCents' => (int) $request->input('amount'),
        'frequency' => $request->boolean('monthly') ? 'monthly' : 'one_time',
        'coverFees' => $request->boolean('coverFees'),
        'donor' => ['name' => $request->input('name'), 'email' => $request->input('email')],
        'successUrl' => url('/give/thanks'),
        'cancelUrl' => url('/give'),
    ]);
    return redirect()->away($checkout['url'], 303);
});
// Cover-fees label: Donations::coverFeeCents(2500, $page['coverFee'])
```

Print `taxStatement` with `{{ }}` (escaped), never `{!! !!}`.

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

```php
$dataModel = $client->dataModel($siteId);

$page = $dataModel->listRecords('projects');
$everything = $dataModel->listAllRecords('projects');
```

Record **writes** go through the CLI/seed file above rather than this client:
they are batched and keyed on row identity (`universalIdentifier`), which is
what makes a re-run update the row rather than create a second one.
