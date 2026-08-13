# BIAB SDK — Flutter starter

Two packages:

- **`packages/biab`** — the client. **Pure Dart**: it imports nothing from Flutter, so it analyzes, tests and runs anywhere Dart does — a server, a CLI, a test runner with no Flutter toolchain installed. Its only dependency is `http`.
- **the root package** — the Flutter app built on it: shop, product detail, cart, and Front Desk chat.

The split is not tidiness. It means the part most likely to be wrong — decoding, error mapping, the access gate — is testable without an emulator, and stays reusable if you later want the same client in a Dart backend.

## The one rule that shapes everything here

**A mobile app ships its credential inside the artifact.** `strings` on an APK or IPA finds anything you bundle, so `BiabClient` asserts on an `sk_…` key and takes a **publishable `pk_…` token** only.

That turns out to be barely limiting. The publishable scope set covers the entire customer-facing surface:

> storefront · cart · checkout · blog · marketing content · chat · forms · **the whole customer portal** · sign-in · public custom-object reads · careers

So **this app needs no backend-for-frontend.** Only operator/admin writes need a secret key, and a customer app never makes those.

## Setup

The client verifies on its own, with no Flutter installed:

```sh
cd packages/biab
dart pub get
dart analyze
dart test
```

The app:

```sh
flutter pub get
flutter run \
  --dart-define=BIAB_SITE_ID=… \
  --dart-define=BIAB_PK=pk_…
```

Configuration comes from `--dart-define`, not a `.env` file. There is no env in an APK, and dart-defines are compiled in — which is exactly what an app credential is. **With no defines at all the app still launches**, showing a setup banner and empty states.

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


## What's in the client

```
packages/biab/lib/src/
  client.dart      transport, bearer, the access gate, the pk_ assert
  errors.dart      sealed exception hierarchy + isUnavailable
  models.dart      typed models for every fixed-shape surface
  resources.dart   storefront · cart · checkout · blog · reviews
                   subscriptions · marketing · forms · data model
  chat.dart        the polling chat API as a Stream
  bundle.dart      key-path reads for the two schema-driven surfaces
  money.dart       cents vs decimal — read this before rendering money
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

## What this starter does not do

- **The form renderer isn't built.** `<biab-form>` is a DOM web component with no Flutter counterpart, so this is the one surface an app genuinely reimplements. `formSchema()` returns a typed `FormSchema`; rendering it with Flutter widgets is left to you.
- **No sign-in / customer portal UI.** The scopes allow it (`tenant_auth:public`, `customer_portal:self`); the hosted auth flow needs a deep-link callback the way the Swift starter does.
- **The visitor token isn't persisted.** See above — one line with `shared_preferences`.
- **No widget tests.** Flutter isn't installed in the environment this was built in, so only the pure-Dart client is covered.

## Verification

`dart analyze` reports no issues and **14 tests pass** in `packages/biab`, covering the parts most likely to break silently: the 200-with-`available:false` gate, a real 4xx, `stripeUrl`, nil-query dropping, the bearer + site path, the cart header, both relation shapes, cents-vs-decimal, and empty-string-as-missing.

**The Flutter app itself has not been compiled** — no Flutter toolchain was available. Treat `lib/` as reviewed-but-unbuilt.
