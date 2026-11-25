import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { noteCart, refreshCartCount } from '@/bd/cart-count'
import { getBd } from '@/bd/client'
import { useVisitorToken } from '@/bd/useBd'
import { shop, styles as ui } from '@/components/shop'

/**
 * Back from Stripe: `bdstarter://checkout/success?session_id=…` opens this
 * screen (the cart passes the same address as checkout's success URL), and
 * it says whether the order is paid.
 */
export default function OrderScreen() {
  const { session_id: sessionId } = useLocalSearchParams<{ session_id?: string }>()
  const visitorToken = useVisitorToken()
  const [status, setStatus] = useState<{ paid: boolean; email: string | null } | null | undefined>(undefined)

  useEffect(() => {
    const bd = getBd()
    if (!bd || !visitorToken || !sessionId) {
      if (!bd || !sessionId) setStatus(null)
      return
    }
    let alive = true
    bd.checkout
      .forVisitor(visitorToken)
      .getStatus(sessionId)
      .then((res) => {
        if (alive) setStatus({ paid: res.paymentStatus === 'paid', email: res.customerEmail ?? null })
      })
      .catch(() => alive && setStatus(null))
      // A paid order empties the cart.
      .finally(() => void refreshCartCount())
    return () => {
      alive = false
    }
  }, [sessionId, visitorToken])

  if (status === undefined) return <ActivityIndicator style={{ padding: 32 }} />

  return (
    <View style={styles.screen}>
      <Text style={styles.icon}>{status?.paid ? '✓' : '…'}</Text>
      <Text style={styles.title}>{status?.paid ? 'Thank you for your order' : 'Your order'}</Text>
      <Text style={[ui.muted, { textAlign: 'center' }]}>
        {status?.paid
          ? status.email
            ? `Your payment went through. A receipt is on its way to ${status.email}.`
            : 'Your payment went through.'
          : "We're confirming your payment. You'll get an email when it's done."}
      </Text>
      <Pressable
        accessibilityRole="button"
        style={ui.button}
        onPress={() => {
          noteCart(null)
          void refreshCartCount()
          router.dismissTo('/')
        }}
      >
        <Text style={ui.buttonText}>Continue shopping</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 32, gap: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  icon: { fontSize: 54, color: shop.ok },
  title: { fontSize: 22, fontWeight: '800', color: shop.text },
})
