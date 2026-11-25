import { router, useFocusEffect } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { noteCart } from '@/bd/cart-count'
import { getBd } from '@/bd/client'
import { amount } from '@/bd/money'
import { useVisitorToken } from '@/bd/useBd'
import { shop, styles as ui } from '@/components/shop'

type Cart = Awaited<ReturnType<ReturnType<NonNullable<ReturnType<typeof getBd>>['cart']['forVisitor']>['get']>>

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
          <View style={styles.line}>
            <View style={styles.photo}>
              {item.productImage ? (
                <Image source={{ uri: item.productImage }} style={{ width: '100%', height: '100%' }} />
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name}>{item.productName ?? 'Item'}</Text>
              {/* The chosen style and options, e.g. "Onyx · Size 38". */}
              {item.variantTitle ? <Text style={ui.muted}>{item.variantTitle}</Text> : null}
              <View style={styles.lineFoot}>
                <View style={styles.stepper}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`One fewer ${item.productName ?? 'item'}`}
                    disabled={busy}
                    onPress={() =>
                      void change((c) =>
                        item.quantity <= 1 ? c.removeItem(item.id) : c.updateItem(item.id, { quantity: item.quantity - 1 }),
                      )
                    }
                    style={styles.stepButton}
                  >
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`One more ${item.productName ?? 'item'}`}
                    disabled={busy}
                    onPress={() => void change((c) => c.updateItem(item.id, { quantity: item.quantity + 1 }))}
                    style={styles.stepButton}
                  >
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
                <Text style={styles.price}>{amount(item.subtotal, item.currency ?? currency)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.productName ?? 'item'}`}
                disabled={busy}
                onPress={() => void change((c) => c.removeItem(item.id))}
              >
                <Text style={[ui.link, { color: shop.sale }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 8 }}>
            {cart?.couponCode ? (
              <View style={styles.coupon}>
                <Text style={{ flex: 1, color: shop.ok }}>Coupon {cart.couponCode} applied</Text>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void change((c) => c.removeCoupon())}>
                  <Text style={ui.link}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.coupon}>
                <TextInput
                  style={styles.input}
                  placeholder="Coupon code"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  accessibilityLabel="Coupon code"
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || !code.trim()}
                  onPress={() =>
                    void change(async (c) => {
                      const next = await c.applyCoupon({ code: code.trim() })
                      setCode('')
                      return next
                    })
                  }
                  style={ui.ghostButton}
                >
                  <Text style={ui.ghostButtonText}>Apply</Text>
                </Pressable>
              </View>
            )}
            {error ? <Text style={{ color: shop.sale }}>{error}</Text> : null}
          </View>
        }
      />

      <View style={styles.footer}>
        <View style={styles.subtotal}>
          <Text style={{ color: shop.text }}>
            Subtotal ({cart?.itemCount ?? 0} {cart?.itemCount === 1 ? 'item' : 'items'})
          </Text>
          <Text style={styles.total}>{amount(cart?.subtotal ?? 0, currency)}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void change((c) => c.clear())}
            style={ui.ghostButton}
          >
            <Text style={ui.ghostButtonText}>Clear</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={checkout}
            style={[ui.button, { flex: 1 }, busy && { opacity: 0.6 }]}
          >
            <Text style={ui.buttonText}>Checkout</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  empty: { padding: 32, gap: 8, alignItems: 'center' },
  line: { flexDirection: 'row', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: shop.border },
  photo: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: shop.soft },
  name: { fontWeight: '600', color: shop.text },
  lineFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: shop.border, borderRadius: 8 },
  stepButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 18, color: shop.text },
  quantity: { minWidth: 24, textAlign: 'center', fontWeight: '700', fontVariant: ['tabular-nums'] },
  price: { fontWeight: '700', color: shop.text, fontVariant: ['tabular-nums'] },
  coupon: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { flex: 1, padding: 10, borderWidth: 1, borderColor: shop.border, borderRadius: 10 },
  footer: { padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: shop.border },
  subtotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 18, fontWeight: '800', color: shop.text, fontVariant: ['tabular-nums'] },
})
