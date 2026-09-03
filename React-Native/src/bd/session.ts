import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

/**
 * The two per-device identifiers this app needs, each kept where it belongs.
 *
 * The distinction is not pedantry — it is the difference between a credential
 * and a correlation id:
 *
 * - the **session token** authenticates a customer → `expo-secure-store`
 *   (Keychain / Android Keystore)
 * - the **cart visitor token** is an opaque id tying a device to a cart →
 *   `AsyncStorage`. Putting it in secure storage would be cargo-culting, and
 *   secure storage has a size limit and a real performance cost.
 */

const SESSION_KEY = 'bd.session-token'
const VISITOR_KEY = 'bd.cart-visitor-token'

export async function getSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_KEY)
  } catch {
    return null
  }
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token)
}

export async function clearSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY)
}

/**
 * Stable per-install cart id.
 *
 * Generated locally — there is no endpoint that mints one, and the platform
 * keys the cart on whatever arrives in `X-BD-Cart-Visitor`. (`cart/session`
 * exists but mints a tokenized iframe-embed URL, a different feature.)
 *
 * Persisted so a cart survives a relaunch.
 */
export async function getVisitorToken(): Promise<string> {
  const existing = await AsyncStorage.getItem(VISITOR_KEY)
  if (existing) return existing

  const token = Crypto.randomUUID()
  await AsyncStorage.setItem(VISITOR_KEY, token)
  return token
}
