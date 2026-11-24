import { useEffect, useState } from 'react'
import { Alert, Button, StyleSheet, Text, View } from 'react-native'

import { getBdDev } from '@/bd/client'
import { clearSessionToken, getSessionToken, setSessionToken } from '@/bd/session'
import { SignInScreen } from '@/components/SignInScreen'

/**
 * Customer portal.
 *
 * The whole portal is reachable with a **publishable** token —
 * `customer_portal:self` and `tenant_auth:public` are both publishable-safe —
 * so this needs no backend-for-frontend. That is the fact that makes a native
 * BD app practical at all.
 *
 * Signed out, it's the business's own sign-in screen (`SignInScreen`): its
 * name, logo and brand colours from BD; password, emailed codes, and
 * "Continue with Google / Apple / GitHub / Discord" — WorkOS underneath,
 * through BD's `auth/customer/*` routes. The session token goes to the
 * Keychain / Keystore (`expo-secure-store`).
 */
export default function AccountScreen() {
  const [session, setSession] = useState<{ email?: string | null } | null | undefined>(undefined)
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    const bd = getBdDev()
    const token = await getSessionToken()
    if (!bd || !token) {
      setSession(null)
      return
    }

    try {
      const me = await bd.auth.me({ sessionToken: token })
      setSession(me ? { email: me.user.email } : null)
      // A token the server rejected is dead weight — drop it so the next
      // launch doesn't pay for another round trip to learn the same thing.
      if (!me) await clearSessionToken()
    } catch {
      setSession(null)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function handleSignOut() {
    await clearSessionToken()
    setSession(null)
  }

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      "Your profile, saved settings and cart are deleted and you're signed out. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => void deleteAccount() },
      ],
    )
  }

  /** Deletes the customer's account with this business, then forgets the token. */
  async function deleteAccount() {
    const bd = getBdDev()
    const token = await getSessionToken()
    if (!bd || !token) return handleSignOut()
    setDeleting(true)
    try {
      await bd.auth.customer.deleteAccount({ sessionToken: token })
      await handleSignOut()
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        await handleSignOut()
        Alert.alert('Account not deleted', 'Your sign-in has expired. Sign in again, then delete your account.')
      } else {
        Alert.alert('Account not deleted', "Your account couldn't be deleted just now. Please try again in a minute.")
      }
    } finally {
      setDeleting(false)
    }
  }

  if (session === undefined) return <View style={styles.screen} />

  if (!session) {
    return (
      <SignInScreen
        tagline="Sign in to see your jobs, quotes and invoices."
        onSignedIn={async (signedIn) => {
          if (signedIn.sessionToken) await setSessionToken(signedIn.sessionToken)
          setSession({ email: signedIn.user.email })
        }}
      />
    )
  }

  return (
    <View style={styles.screen}>
      <Text>Signed in as {session.email ?? 'a customer'}.</Text>
      <Button title="Sign out" onPress={handleSignOut} />
      {/* Google Play and the App Store require it in the app, not on a website. */}
      <Button title="Delete account" color="#b42318" disabled={deleting} onPress={confirmDelete} />
      <Text style={styles.note}>
        Deletes your account with us. Records of past orders and invoices stay with us, as the law asks.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  note: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
})
