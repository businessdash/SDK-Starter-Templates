# BD SDK — Vapor starter

The same generic business site every BD starter renders, on **server-side Swift**. Every page is Leaf-rendered; the browser gets HTML, and the bearer key never leaves the process.

## ⚠️ The directory name matters

This ships as `Vapor-Server`, not `Vapor`, and that is not cosmetic. SwiftPM derives a package's identity from its **directory name**, so a folder called `Vapor` collides with the `vapor` dependency and resolution dies with:

```
error: 'vapor': product 'Vapor' required by package 'vapor' target 'App'
       not found in package 'vapor'
```

…which reads like the dependency is broken when it's your folder. Rename the folder if you copy this somewhere; don't chase the dependency.

## Not the same client as the Swift app starter

The native Swift starter's `BdKit` **traps on anything but a publishable `pk_…` token**, because an app ships its credential inside the binary where `strings` finds it. A server is the opposite case: the key never leaves this process, so the client here takes a **secret key** and gets the full API rather than the publishable subset.

Keeping them separate also keeps each starter clonable on its own, which is how every other template in this repo works.

## Setup

```sh
cp .env.example .env
# Fill BD_SITE_ID and BD_API_KEY

swift run App serve --port 8080
```

Open <http://localhost:8080>. **With no BD credentials at all the site still renders** — every section falls back to local copy and a banner says what to set.

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


## The shape, file-by-file

```
Sources/App/
  configure.swift        Leaf + the client, nil-when-unconfigured
  routes.swift           every route in one place
  Bd/
    BdClient.swift     transport: bearer, Origin, the access gate
    BdCache.swift      actor, tag-addressed; + Application storage
    BdWebhook.swift    HMAC verification
    Models.swift         Content structs
    JSONValue.swift      the schema-driven surfaces + data passed to the elements
    Money.swift          cents vs decimal
    PostHtml.swift       a post's HTML rebuilt from an allowlist; reading time, date
    Resources.swift      the call surface
    Reviews.swift        the reviews' rules: breakdown, platforms, safe links, checks
    Donations.swift      giving page + checkout (see Donations below)
  Controllers/           one per surface + Contexts.swift
    ShopSupport.swift    cart cookie, element JSON, stars, the JSON-POST guard
    ShopContexts.swift   the store and blog pages' view contexts
  Forms/                 forms + quizzes, drawn here (FormPage, QuizPage)
Sources/BdForms/         BD's forms + quiz engine — a generated copy, see below
Resources/Views/         Leaf templates (store-nav.leaf: the store bar)
Resources/Forms/         the sample form + quiz shown until BD is connected
Public/shop/             the shop, blog and review elements, plain ES modules
Public/bd-*.css          their styles (pages, shop, blog, reviews)
Tests/AppTests/          `swift test`: the post sanitizer against the TypeScript's answers, the reviews' rules
```

## Feature parity

| Surface | Route(s) | Calls |
| --- | --- | --- |
| **Home sections** | `/` | `pageBundle`, `products` |
| **Storefront** | `/store` (`?q`, `?category`, `?priceMin`, `?priceMax`, `?rating`, `?sort`), `/store/:id` (`<bd-product>`) | `productGrid`, `storeCategories`, `productData`, `productReviewPage`, `productAddons`, `relatedProducts` |
| **Wishlist + compare** | `/store/wishlist`, `/store/compare?ids=a,b` | `productData`, `productReviewPage` — the lists live in the browser |
| **Cart** | `/cart` + mutations, `POST /api/bd/cart/add` (JSON, from the product page) | `cart`, `cartAdd`, `cartClear` — `bd_cart_visitor` httpOnly cookie |
| **Checkout** | `POST /cart/checkout`, back to `/store/order` | `startCheckout` → redirect to `stripeUrl`; `checkoutStatus` |
| **Subscriptions** | `/subscriptions` | `subscriptions` |
| **Blog** | `/blog` (`?category`, `?tag`, `?cursor`), `/blog/:slug`, `POST /blog/:slug/like`, `POST /blog/:slug/comment` | `posts`, `post`, `blogCategories`, `blogTags`, `comments`, `likeStatus`, `toggleLike`, `postComment` |
| **Business reviews** | `/reviews` (`?source=` filters, `?shown=` shows more), `POST /reviews/write` (`<bd-review-writer>`) | The bundle's `reviews` (average, count, count per star), `reviews(limit:offset:source:)`, `PortalResource.submitReview`. The rules are `Reviews` (`Sources/App/Bd/Reviews.swift`, tested in `ReviewsTests`), the same as `reviews.ts` in the other BD starters. |
| **Programmatic SEO** | `/services`, `/services/:service/:area` | `parallelVariants`, `renderParallelPage` |
| **Custom database** | `/todos` | `allRecords` |
| **Sign-in + account** | `/my-account` (the sign-in screen, rendered in Swift: `SignInController`, `Bd/SignInCore.swift`; `?next=/path` comes back after), `/api/bd-auth/customer/*`, `/api/bd-auth/sign-out` | `auth/customer/*` (password, codes, Google / Apple / GitHub / Discord), `auth/me`, `customer-portal/work` — `bd_session` httpOnly cookie |
| **SEO / AEO** | `/sitemap.xml`, `/robots.txt`, `/llms.txt` | proxied |
| **Forms** | `/forms/:slug`, the home page's contact section (`BD_CONTACT_FORM`) | `forms/:slug` — schema, collection options, uploads, submit (`FormPage`) |
| **Quizzes** | `/quiz` (`BD_QUIZ`, or a sample), `/quiz/:slug`, `/quiz-invite/:token`, `/quiz-timer/:run` | `quizzes/practice/*`, `quizzes/invitations/*` (`QuizPage`) |
| **Revalidation** | `POST /api/bd/revalidate` | HMAC verify → purge cache tags |

## Forms and quizzes

Forms and quizzes are drawn on this server by the engine the Swift app starter
uses. `Sources/BdForms` is that starter's `BdForms` without its SwiftUI views —
conditions, steps, calculations, validation, uploads and submission; quizzes,
their clock and grading. `FormPage` and `QuizPage` turn the engine's state into
HTML with the SDK's `bd-form__*` / `bd-quiz__*` classes (styled by
`bd-forms.css` and `Public/forms.css`), and htmx posts each change and button
back so the page updates in place. Without JavaScript they're plain form posts.

- **The engine is a generated copy.** Don't edit `Sources/BdForms` here: change
  the Swift starter's and run `pnpm gen:native-forms` in BD's `sdk/`.
- **The secret key stays here.** Uploads and submissions go through this server
  with `BD_API_KEY`; the browser never talks to BD.
- **Quiz runs live in this process.** A practice run (or the sample) is kept in
  memory for 3 hours and found again by the `bd_quiz_run` cookie, and a timed
  quiz submits itself at zero even if the tab was closed. Behind several
  instances, pin each visitor to one (sticky sessions). Invitations are read
  from BD on every page — BD keeps their answers and clock.
- **Invitation links.** Set the quiz's invite domain (in BD's quiz builder) to
  this site and BD's invite emails link to `/quiz-invite/<token>`. One that
  needs the invited account sends the visitor to `/my-account?next=…` and back.

## The shop and blog elements

The product page, the wishlist, the compare table, the save buttons, and a
post's likes and comments are small custom elements, the same ones every BD
starter ships, as plain ES modules in `Public/shop/`. There is no bundler and
no npm at runtime: the browser loads them as they are.

The controller reads the data and the template writes it inside the element as
JSON (`<script type="application/json">#unsafeHTML(dataJSON)</script>`, with
`<`, `>` and `&` escaped by `ElementData.json`); the element draws the page
from it. The store list, filters, cart, blog list and post body are plain Leaf
and work without JavaScript.

- **The POSTs are guarded without CSRF middleware**, which Vapor doesn't have.
  The add-to-cart, like and comment endpoints take JSON only (a form on another
  site can't send that without a CORS preflight, which this app never answers)
  and refuse a browser `Origin` that isn't this site (`PageJSON.refusal`). The
  cookies are SameSite=Lax too. Keep both checks on any new endpoint that acts
  with the visitor's cookies.
- **Wishlist and compare** are kept in the shopper's browser (`localStorage`),
  not at BD. The compare page puts its picks in the URL (`?ids=a,b`), so a
  comparison can be shared.
- **Post HTML** is rebuilt from an allowlist by `PostHtml.safe(_:)` before it
  reaches the page: unknown tags are dropped, links and images are limited to
  web, mail, phone and same-site addresses, and every attribute is escaped. It
  is a port of the SDK's `safePostHtml`, and `swift test` replays the
  TypeScript's answers (`Tests/AppTests/Fixtures/post-html-parity.json`) to
  keep it so. Don't print `content` with `#unsafeHTML` anywhere else.
- **Likes and comments** go out with the customer's `bd_session` cookie as
  `X-BD-Session-Token`. Signed out, the like button and comment box become
  links to `/my-account?next=…`, which comes back to the post.
- **A literal `#` in a template is a Leaf tag** when a letter follows it
  (`href="/#contact"`, even inside an HTML comment). Write `\#`.

## Five things that will bite you

**1. The webhook needs the RAW body.** `WebhookController` reads `req.body.string`, never `req.content.decode`. Decoding and re-encoding changes key order and whitespace, so the HMAC stops matching — and it fails looking exactly like a wrong secret. Vapor doesn't consume the body before your handler the way Phoenix's `Plug.Parsers` does, so no custom body reader is needed here; just don't round-trip it.

**2. The access gate answers reads with HTTP 200.** A lapsed plan returns `{"available": false, …}` in the *body*. `BdClient` checks the body *before* the status, deliberately — a status-first check renders an empty page and never notices.

**3. Money has two shapes.** Product, subscription and invoice totals are **integer cents**; cart `unitPrice`/`subtotal` arrive **decimal**. `Money.cents` and `Money.amount` are separate so you pick deliberately. Leaf can't call methods, so contexts format money in Swift — which is also what keeps the decision where the type system helps.

**4. Checkout returns `stripeUrl`, not `url`.**

**5. The cart visitor token is generated locally.** There is no endpoint that mints one — `cart/session` is a tokenized iframe embed, a different feature. It lives in an httpOnly cookie; the cart itself lives at BD, which is why this works behind a load balancer with no sticky sessions.

## What this starter does not do

- **A small customer portal only.** `/my-account` has the sign-in screen (password, emailed codes, Google / Apple / GitHub / Discord — WorkOS underneath, through BD's `auth/customer/*`) and, signed in, the customer's jobs. The rest of `PortalResource` is there to build on.
- **Few tests.** `swift test` covers the post sanitizer only. The client is exercised by running it; an `XCTVapor` suite would be the natural next step.

## Verification

`swift build` passes under **Swift 6 language mode**, and `Sources/BdForms` also builds on Linux (Swift 6.0). The forms and quizzes were driven in a browser against the bundled samples and a stand-in for BD's API: a form's steps, validation, uploads and submit; practice, timed and invitation quizzes, including sign-in and back. The store and blog were driven in a browser at desktop and phone widths against a stand-in for BD's shop and blog API: filters and sort, options and price, add to cart, the cart's lines, wishlist, compare, the order page, the post list's tag filter, a post's body, and a signed-in like and comment. `swift test` passes. The server has not been run against a live BD site from this machine.

<!-- [bd:donations] -->
## Donations

One-time and monthly gifts, paid to the org's own Stripe account. Your app
reads the giving page, posts the gift, and sends the donor to the Stripe URL it
gets back; BusinessDash records the gift, adds the donor as a contact, notifies
the org and emails the receipt. The full guide, with this starter's code in its
own tab: [Donations](https://businessdash.us/docs/developer/byFeature/donations).

`Bd/Donations.swift` adds two calls to the app's client
(`req.application.bd`, nil until configured):

```swift
app.post("give") { req async throws -> Response in
    guard let bd = req.application.bd else { throw Abort(.serviceUnavailable) }
    let origin = Environment.get("BD_SITE_ORIGIN") ?? "http://localhost:8080"
    let checkout = try await bd.startDonationCheckout(DonationCheckoutInput(
        amountCents: 2500,
        frequency: "monthly",
        coverFees: true,
        donor: DonationDonor(name: name, email: email),
        message: nil,
        successUrl: "\(origin)/give/thanks",
        cancelUrl: "\(origin)/give"
    ))
    return req.redirect(to: checkout.url, redirectType: .normal) // 303
}
// The page: try await bd.donationPage(); print taxStatement with #(…)
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

```swift
let page = try await client.dataModel.records(object: "projects")

// Follows the cursor for you, capped so a background refresh cannot hang.
let everything = try await client.dataModel.allRecords(object: "projects")
```

Record **writes** go through the CLI/seed file above rather than this client:
they are batched and keyed on row identity (`universalIdentifier`), which is
what makes a re-run update the row rather than create a second one.
