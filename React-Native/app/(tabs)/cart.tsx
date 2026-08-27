import * as WebBrowser from 'expo-web-browser'
import { FlatList, StyleSheet, Text, View, Button } from 'react-native'

import { getBiab } from '@/biab/client'
import { amount } from '@/biab/money'
import { useLoad, useVisitorToken } from '@/biab/useBiab'
import { LoadState } from '@/components/LoadState'

export default function CartScreen() {
  const visitorToken = useVisitorToken()

  const state = useLoad(async () => {
    const biab = getBiab()
    if (!biab || !visitorToken) return null
    return biab.cart.forVisitor(visitorToken).get()
  }, [visitorToken])

  /**
   * Checkout hands off to Stripe in a browser. No card data touches this
   * process, which is what keeps the app out of PCI scope.
   *
   * The field is `stripeUrl`, not `url`.
   */
  async function checkout() {
    const biab = getBiab()
    if (!biab || !visitorToken) return

    const session = await biab.checkout.forVisitor(visitorToken).start({
      // Stripe substitutes the real id for the placeholder.
      successUrl: 'biabstarter://checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'biabstarter://checkout/cancel',
    })

    await WebBrowser.openBrowserAsync(session.stripeUrl)
  }

  return (
    <LoadState state={state}>
      {(cart) =>
        !cart || cart.items.length === 0 ? (
          <Text style={styles.empty}>Your cart is empty.</Text>
        ) : (
          <View style={styles.screen}>
            <FlatList
              data={cart.items}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Text style={styles.name}>{item.productName ?? 'Item'}</Text>
                  {/* Cart lines arrive DECIMAL, unlike product prices. */}
                  <Text style={styles.price}>
                    {amount(item.unitPrice, cart.currency ?? 'USD')} × {item.quantity}
                  </Text>
                </View>
              )}
            />

            <View style={styles.footer}>
              <Text style={styles.subtotal}>
                Subtotal: {amount(cart.subtotal, cart.currency ?? 'USD')}
              </Text>
              <Button title="Checkout" onPress={checkout} />
            </View>
          </View>
        )
      }
    </LoadState>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  name: { fontWeight: '600' },
  price: { fontVariant: ['tabular-nums'], color: '#6b7280' },
  footer: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  subtotal: { fontSize: 16, fontWeight: '600' },
  empty: { padding: 24, color: '#6b7280', textAlign: 'center' },
})
