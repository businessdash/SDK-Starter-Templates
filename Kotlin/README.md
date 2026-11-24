# BD SDK — Kotlin starter

Three Gradle modules:

- **`:bd`** — the client, plus the native forms engine (`app.bd.forms`: conditions, formulas, validation, the submission payload). **Pure Kotlin/JVM**: no Android dependency, so it builds and tests with `./gradlew :bd:test` and no Android SDK, and stays reusable in a server or a Kotlin Multiplatform target later.
- **`:bd-forms`** — `BdForm`, the drop-in Compose renderer: any Live BusinessDash form, drawn with Material 3 controls. See [Native Forms (Jetpack Compose)](https://businessdash.us/docs/developer/byFeature/forms/native-compose).
- **`:app`** — the Android app (Compose) built on them: a Shop tab and a Form tab.

The split is not tidiness. It means the part most likely to be wrong — decoding, error mapping, the access gate — is testable without an emulator.

## The one rule that shapes everything here

**A mobile app ships its credential in the artifact.** `strings` on an APK finds anything in `BuildConfig`, so `BdClient` `require`s a **publishable `pk_…` token** and refuses anything else, including a secret `bd_…` key, at construction.

That turns out to be barely limiting. The publishable scope set covers the entire customer-facing surface:

> storefront · cart · checkout · blog · marketing content · chat · forms · **the whole customer portal** · sign-in · public custom-object reads · careers

So **this app needs no backend-for-frontend.** Only operator/admin writes need a secret key, and a customer app never makes those.

## Setup

The client verifies on its own, with no Android SDK:

```sh
./gradlew :bd:test
```

The app:

```sh
cp local.properties.example local.properties
# Fill bd.siteId and bd.publishableKey (and sdk.dir, which Android Studio writes)

./gradlew :app:installDebug
```

Configuration goes through `local.properties` → `BuildConfig`, which is gitignored by Android convention — the right home for a value that ends up in the binary. **With nothing filled in the app still launches**, showing a setup banner and empty states.

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


## Why Ktor, not Retrofit

Retrofit is the Android-default answer and it would work. Ktor is here because it keeps `:bd` free of any Android dependency and leaves the **Kotlin Multiplatform** door open — a KMP client could serve Android *and* iOS from one codebase.

Worth knowing that's a real fork in the road: BD also ships a native Swift starter with its own `BdKit`. If you go KMP later, one of those two becomes redundant. Decide that deliberately rather than ending up with both.

## What's in the client

```
bd/src/main/kotlin/app/bd/
  BdClient.kt   transport, bearer, the access gate, the pk_ require
  BdError.kt    sealed exception hierarchy + isUnavailable
  Models.kt       @Serializable models for every fixed-shape surface
  Resources.kt    storefront · cart · checkout · blog · reviews
                  subscriptions · forms
  ChatFeed.kt     the polling chat API as a cold Flow
  Bundle.kt       key-path reads for the two schema-driven surfaces
  Money.kt        cents vs decimal — read this before rendering money
  Donations.kt    giving page + checkout, and the cover-fees math
  Auth.kt         tenantSession(token): who a sign-in token belongs to
```

## Sign-in

The Account tab is the SDK's native sign-in (`:bd-sign-in`, `BdSignIn`): the
business's own screen, with its name, logo and brand colours from BD
(Settings → Branding) — or your `brand_logo` drawable — never BD's.
Customers make an account with an email and password, confirmed by a 6-digit
emailed code, reset a forgotten password the same way, or continue with
Google, Apple, GitHub or Discord. Every box is checked as the person leaves
it and again on submit.

It's WorkOS underneath, through BD — the same accounts as BD's hosted
sign-in, so a password and each provider reach one person. It runs on the
publishable key (`BdServerSignInBackend.businessDash`), with no server.
Provider sign-ins open in a Custom Tab and come back to
`{applicationId}://bd-oauth`, which `:bd-sign-in`'s manifest claims for you
(`BdSignInRedirectActivity`) — keep the `applicationId` lowercase, as URL
schemes are. `SessionStore` keeps the session token encrypted with an
Android Keystore key, and `tenantSession` checks it on launch. Signing out
is forgetting the token: BD's tokens are signed, not stored.

## Five things that will bite you

**1. The access gate answers reads with HTTP 200.** A lapsed plan returns `{"available": false, …}` in the *body*, not a 4xx — a client that only checks the status code decodes an empty screen and never notices. `decode` inspects the body **before** the status, and a test pins that order.

**2. Money has two shapes.** Product, subscription and invoice totals are **integer cents**. Cart `unitPrice`/`subtotal` arrive **decimal**. `Money.cents` and `Money.amount` are separate functions so you pick deliberately — mixing them is a 100× error in either direction. Every model property says which it is. `BigDecimal`, not `Double`, so formatting doesn't round-trip through binary floating point.

**3. Checkout returns `stripeUrl`, not `url`.** Open it in a browser; no card data touches this process, which keeps the app out of PCI scope.

**4. The cart visitor token is generated locally and must be persisted.** There is no endpoint that mints one — `cart/session` is a tokenized iframe embed, a different feature. `BdApp.visitorToken` keeps it in `SharedPreferences`, which is right because it's an opaque id, **not** a secret. The sign-in's session token is a secret, so `SessionStore` encrypts it with a Keystore key.

**5. `ignoreUnknownKeys = true` is load-bearing.** The platform returns a superset that grows release to release. Without it, one new column breaks the app on somebody else's deploy.

## Quizzes

A BD quiz is a form with an answer key, and `BdQuiz` (in `:bd-forms`) runs one the way BD's hosted quiz page does. It covers:

- **Questions**: lettered multiple choice, plus "I don't know" when the quiz allows it. Open answers go in a text field or text area. An open answer can match any accepted wording, or wait for BD's AI grader.
- **Feedback**: a verdict and rationale after each answer, or everything at the end.
- **Timing**: elapsed time, or a countdown that submits on its own when it runs out.
- **Results**: a score with per-question review, a thank-you when the org hides scores, or "sign in to see your results".

```kotlin
val quizzes = BdQuizzes.packageApi(BuildConfig.BD_PK, BuildConfig.BD_HOST, sessionToken = session?.sessionToken)

BdQuiz(BdQuizSource.Invitation(token), quizzes, onSignIn = { showSignIn = true })
BdQuiz(BdQuizSource.Practice("food-safety", questionLimit = 10), quizzes)
```

The Quiz tab shows a bundled sample (`app/src/main/assets/bd-demo-quiz.json`), graded on the device, until you set `bd.quiz` in `local.properties` to a practice quiz's slug.

- **Invitations**: an invitation that must be taken by the invited account shows "Sign in to begin" and calls `onSignIn`. Pass a `BdQuizzes` with the new session (`withSession`) and the quiz reloads. The taker sees the same question and choice order on every visit, because the invitation seeds the shuffle. BD grades every answer, and the app never receives the answer key.
- **Practice**: BD grades it and records nothing, open answers included. The clock pauses while a verdict is on screen, and each retake gets a new order.
- **Local quizzes**: give the fields their answer keys and grade on the device with `BdQuiz(BdQuizController(BdQuizOptions(fields, feedbackMode = BdQuizFeedbackMode.IMMEDIATE), scope))`.
- **Order**: `shuffleChoices` and `shuffleQuestions` come from the quiz's settings in BD, and a question marked "keep these choices in order" (for "All of the above") is never shuffled.
- **Reword or localize** with `words =` (`BdQuizWords`). Looks follow `style =` (`BdFormStyle`), and the app's Material theme.
- **Your own UI**: collect `BdQuizController.screen`, which holds exactly what to show, texts included, and call `choose`, `setAnswer` and `perform`.
- **Rotation and leaving**: `BdQuiz` keeps the quiz in a ViewModel, and a submit runs in the quiz's own scope, so it finishes even if the screen goes away.

The quiz engine is a port of the JS SDK's `forms-core/quiz.ts`. `./gradlew :bd:test` replays its fixtures (`bd/src/test/resources/quiz-parity.json`): every screen and state of nine scripted quizzes, the seeded shuffle, scoring, and the page around the quiz.

## Chat is polling, and that's the API

There is no SSE or WebSocket anywhere in the Package API. The platform's guidance is `chatbot/messages` every 3–5 seconds while a widget is open. `ChatFeed` wraps that in a **cold** `Flow`, so the poll starts when someone collects and stops when the collecting coroutine is cancelled — `delay` is cancellable, so leaving a screen halts the network work at the next suspension point. Nothing to unregister, nothing to leak.

The loop also de-duplicates on message id: `since` is only as good as what the server returns, and with no cursor **and** no timestamp it can't advance, replaying rows a naive collector would render twice.

## What this starter does not do

- **No customer portal UI.** Sign-in is there; the portal's jobs, quotes and invoices (`customer_portal:self`) are wired in the client but have no Compose screen yet.
- **Three tabs.** Shop + add-to-cart, a form, and the account. Cart, blog and chat are wired in the client and the ViewModel but have no Compose screens yet.

## ⚠️ Verification status

Built with Gradle 9.8, AGP 8.7, Kotlin 2.0 and JDK 21 (toolchain 17). There is no Gradle wrapper in the repo; a system `gradle` works, or let Android Studio add one.

- `gradle :bd:test` passes, including the forms parity suite that replays the TypeScript forms-core fixtures. It needs no Android SDK.
- `gradle :bd-forms:testDebugUnitTest` and `gradle :bd-sign-in:testDebugUnitTest` pass.
- `gradle :app:assembleDebug` builds, and the Form tab was walked through on an API 36 emulator: steps, conditions, calculations, validation, pickers, rich text and submit.
- The Shop tab and `BdPackageFormsBackend` against a live site have not been run from this app; they need a real site id and publishable key.

<!-- [bd:donations] -->
## Donations

One-time and monthly gifts, paid to the org's own Stripe account. Your app
reads the giving page, posts the gift, and sends the donor to the Stripe URL it
gets back; BusinessDash records the gift, adds the donor as a contact, notifies
the org and emails the receipt. The full guide, with this starter's code in its
own tab: [Donations](https://businessdash.us/docs/developer/byFeature/donations).

`bd/…/Donations.kt`, on the publishable token you already use:

```kotlin
val page = client.donationPage()
if (page.isAcceptingGifts) {
    val checkout = client.startDonationCheckout(
        DonationCheckoutInput(
            amountCents = 2500,
            frequency = "monthly",
            donor = DonationDonor(name, email),
            coverFees = page.offerCoverFees,
        ),
    )
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(checkout.url)))
}
// Cover-fees label: page.coverFeeCents(2500)
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
rendering, so a field added there appears here without a deploy. `BdForm`
draws them natively:

```kotlin
BdForm(form = "contact", publishableKey = BuildConfig.BD_PK)
```

The Form tab shows a bundled sample (`app/src/main/assets/bd-demo-form.json`)
until you set `bd.form` in `local.properties` to a Live form's slug. The sample
submits nowhere; it logs the payload a live form would send:
`adb logcat -s BdStarter`.

```sh
npx tsx node_modules/@businessdash/sdk/dist/cli.js sync-schema
```

### 5. CRUD against the custom database

```kotlin
val dataModel = client.dataModel(siteId)

// Read one page, or follow the cursor with allRecords().
val page = dataModel.records("projects")
val everything = dataModel.allRecords("projects")

// Schema changes: compute the plan, look at it, then push to the DRAFT slot.
val plan = dataModel.plan(schemaJson)
dataModel.pushDraftSchema(schemaJson)
```

`allRecords` caps at 50 pages — an unbounded loop against a growing collection
is a way to hang a phone on a background refresh.

Record **writes** go through the CLI/seed file above rather than this client:
they are batched and keyed on row identity, which is what makes a re-run update
rather than duplicate.
