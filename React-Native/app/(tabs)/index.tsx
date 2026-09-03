import { Link } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { getBd, isConfigured } from '@/bd/client'
import { cents } from '@/bd/money'
import { useLoad } from '@/bd/useBd'
import { LoadState, SetupBanner } from '@/components/LoadState'

export default function ShopScreen() {
  const [search, setSearch] = useState('')

  const state = useLoad(async () => {
    const bd = getBd()
    if (!bd) return []
    const result = await bd.storefront.listProductsWithMeta({
      search: search || undefined,
      limit: 24,
    })
    return result.items ?? []
  }, [search])

  return (
    <View style={styles.screen}>
      {!isConfigured && <SetupBanner />}

      <TextInput
        style={styles.search}
        placeholder="Search products"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
      />

      <LoadState state={state}>
        {(products) => (
          <FlatList
            data={products}
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={<Text style={styles.empty}>No products yet.</Text>}
            renderItem={({ item }) => (
              <Link href={{ pathname: '/product/[id]', params: { id: String(item.id) } }} asChild>
                <Pressable style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.blurb} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  {/* Integer cents — see money.ts. */}
                  {/* A card carries no currency — the cart does. */}
                  <Text style={styles.price}>{cents(item.cheapestPriceCents)}</Text>
                </Pressable>
              </Link>
            )}
          />
        )}
      </LoadState>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: { margin: 12, padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowText: { flex: 1, gap: 2 },
  name: { fontWeight: '600' },
  blurb: { color: '#6b7280', fontSize: 13 },
  price: { fontVariant: ['tabular-nums'] },
  empty: { padding: 24, color: '#6b7280', textAlign: 'center' },
})
