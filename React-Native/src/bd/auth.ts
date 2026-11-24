import {
  type BdOAuthProvider,
  type BdSignInBackend,
  BdSignInError,
  type BdSignInSession,
  businessDashSignInBackend,
} from '@businessdash/sdk/sign-in-core'
import * as Crypto from 'expo-crypto'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'

import { BD_HOST } from './client'

/**
 * Customer sign-in for the app's own sign-in screen
 * (`src/components/SignInScreen.tsx`).
 *
 * Every step is BD's `auth/customer/*` routes, called with the publishable
 * key — the same routes and the same WorkOS accounts as the web starters, the
 * Swift `BdSignInView` and the Kotlin `BdSignIn`. Nothing here keeps a
 * password or checks a code.
 *
 * "Continue with Google / Apple / GitHub / Discord" opens WorkOS's page for
 * the provider in an auth session (`openAuthSessionAsync`: the system
 * browser's own sign-in, where the person may already be signed in to the
 * provider, and Google allows it — it refuses embedded web views). It comes
 * back to `bdstarter://bd-oauth` (the `scheme` in app.json) with a one-time
 * code that only this sign-in's PKCE verifier can redeem.
 */

const publishableKey = process.env.EXPO_PUBLIC_BD_PK

/** Where provider sign-ins come back to: `bdstarter://bd-oauth` (app.json `scheme`). */
export function oauthRedirectUri(): string {
  return Linking.createURL('bd-oauth')
}

function base64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A PKCE pair (RFC 7636, S256): the verifier stays here, the challenge goes to BD. */
async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = Crypto.getRandomBytes(32)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] as number)
  const verifier = base64Url(btoa(binary))
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  })
  return { verifier, challenge: base64Url(digest) }
}

/** The PKCE verifier of the provider sign-in in progress (one at a time). */
let pendingVerifier: string | null = null

/** Null until the app has a publishable key (see `src/bd/client.ts`). */
export function appSignInBackend(): BdSignInBackend | null {
  const key = publishableKey?.trim()
  if (!key || !key.startsWith('pk_')) return null

  const base = businessDashSignInBackend({ publishableKey: key, host: BD_HOST })

  async function call<T>(path: string, body: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${BD_HOST}/api/package/v1/auth/customer/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch {
      throw BdSignInError.offline()
    }
    const data = (await response.json().catch(() => null)) as {
      error?: unknown
      message?: unknown
    } | null
    if (!response.ok) {
      throw new BdSignInError(
        typeof data?.error === 'string' ? data.error : 'unavailable',
        typeof data?.message === 'string' && data.message
          ? data.message
          : BdSignInError.unavailable().message,
      )
    }
    return data as T
  }

  return {
    ...base,
    async startOAuth(provider, returnTo) {
      const { verifier, challenge } = await pkcePair()
      pendingVerifier = verifier
      const { url } = await call<{ url: string }>('oauth/start', {
        provider,
        redirectUri: oauthRedirectUri(),
        returnTo,
        codeChallenge: challenge,
      })
      return url
    },
    async finishOAuth(code) {
      const verifier = pendingVerifier
      pendingVerifier = null
      if (!verifier) {
        throw new BdSignInError('oauth_expired', 'That sign-in took too long. Try again.')
      }
      return call<BdSignInSession>('oauth/exchange', { code, codeVerifier: verifier })
    },
  }
}

export type ProviderOutcome =
  | { status: 'signed-in'; session: BdSignInSession }
  | { status: 'cancelled' }

/**
 * "Continue with …": WorkOS's page for the provider in an auth session, then
 * the code it hands back redeemed for a session. Throws `BdSignInError` with
 * words for the screen.
 */
export async function continueWithProvider(
  backend: BdSignInBackend,
  provider: BdOAuthProvider,
): Promise<ProviderOutcome> {
  if (!backend.startOAuth || !backend.finishOAuth) throw BdSignInError.unavailable()

  const url = await backend.startOAuth(provider, null)
  const result = await WebBrowser.openAuthSessionAsync(url, oauthRedirectUri())
  if (result.type !== 'success') return { status: 'cancelled' }

  const params = Linking.parse(result.url).queryParams ?? {}
  const failed = params.bd_oauth_error
  if (typeof failed === 'string' && failed) {
    if (failed === 'cancelled') return { status: 'cancelled' }
    const message = params.bd_oauth_message
    throw new BdSignInError(
      'oauth_failed',
      typeof message === 'string' && message ? message : "Sign-in didn't finish. Try again.",
    )
  }
  const code = params.bd_oauth_code
  if (typeof code !== 'string' || !code) {
    throw new BdSignInError('oauth_failed', "Sign-in didn't finish. Try again.")
  }
  return { status: 'signed-in', session: await backend.finishOAuth(code) }
}
