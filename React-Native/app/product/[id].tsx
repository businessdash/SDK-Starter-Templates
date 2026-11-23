import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Button, ScrollView, StyleSheet, Text } from 'react-native'

import { getBd } from '@/bd/client'
import { cents } from '@/bd/money'
import { useLoad, useVisitorToken } from '@/bd/useBd'
import { LoadState } from '@/components/LoadState'

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const visitorToken = useVisitorToken()
  const [message, setMessage] = useState<string | null>(null)

  const state = useLoad(async () => {
    const bd = getBd()
    if (!bd || !id) return null
    return bd.storefront.getProduct(id)
  }, [id])

  async function addToCart() {
    const bd = getBd()
    if (!bd || !id || !visitorToken) return

    try {
      await bd.cart.forVisitor(visitorToken).addItem({ productId: id, quantity: 1 })
      setMessage('Added to cart.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add to cart.')
    }
  }

  return (
    <LoadState state={state}>
      {(product) =>
        product ? (
          // iOS 26+ draws the header over the content; "automatic" insets the
          // scroll view below it (React Native defaults to "never").
          <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
            <Text style={styles.name}>{product.name}</Text>
            {/* `cheapestPriceCents` and `description` arrive via the row
                schema's passthrough — served, but not in the contract's
                type — so read them as unknown and narrow before rendering. */}
            <Text style={styles.price}>
              {cents(
                typeof extra(product).cheapestPriceCents === 'number'
                  ? (extra(product).cheapestPriceCents as number)
                  : null,
              )}
            </Text>
            {typeof extra(product).description === 'string' && extra(product).description ? (
              <Text>{extra(product).description as string}</Text>
            ) : null}

            <Button title="Add to cart" onPress={addToCart} disabled={!visitorToken} />
            {message ? <Text style={styles.note}>{message}</Text> : null}
          </ScrollView>
        ) : (
          <ScrollView contentInsetAdjustmentBehavior="automatic">
            <Text style={styles.note}>Product not found.</Text>
          </ScrollView>
        )
      }
    </LoadState>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  name: { fontSize: 22, fontWeight: '700' },
  price: { fontSize: 18, fontVariant: ['tabular-nums'] },
  note: { color: '#6b7280', padding: 16 },
})

/** Fields the API serves beyond the typed contract. */
function extra(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}
