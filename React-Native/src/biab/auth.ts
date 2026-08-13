import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'

import { getBiabDev } from './client'
import { setSessionToken } from './session'

/**
 * Tenant sign-in, the Expo way.
 *
 * The web starters bounce through a server-side callback route; the native
 * Swift and Kotlin starters register a custom URL scheme and wait for the OS
 * to hand the callback back through a separate lifecycle event.
 *
 * `openAuthSessionAsync` is strictly nicer than either: it opens the hosted
 * page in an ephemeral browser session, closes it automatically when the
 * redirect fires, and **returns the callback URL to this function**. No
 * deep-link listener, no state stashed across an app restart, no race between
 * the browser dismissing and the app reading the URL.
 *
 * The redirect URI still has to be registered on the BIAB site, or
 * `auth/start` refuses. `Linking.createURL` builds it from the `scheme` in
 * app.json.
 */
export function authCallbackUrl(): string {
  return Linking.createURL('auth/callback')
}

export type SignInOutcome =
  | { status: 'signed-in' }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }

export async function signIn(intent: 'sign-in' | 'sign-up' = 'sign-in'): Promise<SignInOutcome> {
  // `auth` lives on the dev client, not the content client.
  const biab = getBiabDev()
  if (!biab) return { status: 'failed', message: 'BIAB is not configured.' }

  const redirectUri = authCallbackUrl()

  try {
    const start = await biab.auth.start({ intent, redirectUri, returnTo: redirectUri })

    const result = await WebBrowser.openAuthSessionAsync(start.url, redirectUri)
    if (result.type !== 'success') return { status: 'cancelled' }

    const params = Linking.parse(result.url).queryParams ?? {}
    const code = typeof params.code === 'string' ? params.code : null
    const state = typeof params.state === 'string' ? params.state : null
    if (!code || !state) return { status: 'failed', message: 'Callback was missing code or state.' }

    const session = await biab.auth.exchange({ code, state, redirectUri })
    await setSessionToken(session.sessionToken)

    return { status: 'signed-in' }
  } catch (error) {
    // A 403 here is almost always a key missing the `tenant_auth:public`
    // scope, or a redirect URI that isn't registered on the site.
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Sign-in failed.',
    }
  }
}
