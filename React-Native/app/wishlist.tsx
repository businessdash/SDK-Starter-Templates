import { Link } from 'expo-router'
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'

import { cents } from '@/bd/money'
import { shop, styles as ui } from '@/components/shop'
import { useSavedList, wishlist } from '@/shop/saved'

/** The products saved with ♥, kept on this device. */
export default function WishlistScreen() {
  const items = useSavedList(wishlist)
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={ui.sectionTitle}>Your wishlist is empty</Text>
          <Text style={ui.muted}>Tap ♡ on a product to save it here.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Link href={{ pathname: '/product/[id]', params: { id: item.id } }} asChild>
            <Pressable style={styles.link} accessibilityLabel={item.name}>
              <View style={styles.photo}>
                {item.image ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{item.name}</Text>
                {item.priceCents != null ? <Text style={ui.muted}>{cents(item.priceCents)}</Text> : null}
              </View>
            </Pressable>
          </Link>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => wishlist.remove(item.id)}>
            <Text style={ui.link}>Remove</Text>
          </Pressable>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  empty: { padding: 32, gap: 8, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: shop.soft },
  name: { fontWeight: '600', color: shop.text },
})
