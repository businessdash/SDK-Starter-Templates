# BIAB SDK — Swift starter

Two products in one package:

- **`BiabKit`** — the data layer. No dependencies; the Package API is plain REST with a bearer key, so `URLSession` + `Codable` covers all of it.
- **`BiabStarterApp`** — SwiftUI screens built on the kit: shop, cart, blog, Front Desk chat, and the customer portal.

## The one rule that shapes everything here

**A native app ships its credential inside the binary.** `strings` on an `.ipa` finds anything you bundle, so `BiabClient` accepts a **publishable `pk_…` token only** and traps at `init` if you hand it an `sk_…` key.

That turns out to be barely limiting. The publishable scope set covers the entire customer-facing surface:

> storefront · cart · checkout · blog · marketing content · chat · forms · **the whole customer portal** · sign-in · public custom-object reads · careers

So **this app needs no backend-for-frontend.** Only operator/admin writes need a secret key, and a customer app never makes those. If you do need one, put it behind a server you control and point the app at that.

## Setup

The package builds on its own:

```sh
swift build
swift test
```

For an actual app: **File ▸ Add Package Dependencies… ▸ Add Local…** and select this directory, then add `BiabKit` and `BiabStarterApp` to your target.

Configuration lives in Info.plist — there is no `.env` in an app bundle. `BiabStarter.xcconfig` has the four keys and how to wire them:

| Info.plist key | What |
| --- | --- |
| `BIABHost` | defaults to `https://www.biab.app` |
| `BIABPublishableKey` | `pk_…` — never `sk_…` |
| `BIABSiteID` | the site UUID |
| `BIABAuthCallbackURL` | e.g. `biabstarter://auth/callback` |

**With no keys at all the app still runs** — screens render their empty states and a setup notice appears. A starter you can't launch before signing up isn't a starter.

Your `App` body:

```swift
@main
struct MyApp: App {
    @State private var biab = BiabEnvironment()

    var body: some Scene {
        WindowGroup {
            BiabRootView()
                .environment(biab)
                .task { await biab.bootstrap() }
                .onOpenURL { url in
                    guard let (code, state) = BiabAuth.callbackParameters(from: url) else { return }
                    Task { try? await biab.completeSignIn(code: code, state: state) }
                }
        }
    }
}
```

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


## What's in the kit

```
Sources/BiabKit/
  BiabClient.swift        transport, bearer, access gate, the pk_ guard
  BiabError.swift         typed failures + `isUnavailable`
  BiabConfiguration.swift Info.plist reader
  BiabAuth.swift          hosted sign-in via a custom URL scheme
  BiabSessionStore.swift  actor: session token → Keychain, visitor id → UserDefaults
  ChatFeed.swift          the polling chat API as an AsyncStream
  Models.swift            Codable structs for every typed surface
  JSONValue.swift         for the two genuinely schema-driven surfaces
  Money.swift             cents vs decimal — read this before rendering money
  Resources.swift         storefront · cart · checkout · blog · forms · portal
                          reviews · subscriptions · marketing · parallel pages
                          · data model
```

## Five things that will bite you

**1. The access gate answers reads with HTTP 200.** A lapsed plan returns `{"available": false, …}` in the *body*, not a 4xx — a client that only checks `statusCode` decodes an empty screen and never notices. `BiabClient` inspects the body *before* the status, deliberately, and there's a test pinning that order.

**2. Money has two shapes.** Product, subscription, invoice and quote totals are **integer cents**. Cart `unitPrice`/`subtotal` arrive **decimal**. `Money.cents(_:)` and `Money.amount(_:)` are separate functions so you pick deliberately — mixing them is a 100× error in either direction. Every model property says which it is.

**3. Two different session headers.** `auth/me` takes a lowercase `x-biab-session`. Cart and portal routes take `X-BIAB-Session-Token`. Not interchangeable, and the wrong one reads as "not signed in" rather than as an error.

**4. Checkout returns `stripeUrl`, not `url`.** Open it in a browser; no card data touches this process, which is what keeps the app out of PCI scope.

**5. The cart visitor token is generated locally.** There is no endpoint that mints one — `cart/session` is a different feature (a tokenized iframe embed). `BiabSessionStore` keeps it in `UserDefaults`, because it's an opaque id, not a secret. The *session* token goes in the Keychain, because it is one.

## Chat is polling, and that's the API

There is no SSE or WebSocket anywhere in the Package API. The platform's guidance is `chatbot/messages` every 3–5 seconds while a widget is open. `ChatFeed` wraps that loop in an `AsyncStream` so a view can `for await` instead of owning a timer:

```swift
for await batch in feed.messages() {
    messages.append(contentsOf: batch)
}
```

Leaving the loop — or SwiftUI cancelling the `.task` on disappear — tears the poller down through the stream's `onTermination`. The producer also filters on message id, so a response without a usable cursor can't replay rows you already have.

## What this starter does not do

- **The form renderer is minimal.** `<biab-form>` is a DOM web component with no native counterpart, so this is the one surface an app genuinely reimplements. `BiabFormView` covers text, textarea, select and checkbox fields; conditional blocks, availability pickers and uploads are not ported. Extend `field(for:)` — the schema tells you the type.
- **Sign-in uses `openURL`, not `ASWebAuthenticationSession`.** A production app should use the latter so the sheet dismisses itself and the callback is delivered directly. `openURL` keeps the starter free of AuthenticationServices presentation-anchor plumbing.
- **One chat session per install.** A real app would mint a session per topic and persist the id next to the visitor token.
- **No shipping / address / coupons-admin surfaces.** The endpoints exist; the kit covers what these screens use.

## Verification

`swift build` and `swift test` both pass under **Swift 6 language mode with strict concurrency**, and the suite covers the parts most likely to break silently: the 200-with-`available:false` gate, `stripeUrl`, the two session headers, nil-query dropping, relation shapes, and cents-vs-decimal.
