import { Link } from 'expo-router'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { getBd } from '@/bd/client'
import { useLoad } from '@/bd/useBd'
import { LoadState } from '@/components/LoadState'
import { shop, styles as ui } from '@/components/shop'
import { compareList, useSavedList } from '@/shop/saved'
import { defaultVariant, formatDollars, galleryFor, type ProductView, toProductView } from '@/shop/shop'

type Column = { view: ProductView; rating: { avg: number; count: number } | null }

/** Up to four picked products side by side: price, rating, options, specs. */
export default function CompareScreen() {
  const picks = useSavedList(compareList)
  const ids = picks.map((item) => item.id)

  const state = useLoad(async () => {
    const bd = getBd()
    if (!bd) return []
    const columns = await Promise.all(
      ids.slice(0, compareList.limit).map(async (id): Promise<Column | null> => {
        try {
          const [product, reviews] = await Promise.all([
            bd.storefront.getProduct(id),
            bd.storefront.getProductReviews(id, { limit: 1 }).catch(() => null),
          ])
          return {
            view: toProductView(product),
            rating: reviews && reviews.totalCount > 0 ? { avg: reviews.avgRating ?? 0, count: reviews.totalCount } : null,
          }
        } catch {
          return null
        }
      }),
    )
    return columns.filter((column): column is Column => column !== null)
  }, [ids.join(',')])

  if (ids.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={ui.sectionTitle}>Nothing to compare</Text>
        <Text style={ui.muted}>Tap ⇄ on up to four products.</Text>
      </View>
    )
  }

  return (
    <LoadState state={state}>
      {(columns) => {
        const specs = specRows(columns)
        const rows: { label: string; value: (column: Column) => string }[] = [
          {
            label: 'Price',
            value: (c) => {
              const price = defaultVariant(c.view)?.price
              return price != null ? formatDollars(price) : '—'
            },
          },
          { label: 'Rating', value: (c) => (c.rating ? `${c.rating.avg.toFixed(1)} ★ (${c.rating.count})` : 'No reviews') },
          { label: 'Category', value: (c) => c.view.categoryName ?? '—' },
          { label: 'Options', value: (c) => c.view.variants.map((variant) => variant.name).join(', ') || '—' },
          ...specs.map((spec) => ({
            label: `${spec.label} (${spec.group})`,
            value: (c: Column) =>
              c.view.specs.find((group) => group.name === spec.group)?.rows.find((row) => row.label === spec.label)
                ?.value ?? '—',
          })),
        ]
        return (
          <ScrollView contentInsetAdjustmentBehavior="automatic">
            <ScrollView horizontal contentContainerStyle={styles.table}>
              <View>
                <View style={styles.headRow}>
                  <View style={styles.labelCell} />
                  {columns.map((column) => (
                    <View key={column.view.id} style={styles.cell}>
                      <Link href={{ pathname: '/product/[id]', params: { id: column.view.id } }} asChild>
                        <Pressable accessibilityLabel={column.view.name} style={{ gap: 6 }}>
                          <View style={styles.photo}>
                            {galleryFor(column.view, defaultVariant(column.view)?.id ?? '')[0] ? (
                              <Image
                                source={{ uri: galleryFor(column.view, defaultVariant(column.view)?.id ?? '')[0] }}
                                style={{ width: '100%', height: '100%' }}
                              />
                            ) : null}
                          </View>
                          <Text style={styles.name} numberOfLines={2}>
                            {column.view.name}
                          </Text>
                        </Pressable>
                      </Link>
                      <Pressable accessibilityRole="button" onPress={() => compareList.remove(column.view.id)}>
                        <Text style={ui.link}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
                {rows.map((row) => (
                  <View key={row.label} style={styles.row}>
                    <Text style={[styles.labelCell, ui.muted]}>{row.label}</Text>
                    {columns.map((column) => (
                      <Text key={column.view.id} style={[styles.cell, styles.value]}>
                        {row.value(column)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() => compareList.clear()}
              style={[ui.ghostButton, { margin: 16 }]}
            >
              <Text style={ui.ghostButtonText}>Clear compare</Text>
            </Pressable>
          </ScrollView>
        )
      }}
    </LoadState>
  )
}

/** Every spec any column has, in the order they first appear. */
function specRows(columns: Column[]): { group: string; label: string }[] {
  const seen = new Set<string>()
  const rows: { group: string; label: string }[] = []
  for (const column of columns) {
    for (const group of column.view.specs) {
      for (const row of group.rows) {
        const key = `${group.name}\u0000${row.label}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.push({ group: group.name, label: row.label })
      }
    }
  }
  return rows
}

const styles = StyleSheet.create({
  empty: { padding: 32, gap: 8, alignItems: 'center' },
  table: { padding: 16 },
  headRow: { flexDirection: 'row', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: shop.border },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: shop.border },
  labelCell: { width: 110 },
  cell: { width: 140, gap: 6 },
  value: { color: shop.text },
  photo: { width: 140, height: 140, borderRadius: 10, overflow: 'hidden', backgroundColor: shop.soft },
  name: { fontWeight: '600', color: shop.text },
})
