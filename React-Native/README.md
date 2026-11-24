# BD SDK — React Native (Expo) starter

The one mobile starter that **reuses `@businessdash/sdk` directly**. Laravel, Phoenix, Swift, Flutter, Kotlin and Vapor all hand-write a client because the SDK is TypeScript; React Native *is* JavaScript, so it imports the real thing.

## Two things make that work

### 1. Import from `/native`, never the root

The root export re-exports the auth handler, which calls `Buffer.from(state, 'base64url')`. `Buffer` is a Node global React Native doesn't provide and Metro doesn't polyfill.

The call sits inside a function, so the root import **appears** to work — right up until a sign-in callback is decoded and it throws `ReferenceError: Buffer is not defined` in production, on a device, in front of a customer.

`@businessdash/sdk/native` is the same data layer with the server-only surface removed: no auth handler, no same-origin proxy, no `node:crypto` revalidation verifier. None of those mean anything in an app anyway — they're things a *server* mounts.

### 2. Metro needs package exports on

Subpath exports don't resolve without it, and the failure reads like a missing dependency rather than a resolver setting. `metro.config.js` sets it explicitly:

```js
config.resolver.unstable_enablePackageExports = true
```

Recent Expo SDKs default this to true. It's set anyway — "the default changed" isn't something a starter should depend on, and setting it when it's already true costs nothing.

## The token rule

`EXPO_PUBLIC_` vars are inlined into the JS bundle at build time, so anything here ships in the app. This app can only hold a **publishable `pk_…` token**, and `getBd()` throws on an `sk_…` key rather than letting a secret reach the store.

Barely limiting: the publishable scope set covers the entire customer-facing surface — storefront, cart, checkout, blog, marketing content, chat, forms, **the whole customer portal**, sign-in, and public custom-object reads. **No backend-for-frontend is needed.**

Expo is also the only mobile target with a real public-prefix convention. That prefix is an instruction to the bundler — *publish this* — so it is exactly and only correct for values that are safe to publish. Every var in `.env.example` is.

## Setup

```sh
cp .env.example .env
# Fill EXPO_PUBLIC_BD_SITE_ID and EXPO_PUBLIC_BD_PK

npm install
npx expo start
```

**With no env at all the app still launches** — screens render empty states and a setup banner. A starter you can't run before signing up isn't a starter.

For the schema + custom-database flows:

```sh
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

Unlike the other non-web starters, the SDK here is a **real runtime
dependency** — the app imports it — so the CLI comes along for free rather
than being a dev-only escape hatch.

## The shape

```
app/                       expo-router
  (tabs)/index.tsx         shop
  (tabs)/cart.tsx          cart + Stripe hand-off
  (tabs)/chat.tsx          Front Desk
  (tabs)/account.tsx       sign-in screen + portal
  product/[id].tsx
src/bd/
  client.ts    the two clients + the pk_ guard
  session.ts   session token → SecureStore, visitor id → AsyncStorage
  auth.ts      sign-in backend (BD's auth/customer/*) + provider links
src/components/
  SignInScreen.tsx  the business's own sign-in screen
  useChat.ts   the polling chat loop
  useBd.ts   useLoad / useVisitorToken
  money.ts     cents vs decimal
```

## Five things that will bite you

**1. Every list response is keyed `items`.** Not `products`, not `posts`, not `reviews`. Reading the wrong key yields `undefined`, not an error — so a screen renders "no products" against a full catalog and nothing looks broken. This one cost me every other starter in this repo before a typed harness caught it.

**2. A single blog post arrives wrapped.** `getPost(slug)` returns `{ post, access }`, where `access` is `granted` or `paywall`. A paywalled post comes back **truncated**, not absent, so ignoring the flag renders a teaser as the whole article.

**3. Money has two shapes.** Product, subscription and invoice totals are **integer cents**; cart `unitPrice`/`subtotal` arrive **decimal**. `cents()` and `amount()` are separate functions so you pick deliberately.

**4. Checkout returns `stripeUrl`, not `url`.** Open it with `expo-web-browser`; no card data touches this process, which keeps the app out of PCI scope.

**5. Two clients, different surfaces.** `createBdClient` is content + commerce. `createBdApiClient` is where `chatbot`, `auth` and the site-scoped `dataModel` live. Both are exposed rather than papered over, because reaching for the wrong one fails as "property is undefined".

## Sign-in is the app's own screen

The Account tab shows `SignInScreen` — the same screen as `<BdSignIn>` on the web and the Swift / Kotlin starters' native ones, drawn with this app's BdForm controls: the business's name, logo and brand colours from BD (primary on the button, secondary on links), each box checked when you leave it and all of them when you press the button, password sign-in, create account and reset with an emailed code. It runs on the SDK's `createSignInController` (`@businessdash/sdk/sign-in-core`), against BD's `auth/customer/*` routes with the publishable key. WorkOS is underneath every step.

"Continue with Google / Apple / GitHub / Discord" (whichever the business has switched on) opens WorkOS's page for the provider with `WebBrowser.openAuthSessionAsync`, which closes itself when the redirect fires and **returns the URL to the calling function** — no deep-link listener, no state stashed across an app restart. It comes back to `bdstarter://bd-oauth` (`Linking.createURL('bd-oauth')`, from the `scheme` in `app.json`) with a one-time code that only this sign-in's PKCE verifier can redeem. Nothing needs registering: BD accepts an app's own scheme.

## Chat is polling, and that's the API

There is no SSE or WebSocket anywhere in the Package API. `useChat` runs `createPersistedSession` → `postMessage` → `pollMessages` every 4s, and the effect's cleanup stops the loop: an interval left running in a mobile app burns battery and the org's rate limit for as long as the process lives. It de-duplicates on message id, because `since` only advances when the server returns a usable timestamp.

## Native forms

`src/bd-forms` renders a Live BusinessDash form with native views — no web view. It runs the SDK's own `createFormController`, the one every web binding uses, so conditions, steps, calculations, validation and the submit payload match the web exactly. iOS gets filled fields, system colors and page sheets; Android gets Material 3 outlined fields, dynamic color and bottom sheets.

```tsx
<BdForm form="contact" client={getBd()} pickFiles={pickFiles} renderIcon={renderIcon} />
```

The **Form** tab shows a built-in sample with every kind of field. It submits nowhere and logs the payload to the Metro console. Set `EXPO_PUBLIC_BD_FORM` in `.env` to a Live form's slug to show that form instead.

`src/bd-forms` needs only `@businessdash/sdk` (0.9.93+) and `react-native-safe-area-context`, so the folder copies into any app. File picking and icons need native modules, so they're wired in `src/bd/forms.tsx` with `expo-document-picker`, `expo-image-picker` and `react-native-svg`. `pnpm test:forms` runs the renderer's logic tests.

Full guide: [Native Forms (React Native)](https://businessdash.us/docs/developer/byFeature/forms/native-react-native).

## What this starter does not do

- **No portal detail screens.** Sign-in works and the scopes allow the whole portal; only the session check is wired.
- **No tests.** The SDK's own suite covers the client; what's here is app glue.

## ⚠️ Verification

**The Form tab has run on a device; the other screens haven't.** The form was walked end to end on an Android 16 emulator in Expo Go: every step, validation and scroll-to-error, a condition, the searchable sheets, calculations, color, date and time pickers, a picked PDF uploading on submit, the success screen and reset, light and dark. On iOS it has been rendered in the simulator, light and dark, but not tapped through.

The rest is **bundled, not yet run on a device.** On Expo SDK 58 (React Native 0.88, React 19.3), `npx expo export --platform ios --platform android` bundles both platforms, `npx expo install --check` reports every dependency at the SDK's expected version, and `pnpm typecheck` passes. Every SDK call typechecks against the real published types (`createBdClient`, `createBdApiClient`, storefront, cart, checkout, chat, auth, blog, reviews, subscriptions, marketing) — that harness is what caught the `items` bug. Nobody has opened the other screens in a simulator yet.

## Donations

One-time and monthly gifts, paid to the org's own Stripe account. Your app
reads the giving page, posts the gift, and sends the donor to the Stripe URL it
gets back; BusinessDash records the gift, adds the donor as a contact, notifies
the org and emails the receipt. The full guide, with this starter's code in its
own tab: [Donations](https://businessdash.us/docs/developer/byFeature/donations).

> `client.donations` needs `@businessdash/sdk` 0.9.91 or later, which this
> starter pins. An app made from an older copy upgrades zod in the same step,
> since 0.9.91 is built on zod 4: `pnpm up @businessdash/sdk zod@^4.6.7`.

With the app's publishable token (`EXPO_PUBLIC_BD_PK`):

```tsx
import { donationCoverFeeCents } from '@businessdash/sdk/native'
import * as WebBrowser from 'expo-web-browser'
import { getBd } from '../src/bd/client'

const bd = getBd()
const page = await bd?.donations.get()
if (bd && page && !page.unavailable) {
  const { url } = await bd.donations.startCheckout({
    amountCents: 2500,
    frequency: 'monthly',
    coverFees: true,
    donor: { name, email },
  })
  await WebBrowser.openBrowserAsync(url)
}
// Cover-fees label: donationCoverFeeCents(2500, page.coverFee)
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

**Reads** are on the site client:

```ts
const site = client.site(process.env.BD_SITE_ID!)

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
