import { useEffect, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'

import { signIn } from '@/bd/auth'
import { getBdDev } from '@/bd/client'
import { clearSessionToken, getSessionToken } from '@/bd/session'

/**
 * Customer portal.
 *
 * The whole portal is reachable with a **publishable** token —
 * `customer_portal:self` and `tenant_auth:public` are both publishable-safe —
 * so this needs no backend-for-frontend. That is the fact that makes a native
 * BD app practical at all.
 */
export default function AccountScreen() {
  const [session, setSession] = useState<{ email?: string | null } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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

  async function handleSignIn() {
    const outcome = await signIn()
    setMessage(outcome.status === 'failed' ? outcome.message : null)
    if (outcome.status === 'signed-in') await refresh()
  }

  async function handleSignOut() {
    await clearSessionToken()
    setSession(null)
  }

  return (
    <View style={styles.screen}>
      {session ? (
        <>
          <Text>Signed in as {session.email ?? 'a customer'}.</Text>
          <Button title="Sign out" onPress={handleSignOut} />
        </>
      ) : (
        <>
          <Text style={styles.blurb}>Sign in to see your jobs, quotes and invoices.</Text>
          <Button title="Sign in" onPress={handleSignIn} />
        </>
      )}
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  blurb: { color: '#6b7280', textAlign: 'center' },
  error: { color: '#991b1b', fontSize: 12 },
})
