# BD SDK — Swift starter

Three products in one package:

- **`BusinessDashKit`** — the data layer. No dependencies; the Package API is plain REST with a bearer key, so `URLSession` + `Codable` covers all of it.
- **`BdForms`** — BD forms rendered natively in SwiftUI, with the form's conditions, steps, calculations, validation, uploads and submission. No dependencies, not even `BusinessDashKit`. See [Forms](#forms).
- **`BdStarterApp`** — SwiftUI screens built on both: the shop (filters, product pages, wishlist, compare), cart and checkout, the blog with likes and comments, the business's reviews, Front Desk chat, forms, and the customer portal.

## The one rule that shapes everything here

**A native app ships its credential inside the binary.** `strings` on an `.ipa` finds anything you bundle, so `BdClient` accepts a **publishable `pk_…` token only** and traps at `init` if you hand it anything else, such as a secret `bd_…` key.

That turns out to be barely limiting. The publishable scope set covers the entire customer-facing surface:

> storefront · cart · checkout · blog · marketing content · chat · forms · **the whole customer portal** · sign-in · public custom-object reads · careers

So **this app needs no backend-for-frontend.** Only operator/admin writes need a secret key, and a customer app never makes those. If you do need one, put it behind a server you control and point the app at that.

## Setup

The package builds on its own:

```sh
swift build
swift test
```

For an actual app: **File ▸ Add Package Dependencies… ▸ Add Local…** and select this directory, then add `BusinessDashKit` and `BdStarterApp` to your target (or just `BdForms`, if forms are all you need).

Configuration lives in Info.plist — there is no `.env` in an app bundle. `BdStarter.xcconfig` has the three keys and how to wire them:

| Info.plist key | What |
| --- | --- |
| `BDHost` | defaults to `https://businessdash.us` |
| `BDPublishableKey` | `pk_…` — never a secret `bd_…` key |
| `BDSiteID` | the site UUID |
| `BDSiteURL` | optional: your website, e.g. `https://example.com`. With it, products and posts get a Share button linking to `/store/<id>` and `/blog/<slug>` there. |

**With no keys at all the app still runs** — screens render their empty states and a setup notice appears. A starter you can't launch before signing up isn't a starter.

Your `App` body:

```swift
@main
struct MyApp: App {
    @State private var bd = BdEnvironment()

    var body: some Scene {
        WindowGroup {
            BdRootView()
                .environment(bd)
                .task { await bd.bootstrap() }
        }
    }
}
```

Sign-in is native (`BdSignIn`): the Account tab shows the business's own
sign-in screen, with its name, logo and brand colours from BD (Settings →
Branding) — or your "BrandLogo" image from the asset catalog. Customers make
an account with an email and password, confirmed by a 6-digit emailed code,
reset a forgotten password the same way, or continue with Apple (Apple's own
sheet), Google, GitHub or Discord (the system's sign-in sheet). Every box is
checked as the person leaves it and again on submit.

It's WorkOS underneath, through BD — the same accounts as BD's hosted
sign-in, so a password and each provider reach one person. It runs on the
publishable key: no server to run, and the provider sign-ins come back to
the app's bundle id as a URL scheme, with no Info.plist entry needed.

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


## What's in the kit

```
Sources/BusinessDashKit/
  BdClient.swift        transport, bearer, access gate, the pk_ guard
  BdError.swift         typed failures + `isUnavailable`
  BdConfiguration.swift Info.plist reader
  BdAuth.swift          hosted sign-in via a custom URL scheme
  BdSessionStore.swift  actor: session token → Keychain, visitor id → UserDefaults
  ChatFeed.swift          the polling chat API as an AsyncStream
  Models.swift            Codable structs for every typed surface
  JSONValue.swift         for the two genuinely schema-driven surfaces
  Money.swift             cents vs decimal — read this before rendering money
  Donations.swift         giving page + checkout, and the cover-fees math
  Resources.swift         storefront · cart · checkout · blog · forms · portal
                          reviews · subscriptions · marketing · parallel pages
                          · data model
  Shop.swift              the product page's rules: photos per option, size
                          order, "from" prices, the cart line's options
  PostHtml.swift          the post HTML allowlist, reading time and dates —
                          the same rules as the web starters
  PostBlocks.swift        a post's safe HTML as native blocks to draw
```

## The shop, the blog and reviews

The same experience as the web starters, drawn natively.

- **Store** — search, category chips with counts, a price and rating filter sheet, sorting, and a grid of cards with badges, stars, sale and "from" prices. ♡ saves to a wishlist and ⇄ picks up to four products for the compare table. All three lists, recently viewed too, live on the device (`SavedLists.swift`), like the web starters keep them in the browser.
- **Product page** — photos for the chosen option, option and size buttons (sold-out ones struck through), the price for what's chosen, quantity, add to cart, add-ons, details and specifications, reviews with "Show more", related products, recently viewed, and Share when `BDSiteURL` is set. "Ask us" opens the Chat tab.
- **Cart and checkout** — the Cart tab carries a count badge. Checkout opens Stripe and comes back to `bdstarter://checkout/success?session_id=…`, which opens the order screen. **Register the `bdstarter` URL scheme** on your app target (Info ▸ URL Types) for that return to land.
- **Blog** — category chips, tags, pinned posts first, older posts on demand. A post's HTML goes through the allowlist and is drawn as native text, lists, quotes, code, images and tables (`PostBlocks`), so nothing in it runs. Liking and commenting need a signed-in customer; signed out, the buttons lead to the Account tab. Comments are up to 5,000 characters, and a held one says it shows once approved.
- **Business reviews** — the business's own reviews from Google, Yelp, Housecall Pro and the dashboard. The store opens with the rating ("★ 4.6 · 128 reviews"), which leads to the reviews screen: the average with a bar per star, a platform filter, each review with its photos, a Verified mark and a link to it on Google or Yelp, and more on demand. A signed-in customer can write one; it waits for the business to approve it. The average and the stars breakdown ride the marketing bundle (`client.reviews.summary()`); the reviews page in with `client.reviews.list(limit:offset:source:)`.

### Laying out the screens your way

Every screen is laid out from parts, and the parts are public, so your app
can rearrange, restyle, drop or replace any of them, or lay out a screen of
its own (`Tests/BdStarterAppTests/PartsTests.swift` builds a product page, a
store, a post and a reviews screen that way). Each part takes plain values
and callbacks, not the screen's model:

- **Product page** (`ProductParts.swift`): `ProductGallery`, `ProductTitle`,
  `ProductPriceLabel`, `VariantPicker`, `OptionPicker`, `ChoiceButton`,
  `StockNote`, `QuantityStepper`, `AddToCartButton`, `CartNotice`,
  `ProductPolicies`, `ProductDetails`, `ProductAddons` / `AddonRow`,
  `ProductReviews` / `ProductReviewRow`.
- **Store and cart** (`StoreParts.swift`, `ShopParts.swift`):
  `CategoryChips`, `StoreResultsBar`, `SortMenu`, `StoreFiltersSheet`,
  `ProductCardView`, `SaveButtons`, `CompareBar`, `ProductRail`, `CartLine`,
  `CartSummary`; and the small pieces `StarRating`, `Badge`, `RemoteImage`,
  `CoverImage`, `FlowLayout`.
- **Blog** (`BlogParts.swift`): `BlogFilters`, `PostCard`, `PostMeta`,
  `PostBodyView`, `MembersOnly`, `PostCTA`, `PostTags`, `LikeButton`,
  `PostComments` / `CommentRow`.
- **Reviews** (`ReviewsView.swift`): `ReviewSummaryCard`, `ReviewStrip`,
  `WriteReviewButton`, `ReviewSourceFilter`, `ReviewRow`, `ReviewWriter`.

The screens themselves are public too (`StorefrontView`,
`ProductDetailView(productID:)`, `CartView`, `WishlistView`, `CompareView`,
`BlogView`, `PostView(slug:)`, `ReviewsView`), for an app with tabs of its
own. The rules the parts follow (which photos show for an option, what "from"
means, what can be bought) are `ProductView`'s, in BusinessDashKit:

```swift
let price = view.price(variantID: variantID, chosen: chosen)
ProductGallery(urls: view.gallery(for: variantID))
ProductPriceLabel(price: price, quantity: quantity)
VariantPicker(variants: view.variants, selected: variantID, showPrices: true) { variantID = $0 }
ForEach(view.optionGroups(for: variantID)) { group in
    OptionPicker(group: group, chosen: chosen[group.id]) { chosen[group.id] = $0.id }
}
AddToCartButton(price: price, isAdding: false) { /* cart.add(…) */ }
```

## Five things that will bite you

**1. The access gate answers reads with HTTP 200.** A lapsed plan returns `{"available": false, …}` in the *body*, not a 4xx — a client that only checks `statusCode` decodes an empty screen and never notices. `BdClient` inspects the body *before* the status, deliberately, and there's a test pinning that order.

**2. Money has two shapes.** Product, subscription, invoice and quote totals are **integer cents**. Cart `unitPrice`/`subtotal` arrive **decimal**. `Money.cents(_:)` and `Money.amount(_:)` are separate functions so you pick deliberately — mixing them is a 100× error in either direction. Every model property says which it is.

**3. Two different session headers.** `auth/me` takes a lowercase `x-bd-session`. Cart and portal routes take `X-BD-Session-Token`. Not interchangeable, and the wrong one reads as "not signed in" rather than as an error.

**4. Checkout returns `stripeUrl`, not `url`.** Open it in a browser; no card data touches this process, which is what keeps the app out of PCI scope.

**5. The cart visitor token is generated locally.** There is no endpoint that mints one — `cart/session` is a different feature (a tokenized iframe embed). `BdSessionStore` keeps it in `UserDefaults`, because it's an opaque id, not a secret. The *session* token goes in the Keychain, because it is one.

## Forms

`BdForm` renders a Live BD form with native controls: every element type, the form's conditions and steps, calculated fields, validation with the server's rules, file and photo uploads on submit, and the success screen. Styling follows the OS and your app's tint.

```swift
import BdForms

BdForm(form: "contact", publishableKey: "pk_live_…") { result in
    print("Submitted", result.submissionId ?? "")
}
.bdFormStyle(BdFormStyle(tint: .indigo))
```

In this starter, `BdFormView(slug:)` does the same with the keys from `BdEnvironment`.

- **Style** with `.bdFormStyle(_:)`: `.grouped` (a `Form`, the default) or `.plain` layout, tint, required marker, submit button (`.prominent`, `.standard`, `.glass`).
- **Reword or localize** with `.bdFormStrings(_:)`, including every validation message.
- **Draw one element yourself** with `.bdFieldRenderer(for: "star_rating") { ctx in … }`, or one field with `forField:`. Label, help, errors and validation stay.
- **Own the state** with `BdFormController`: read and prefill values, drive steps, submit from your own button. `BdForm(controller:)` renders it.
- **Cards**: set `controller.paymentHandler` to present Stripe's sheet with the intent BD creates; without it, a card element says card entry isn't set up.

The rules are a port of the JS SDK's `forms-core`, and `swift test` replays the TypeScript implementation's own outputs (`Tests/BdFormsTests/Fixtures/forms-parity.json`, made by `pnpm gen:native-forms` in `sdk/`) so the two can't drift silently.

Full guide: [Native Forms (SwiftUI)](https://businessdash.us/docs/developer/byFeature/forms/native-swift).

## Quizzes

A BD quiz is a form with an answer key, and `BdQuiz` (also in `BdForms`) takes one the way BD's hosted quiz page does. It covers:

- **Questions**: lettered multiple choice, plus "I don't know" when the quiz allows it. Open answers go in a text box or text area. An open answer can match any accepted wording, or wait for BD's AI grader.
- **Feedback**: a verdict and rationale after each answer, or everything at the end.
- **Timing**: elapsed time, or a countdown that submits on its own when it runs out.
- **Results**: a score with per-question review, a thank-you when the org hides scores, or "sign in to see your results".

```swift
import BdForms

let quizzes = BdQuizzes(host: host, publishableKey: "pk_live_…", sessionToken: signedIn?.sessionToken)

BdQuiz(.invitation(token: token), quizzes: quizzes, onSignIn: { showSignIn = true })
BdQuiz(.practice(slug: "food-safety", questionLimit: 10), quizzes: quizzes)
```

In this starter, `BdQuizView(invitation:)` and `BdQuizView(practice:)` do the same with the keys and session from `BdEnvironment`.

- **Invitations**: an invitation that must be taken by the invited account shows "Sign in to begin" and calls `onSignIn`. Give `BdQuizzes` the new session and the quiz reloads. The taker sees the same question and choice order on every visit, because the invitation seeds the shuffle. BD grades every answer, and the app never receives the answer key.
- **Practice**: BD grades it and records nothing, open answers included. The clock pauses while a verdict is on screen, and each retake gets a new order.
- **Local quizzes**: give the fields their answer keys and grade on the device with `BdQuiz(controller: BdQuizController(options: BdQuizOptions(fields: fields, feedbackMode: .immediate)))`.
- **Order**: `shuffleChoices` and `shuffleQuestions` come from the quiz's settings in BD, and a question marked "keep these choices in order" (for "All of the above") is never shuffled.
- **Reword or localize** with `words:` (`BdQuizWords`). Looks follow `.bdFormStyle(_:)`.
- **Your own UI**: observe `BdQuizController.screen`, which holds exactly what to show, texts included, and call `choose`, `setAnswer` and `perform(_:)`.

The quiz engine is a port of the JS SDK's `forms-core/quiz.ts`. `swift test` replays its fixtures (`Tests/BdFormsTests/Fixtures/quiz-parity.json`): every screen and state of nine scripted quizzes, the seeded shuffle, scoring, and the page around the quiz.

## Chat is polling, and that's the API

There is no SSE or WebSocket anywhere in the Package API. The platform's guidance is `chatbot/messages` every 3–5 seconds while a widget is open. `ChatFeed` wraps that loop in an `AsyncStream` so a view can `for await` instead of owning a timer:

```swift
for await batch in feed.messages() {
    messages.append(contentsOf: batch)
}
```

Leaving the loop — or SwiftUI cancelling the `.task` on disappear — tears the poller down through the stream's `onTermination`. The producer also filters on message id, so a response without a usable cursor can't replay rows you already have.

## What this starter does not do

- **Sign-in uses `openURL`, not `ASWebAuthenticationSession`.** A production app should use the latter so the sheet dismisses itself and the callback is delivered directly. `openURL` keeps the starter free of AuthenticationServices presentation-anchor plumbing.
- **One chat session per install.** A real app would mint a session per topic and persist the id next to the visitor token.
- **No shipping / address / coupons-admin surfaces.** The endpoints exist; the kit covers what these screens use.

## Verification

`swift build` and `swift test` both pass under **Swift 6 language mode with strict concurrency**, and the suite covers the parts most likely to break silently: the 200-with-`available:false` gate, `stripeUrl`, the two session headers, nil-query dropping, relation shapes, and cents-vs-decimal. The shop, blog and reviews tests pin the post HTML allowlist to the web starters' fixture case for case, the product page's option and price rules, the wire shapes (category counts, cents filters, cart line names, the reviews page and summary), and what a written review sends. `BdStarterAppTests` lays out screens from the public parts without `@testable`, so a part that stops being public fails the build. `BdForms` adds the forms-core parity fixtures and the controller's behavior: conditions, repeaters, calculations, uploads, server issue mapping and every submit outcome.

<!-- [bd:donations] -->
## Donations

One-time and monthly gifts, paid to the org's own Stripe account. Your app
reads the giving page, posts the gift, and sends the donor to the Stripe URL it
gets back; BusinessDash records the gift, adds the donor as a contact, notifies
the org and emails the receipt. The full guide, with this starter's code in its
own tab: [Donations](https://businessdash.us/docs/developer/byFeature/donations).

`BusinessDashKit/Donations.swift`, on the publishable token you already use:

```swift
let page = try await client.donations.page()
guard page.isAcceptingGifts else { return }
let checkout = try await client.donations.startCheckout(
    DonationCheckoutInput(
        amountCents: 2500,
        monthly: true,
        coverFees: page.offerCoverFees,
        donor: DonationDonor(name: name, email: email)
    )
)
if let url = checkout.checkoutURL { openURL(url) }   // @Environment(\.openURL)
// Cover-fees label: page.coverFeeCents(for: 2500)
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
- **Leave the return URLs out.** The donor lands on the hosted thank-you page
  and closes the browser back into the app.
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
