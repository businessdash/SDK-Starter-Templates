# BIAB SDK — Kotlin starter

Two Gradle modules:

- **`:biab`** — the client. **Pure Kotlin/JVM**: no Android dependency, so it builds and tests with `./gradlew :biab:test` and no Android SDK, and stays reusable in a server or a Kotlin Multiplatform target later.
- **`:app`** — the Android app (Compose) built on it.

The split is not tidiness. It means the part most likely to be wrong — decoding, error mapping, the access gate — is testable without an emulator.

## The one rule that shapes everything here

**A mobile app ships its credential in the artifact.** `strings` on an APK finds anything in `BuildConfig`, so `BiabClient` `require`s a **publishable `pk_…` token** and refuses an `sk_…` key at construction.

That turns out to be barely limiting. The publishable scope set covers the entire customer-facing surface:

> storefront · cart · checkout · blog · marketing content · chat · forms · **the whole customer portal** · sign-in · public custom-object reads · careers

So **this app needs no backend-for-frontend.** Only operator/admin writes need a secret key, and a customer app never makes those.

## Setup

The client verifies on its own, with no Android SDK:

```sh
./gradlew :biab:test
```

The app:

```sh
cp local.properties.example local.properties
# Fill biab.siteId and biab.publishableKey (and sdk.dir, which Android Studio writes)

./gradlew :app:installDebug
```

Configuration goes through `local.properties` → `BuildConfig`, which is gitignored by Android convention — the right home for a value that ends up in the binary. **With nothing filled in the app still launches**, showing a setup banner and empty states.

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


## Why Ktor, not Retrofit

Retrofit is the Android-default answer and it would work. Ktor is here because it keeps `:biab` free of any Android dependency and leaves the **Kotlin Multiplatform** door open — a KMP client could serve Android *and* iOS from one codebase.

Worth knowing that's a real fork in the road: BIAB also ships a native Swift starter with its own `BiabKit`. If you go KMP later, one of those two becomes redundant. Decide that deliberately rather than ending up with both.

## What's in the client

```
biab/src/main/kotlin/app/biab/
  BiabClient.kt   transport, bearer, the access gate, the pk_ require
  BiabError.kt    sealed exception hierarchy + isUnavailable
  Models.kt       @Serializable models for every fixed-shape surface
  Resources.kt    storefront · cart · checkout · blog · reviews
                  subscriptions · forms
  ChatFeed.kt     the polling chat API as a cold Flow
  Bundle.kt       key-path reads for the two schema-driven surfaces
  Money.kt        cents vs decimal — read this before rendering money
```

## Five things that will bite you

**1. The access gate answers reads with HTTP 200.** A lapsed plan returns `{"available": false, …}` in the *body*, not a 4xx — a client that only checks the status code decodes an empty screen and never notices. `decode` inspects the body **before** the status, and a test pins that order.

**2. Money has two shapes.** Product, subscription and invoice totals are **integer cents**. Cart `unitPrice`/`subtotal` arrive **decimal**. `Money.cents` and `Money.amount` are separate functions so you pick deliberately — mixing them is a 100× error in either direction. Every model property says which it is. `BigDecimal`, not `Double`, so formatting doesn't round-trip through binary floating point.

**3. Checkout returns `stripeUrl`, not `url`.** Open it in a browser; no card data touches this process, which keeps the app out of PCI scope.

**4. The cart visitor token is generated locally and must be persisted.** There is no endpoint that mints one — `cart/session` is a tokenized iframe embed, a different feature. `BiabApp.visitorToken` keeps it in `SharedPreferences`, which is right because it's an opaque id, **not** a secret. A session token would belong in `EncryptedSharedPreferences` instead.

**5. `ignoreUnknownKeys = true` is load-bearing.** The platform returns a superset that grows release to release. Without it, one new column breaks the app on somebody else's deploy.

## Chat is polling, and that's the API

There is no SSE or WebSocket anywhere in the Package API. The platform's guidance is `chatbot/messages` every 3–5 seconds while a widget is open. `ChatFeed` wraps that in a **cold** `Flow`, so the poll starts when someone collects and stops when the collecting coroutine is cancelled — `delay` is cancellable, so leaving a screen halts the network work at the next suspension point. Nothing to unregister, nothing to leak.

The loop also de-duplicates on message id: `since` is only as good as what the server returns, and with no cursor **and** no timestamp it can't advance, replaying rows a naive collector would render twice.

## What this starter does not do

- **The form renderer isn't built.** `<biab-form>` is a DOM web component with no Compose counterpart, so this is the one surface an app genuinely reimplements. `formSchema()` returns a typed `FormSchema`; rendering it is left to you.
- **No sign-in / customer portal UI.** The scopes allow it (`tenant_auth:public`, `customer_portal:self`); the hosted auth flow needs a deep-link callback the way the Swift starter does.
- **One screen.** Shop + add-to-cart. Cart, blog and chat are wired in the client and the ViewModel but have no Compose screens yet.

## ⚠️ Verification status

**None of this has been compiled.** The machine it was written on has Java 11 and no Kotlin compiler, no Gradle, and no Android SDK. The tests in `biab/src/test` are written but have never run.

Treat it as reviewed, not verified. `./gradlew :biab:test` is the first thing to run, and it needs no Android SDK — the module split exists partly so that check is cheap.
