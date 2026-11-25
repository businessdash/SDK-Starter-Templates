import { router, useFocusEffect } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { noteCart } from '@/bd/cart-count'
import { getBd } from '@/bd/client'
import { useVisitorToken } from '@/bd/useBd'
import { shop, styles as ui } from '@/components/shop'
import { type Cart, CartLine, CartSummary, CouponField } from '@/components/store-parts'

/** Where Stripe sends the customer back; `app/checkout/success.tsx` opens. */
const SUCCESS_URL = 'bdstarter://checkout/success?session_id={CHECKOUT_SESSION_ID}'
const CANCEL_URL = 'bdstarter://checkout/cancel'

/**
 * The cart: each line with its quantity, a coupon, the subtotal and
 * checkout. Every change hands back the whole cart, which also updates the
 * tab's badge. Cart lines are DOLLARS, unlike product prices (cents).
 */
export default function CartScreen() {
  const visitorToken = useVisitorToken()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cartClient = useCallback(() => {
    const bd = getBd()
    return bd && visitorToken ? bd.cart.forVisitor(visitorToken) : null
  }, [visitorToken])

  // Things go in from the product pages, so read the cart each time it shows.
  useFocusEffect(
    useCallback(() => {
      const client = cartClient()
      if (!client) {
        setLoading(!!getBd())
        return
      }
      let alive = true
      client
        .get()
        .then((next) => {
          if (!alive) return
          setCart(next)
          noteCart(next)
        })
        .catch(() => {})
        .finally(() => {
          if (alive) setLoading(false)
        })
      return () => {
        alive = false
      }
    }, [cartClient]),
  )

  async function change(run: (client: NonNullable<ReturnType<typeof cartClient>>) => Promise<Cart>) {
    const client = cartClient()
    if (!client) return
    setBusy(true)
    setError(null)
    try {
      const next = await run(client)
      setCart(next)
      noteCart(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your cart. Try again.")
    } finally {
      setBusy(false)
    }
  }

  /**
   * Checkout hands off to Stripe in a browser, so no card data touches the
   * app. The browser closes itself when Stripe sends the customer back to
   * the success address, and the order screen opens.
   */
  async function checkout() {
    const bd = getBd()
    if (!bd || !visitorToken) return
    setBusy(true)
    setError(null)
    try {
      const session = await bd.checkout.forVisitor(visitorToken).start({ successUrl: SUCCESS_URL, cancelUrl: CANCEL_URL })
      const result = await WebBrowser.openAuthSessionAsync(session.stripeUrl, 'bdstarter://checkout')
      if (result.type === 'success') {
        const id = new URL(result.url).searchParams.get('session_id')
        if (id) router.push({ pathname: '/checkout/success', params: { session_id: id } })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout. Try again.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <ActivityIndicator style={{ padding: 24 }} />

  const items = cart?.items ?? []
  const currency = cart?.currency ?? 'USD'
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={ui.sectionTitle}>Your cart is empty</Text>
        <Pressable accessibilityRole="link" onPress={() => router.navigate('/')}>
          <Text style={ui.link}>Browse the store →</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        renderItem={({ item }) => (
          <CartLine
            item={item}
            currency={currency}
            disabled={busy}
            onQuantity={(quantity) =>
              void change((c) => (quantity < 1 ? c.removeItem(item.id) : c.updateItem(item.id, { quantity })))
            }
            onRemove={() => void change((c) => c.removeItem(item.id))}
          />
        )}
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 8 }}>
            <CouponField
              coupon={cart?.couponCode}
              code={code}
              onCodeChange={setCode}
              disabled={busy}
              onApply={() =>
                void change(async (c) => {
                  const next = await c.applyCoupon({ code: code.trim() })
                  setCode('')
                  return next
                })
              }
              onRemove={() => void change((c) => c.removeCoupon())}
            />
            {error ? <Text style={{ color: shop.sale }}>{error}</Text> : null}
          </View>
        }
      />

      <CartSummary
        itemCount={cart?.itemCount ?? 0}
        subtotal={cart?.subtotal ?? 0}
        currency={currency}
        disabled={busy}
        onClear={() => void change((c) => c.clear())}
        onCheckout={checkout}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  empty: { padding: 32, gap: 8, alignItems: 'center' },
})
