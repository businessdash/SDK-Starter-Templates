# BD SDK — Flutter starter

Three packages:

- **`packages/businessdash_sdk`** — the client, and the forms engine (`package:businessdash_sdk/forms.dart`). **Pure Dart**: it imports nothing from Flutter, so it analyzes, tests and runs anywhere Dart does — a server, a CLI, a test runner with no Flutter toolchain installed. Its only dependency is `http`.
- **`packages/businessdash_forms`** — `BdForm`, the widget that renders a Live BusinessDash form natively: Material controls on Android, Cupertino on iOS. See [Native forms](#native-forms).
- **the root package** — the Flutter app built on them: shop, product detail, cart, Front Desk chat, and a Form tab.

The split is not tidiness. It means the part most likely to be wrong — decoding, error mapping, the access gate — is testable without an emulator, and stays reusable if you later want the same client in a Dart backend.

## The one rule that shapes everything here

**A mobile app ships its credential inside the artifact.** `strings` on an APK or IPA finds anything you bundle, so `BdClient` takes a **publishable `pk_…` token** only and throws on anything else, including a secret `bd_…` key, in release builds too.

That turns out to be barely limiting. The publishable scope set covers the entire customer-facing surface:

> storefront · cart · checkout · blog · marketing content · chat · forms · **the whole customer portal** · sign-in · public custom-object reads · careers

So **this app needs no backend-for-frontend.** Only operator/admin writes need a secret key, and a customer app never makes those.

## Setup

The client verifies on its own, with no Flutter installed:

```sh
cd packages/businessdash_sdk
dart pub get
dart analyze
dart test
```

The app:

```sh
flutter create --platforms=ios,android .   # once: the starter ships without platform folders
flutter pub get
flutter run \
  --dart-define=BD_SITE_ID=… \
  --dart-define=BD_PK=pk_… \
  --dart-define=BD_FORM=contact            # optional: a Live form for the Form tab
```

Configuration comes from `--dart-define`, not a `.env` file. There is no env in an APK, and dart-defines are compiled in — which is exactly what an app credential is. **With no defines at all the app still launches**, showing a setup banner and empty states.

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


## What's in the client

```
packages/businessdash_sdk/lib/src/
  client.dart      transport, bearer, the access gate, the pk_ assert
  errors.dart      sealed exception hierarchy + isUnavailable
  models.dart      typed models for every fixed-shape surface
  resources.dart   storefront · cart · checkout · blog · reviews
                   subscriptions · marketing · forms · data model
  chat.dart        the polling chat API as a Stream
  bundle.dart      key-path reads for the two schema-driven surfaces
  money.dart       cents vs decimal — read this before rendering money
  donations.dart   giving page + checkout, and the cover-fees math
  forms/           the native forms engine: conditions, formulas, validation,
                   the submission payload, and BdFormController
```

## Five things that will bite you

**1. The access gate answers reads with HTTP 200.** A lapsed plan returns `{"available": false, …}` in the *body*, not a 4xx — a client that only checks `statusCode` parses an empty screen and never notices. `_decode` inspects the body **before** the status, and a test pins that order.

**2. Money has two shapes.** Product, subscription and invoice totals are **integer cents**. Cart `unitPrice`/`subtotal` arrive **decimal**. `Money.cents` and `Money.amount` are separate functions so you pick deliberately — mixing them is a 100× error in either direction. Every model field says which it is.

**3. Checkout returns `stripeUrl`, not `url`.** Open it in a browser; no card data touches this process, which keeps the app out of PCI scope.

**4. The cart visitor token is generated locally.** There is no endpoint that mints one — `cart/session` is a tokenized iframe embed, a different feature. It's an opaque id, not a secret, so ordinary storage is right for it. `main.dart` generates a throwaway per launch; **persist it** (`shared_preferences`) so a cart survives a relaunch.

**5. Nullable everywhere is deliberate.** The platform returns a superset that grows release to release. An app that hard-fails parsing because a new nullable column appeared is an app that breaks on somebody else's deploy.

## Chat is polling, and that's the API

There is no SSE or WebSocket anywhere in the Package API. The platform's guidance is `chatbot/messages` every 3–5 seconds while a widget is open. `ChatFeed` wraps that loop in a `Stream` so a widget can use `StreamBuilder` instead of owning a `Timer`:

```dart
StreamBuilder<List<ChatMessage>>(stream: feed.messages(), builder: …)
```

Cancelling the subscription stops the network work through `onCancel`. The loop also de-duplicates on message id: `since` is only as good as what the server returns, and with no cursor **and** no timestamp it can't advance, replaying rows a naive listener would render twice.

## Native forms

`<bd-form>` is a DOM web component, so a Flutter app needs its own renderer. `packages/businessdash_forms` is that renderer: `BdForm` draws every form element with native widgets and runs the form's conditions, steps, calculations and validation on the device, then uploads and submits. No web view.

```dart
BdForm(
  form: 'contact',
  publishableKey: const String.fromEnvironment('BD_PK'),
  pickFiles: pickFiles,   // lib/forms/form_hooks.dart: file_selector + image_picker
  openLink: openLink,     // url_launcher
)
```

The **Form tab** (`lib/ui/form_page.dart`) shows the Live form named by `--dart-define=BD_FORM`. Without it, it shows a bundled sample with every kind of field (`lib/forms/demo_form.dart`) that submits nowhere and prints the payload to the `flutter run` console.

`BdForm` takes no plugins itself; file picking, links and the booking time zone are callbacks, and `lib/forms/form_hooks.dart` wires them to Flutter's own `file_selector`, `image_picker` and `url_launcher`. For iOS, add `NSPhotoLibraryUsageDescription` to `ios/Runner/Info.plist`, as `image_picker` asks.

Styling, localization, custom renderers, the headless `BdFormController` and card collection are covered in [Native Forms (Flutter)](https://businessdash.us/docs/developer/byFeature/forms/native-flutter).

## Quizzes

A BD quiz is a form with an answer key, and `BdQuiz` (in `businessdash_forms`) runs one the way BD's hosted quiz page does, drawn like `BdForm` (Material on Android, Cupertino on iOS). It covers:

- **Questions**: lettered multiple choice, plus "I don't know" when the quiz allows it. Open answers go in a text field or text area. An open answer can match any accepted wording, or wait for BD's AI grader.
- **Feedback**: a verdict and rationale after each answer, or everything at the end.
- **Timing**: elapsed time, or a countdown that submits on its own when it runs out.
- **Results**: a score with per-question review, a thank-you when the org hides scores, or "sign in to see your results".

```dart
final quizzes = BdQuizzes.packageApi(publishableKey: const String.fromEnvironment('BD_PK'), sessionToken: session?.sessionToken);

BdQuiz(source: BdQuizSource.invitation(token), quizzes: quizzes, onSignIn: showSignIn)
BdQuiz(source: BdQuizSource.practice('food-safety', questionLimit: 10), quizzes: quizzes)
```

The **Quiz tab** (`lib/ui/quiz_page.dart`) shows a bundled sample (`lib/forms/demo_quiz.dart`), graded on the device, until you run with `--dart-define=BD_QUIZ=<slug>` for one of your practice quizzes.

- **Invitations**: an invitation that must be taken by the invited account shows "Sign in to continue" and calls `onSignIn`. Pass a `BdQuizzes` with the new session (`withSession`) and the quiz reloads. The taker sees the same question and choice order on every visit, because the invitation seeds the shuffle. BD grades every answer, and the app never receives the answer key.
- **Practice**: BD grades it and records nothing, open answers included. The clock pauses while a verdict is on screen, and each retake gets a new order.
- **Local quizzes**: give the fields their answer keys and grade on the device with `BdQuiz.controller(BdQuizController(BdQuizOptions(fields: fields, feedbackMode: BdQuizFeedbackMode.immediate)))`. The controller is yours to dispose.
- **Order**: `shuffleChoices` and `shuffleQuestions` come from the quiz's settings in BD, and a question marked "keep these choices in order" (for "All of the above") is never shuffled.
- **Reword or localize** with `words:` (`BdQuizWords`). Looks follow `style:` (`BdFormStyle`) and the app's theme.
- **Your own UI**: listen to `BdQuizController` and read its `screen`, which holds exactly what to show, texts included; call `choose`, `setAnswer` and `perform`.

The quiz engine lives in `businessdash_sdk` (pure Dart) and is a port of the JS SDK's `forms-core/quiz.ts`.

## Sign-in

The **Account tab** (`lib/ui/account_page.dart`) is the business's own sign-in screen, `BdSignIn` from `businessdash_forms` — the same screen as `<BdSignIn>` on the web and the Swift / Kotlin starters' native ones, drawn like `BdForm` (Material on Android, Cupertino on iOS): the business's name, logo and brand colours from BD (primary on the button, secondary on links), each box checked when you leave it and all of them when you press the button, password sign-in, create account and reset with an emailed code. Every step is BD's `auth/customer/*` routes with the publishable key; WorkOS is underneath.

"Continue with Google / Apple / GitHub / Discord" (whichever the business has switched on) opens WorkOS's page for the provider with `flutter_web_auth_2` — ASWebAuthenticationSession on iOS, a Custom Tab on Android — and comes back to `bdstarter://bd-oauth` with a one-time code only this sign-in's PKCE verifier can redeem. iOS needs no setup. On Android, add the plugin's callback activity to `android/app/src/main/AndroidManifest.xml`, inside `<application>`:

```xml
<activity
  android:name="com.linusu.flutter_web_auth_2.CallbackActivity"
  android:exported="true"
  android:taskAffinity="">
  <intent-filter android:label="flutter_web_auth_2">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="bdstarter" />
  </intent-filter>
</activity>
```

## What this starter does not do
- **The session isn't persisted.** Keep `session.sessionToken` in `flutter_secure_storage` so a sign-in survives a relaunch; the customer-portal screens are yours to build on it.
- **The visitor token isn't persisted.** See above — one line with `shared_preferences`.
- **No widget tests for the shop, cart and chat screens.** The forms package has them; the app screens don't.

## Verification

`dart test` passes in `packages/businessdash_sdk`. The client tests cover the parts most likely to break silently: the 200-with-`available:false` gate, a real 4xx, `stripeUrl`, nil-query dropping, the bearer + site path, the cart header, both relation shapes, cents-vs-decimal, and empty-string-as-missing. The forms tests replay the fixtures `pnpm gen:native-forms` generates from the TypeScript forms engine, so the Dart port agrees with the web, Swift and Kotlin ones. The quiz tests replay `test/fixtures/quiz-parity.json` the same way: every screen and state of nine scripted quizzes, the seeded shuffle, scoring, and the page around the quiz.

`flutter test` passes in `packages/businessdash_forms`: rendering, validation, submit, conditions, steps, Cupertino and Material controls, sheets, repeaters, collections, retry, the leave guard, custom renderers, and hosting in a `CupertinoApp`. The quiz widget tests take a quiz through choices, typed answers, verdicts, a countdown that runs out, results and a retake, and load practice quizzes and invitations from a mocked BD.

The app builds and runs on the iOS simulator with Flutter 3.50 (from `flutter create --platforms=ios .`).

<!-- [bd:donations] -->
## Donations

One-time and monthly gifts, paid to the org's own Stripe account. Your app
reads the giving page, posts the gift, and sends the donor to the Stripe URL it
gets back; BusinessDash records the gift, adds the donor as a contact, notifies
the org and emails the receipt. The full guide, with this starter's code in its
own tab: [Donations](https://businessdash.us/docs/developer/byFeature/donations).

`businessdash_sdk/lib/src/donations.dart`, on the publishable token you already
use. Opening the URL needs `url_launcher` in the app's `pubspec.yaml`:

```dart
final page = await client.donationPage();
if (page.isAcceptingGifts) {
  final checkout = await client.startDonationCheckout(
    amountCents: 2500,
    donorName: name,
    donorEmail: email,
    monthly: true,
    coverFees: page.offerCoverFees,
  );
  await launchUrl(Uri.parse(checkout.url), mode: LaunchMode.externalApplication);
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
rendering, so a field added there appears here without a deploy.

```sh
npx tsx node_modules/@businessdash/sdk/dist/cli.js sync-schema
```

### 5. CRUD against the custom database

```dart
final page = await client.get(
  'sites/$siteId/data-model/records',
  query: {'object': 'projects'},
);
```

Record **writes** go through the CLI/seed file above rather than this client:
they are batched and keyed on row identity (`universalIdentifier`), which is
what makes a re-run update the row rather than create a second one.
