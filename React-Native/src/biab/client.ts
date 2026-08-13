import {
  createBiabClient,
  createBiabDevClient,
  type BiabClient,
  type BiabDevClient,
} from '@businessdash/sdk/native'

/**
 * The BIAB client for this app.
 *
 * ## Why `/native` and not the root import
 *
 * `@businessdash/sdk` (the root) re-exports the auth handler, which calls
 * `Buffer.from(state, 'base64url')`. `Buffer` is a Node global that React
 * Native does not provide and Metro does not polyfill. The call sits inside a
 * function, so the root import *appears* to work — right up until a sign-in
 * callback is decoded and it throws `ReferenceError: Buffer is not defined`
 * in production, on a device, in front of a customer.
 *
 * `@businessdash/sdk/native` is the same data layer with the server-only surface
 * removed. Resolving it needs Metro's package-exports support — see
 * `metro.config.js`.
 *
 * ## The token rule
 *
 * `EXPO_PUBLIC_` vars are inlined into the JS bundle at build time, so
 * anything here ships in the app. This app can therefore only hold a
 * **publishable `pk_…` token**, and `createClient` throws on an `sk_…` key
 * rather than letting a secret reach the store.
 *
 * That is barely limiting: the publishable scope set covers the entire
 * customer-facing surface — storefront, cart, checkout, blog, marketing
 * content, chat, forms, the whole customer portal, sign-in, and public
 * custom-object reads. **No backend-for-frontend is needed.**
 */

const host = process.env.EXPO_PUBLIC_BIAB_HOST ?? 'https://www.biab.app'
const siteId = process.env.EXPO_PUBLIC_BIAB_SITE_ID
const publishableKey = process.env.EXPO_PUBLIC_BIAB_PK

/** Host root — the SDK wants the `/api/package/v1` base. */
export const BIAB_HOST = host.replace(/\/+$/, '')

const baseUrl = `${BIAB_HOST}/api/package/v1`

let cached: BiabClient | null | undefined
let cachedDev: BiabDevClient | null | undefined

/**
 * Returns `null` when the app hasn't been configured. That is a supported
 * state, not an error: screens render empty states and a setup banner rather
 * than crashing. `npx expo start` on a fresh clone should launch.
 */
export function getBiab(): BiabClient | null {
  if (cached !== undefined) return cached

  if (!siteId || !publishableKey) {
    cached = null
    return cached
  }

  if (publishableKey.startsWith('sk_')) {
    // Loud, not silent. A secret key in an app bundle is a leaked secret, and
    // the failure mode of shipping one is far worse than a crash in dev.
    throw new Error(
      'EXPO_PUBLIC_BIAB_PK is a SECRET key. EXPO_PUBLIC_ vars are compiled ' +
        'into the app bundle, where `strings` finds them — use a publishable ' +
        'pk_ token, and route anything needing a secret key through a server ' +
        'you control.',
    )
  }

  cached = createBiabClient({ apiKey: publishableKey, siteId, baseUrl })
  return cached
}

/**
 * The lower-level client.
 *
 * Two clients is not an accident of the SDK — they carry different surfaces.
 * `createBiabClient` (above) is the content/commerce client: storefront,
 * cart, checkout, blog, forms, marketing. `createBiabDevClient` is where
 * `chatbot`, `auth`, and the site-scoped `dataModel` live. A screen usually
 * wants one or the other, so both are exposed rather than papered over.
 */
export function getBiabDev(): BiabDevClient | null {
  if (cachedDev !== undefined) return cachedDev

  if (!siteId || !publishableKey || publishableKey.startsWith('sk_')) {
    cachedDev = null
    return cachedDev
  }

  cachedDev = createBiabDevClient({ apiKey: publishableKey, baseUrl })
  return cachedDev
}

export const SITE_ID = siteId ?? null

export const isConfigured = Boolean(siteId && publishableKey)
