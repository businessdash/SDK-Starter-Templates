import { Link } from 'expo-router'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { cents } from '@/bd/money'
import { compareList, type SavedProduct, useSavedList, wishlist } from '@/shop/saved'

/** The colours the shop screens share. */
export const shop = {
  accent: '#5b3cc4',
  accentSoft: '#efeafd',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  soft: '#f6f5f9',
  sale: '#b91c1c',
  ok: '#15803d',
}

/** ★★★★☆, with the rating said out loud for screen readers. */
export function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  const full = Math.round(Math.max(0, Math.min(5, rating)))
  return (
    <Text
      accessibilityLabel={`${rating.toFixed(1)} out of 5`}
      style={{ color: shop.accent, fontSize: size, letterSpacing: 1 }}
    >
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
    </Text>
  )
}

/** A pill that filters: a category, a platform, a topic. */
export function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string
  count?: number
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
        {count !== undefined ? <Text style={styles.chipCount}> {count}</Text> : null}
      </Text>
    </Pressable>
  )
}

/** A product in the store's listing (`storefront.listProductsWithMeta`). */
export type ListedProduct = {
  id: string
  name: string
  coverImage?: string | null
  cheapestPriceCents?: number | null
  comparePriceCents?: number | null
  hasMultipleVariants?: boolean | null
  isOnSale?: boolean | null
  isNew?: boolean | null
  isBestSeller?: boolean | null
  isLowStock?: boolean | null
  avgRating?: number | null
  reviewCount?: number | null
}

export function savedFrom(product: ListedProduct): SavedProduct {
  return {
    id: product.id,
    name: product.name,
    image: product.coverImage ?? null,
    priceCents: product.cheapestPriceCents ?? null,
  }
}

/** A card in the store grid: photo, badges, stars, "from" and sale prices. */
export function ProductCard({ product, width }: { product: ListedProduct; width: number }) {
  const reviews = product.reviewCount ?? 0
  return (
    <View style={[styles.card, { width }]}>
      <Link href={{ pathname: '/product/[id]', params: { id: product.id } }} asChild>
        <Pressable accessibilityLabel={product.name}>
          <View style={styles.media}>
            {product.coverImage ? (
              <Image source={{ uri: product.coverImage }} style={styles.mediaImage} resizeMode="cover" />
            ) : (
              <Text style={styles.noImage}>No image</Text>
            )}
            <View style={styles.badges}>
              {product.isBestSeller ? <Badge label="Best seller" /> : null}
              {product.isNew ? <Badge label="New" /> : null}
              {product.isOnSale ? <Badge label="Sale" sale /> : null}
            </View>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardName} numberOfLines={2}>
              {product.name || 'Untitled'}
            </Text>
            {reviews > 0 ? (
              <View style={styles.row}>
                <Stars rating={product.avgRating ?? 0} size={12} />
                <Text style={styles.muted}> ({reviews})</Text>
              </View>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.price}>
                {product.cheapestPriceCents != null
                  ? `${product.hasMultipleVariants ? 'From ' : ''}${cents(product.cheapestPriceCents)}`
                  : 'View details'}
              </Text>
              {product.isOnSale && product.comparePriceCents != null ? (
                <Text style={styles.compareAt}> {cents(product.comparePriceCents)}</Text>
              ) : null}
            </View>
            {product.isLowStock ? <Text style={styles.lowStock}>Low stock</Text> : null}
          </View>
        </Pressable>
      </Link>
      <View style={styles.saveCorner}>
        <SaveButtons product={savedFrom(product)} compact />
      </View>
    </View>
  )
}

function Badge({ label, sale }: { label: string; sale?: boolean }) {
  return (
    <Text style={[styles.badge, sale && { backgroundColor: shop.sale, color: '#fff' }]}>{label}</Text>
  )
}

/** Save to the wishlist (♥) and pick for comparing (⇄). */
export function SaveButtons({ product, compact }: { product: SavedProduct; compact?: boolean }) {
  const saved = useSavedList(wishlist).some((item) => item.id === product.id)
  const picks = useSavedList(compareList)
  const picked = picks.some((item) => item.id === product.id)
  const full = !picked && picks.length >= compareList.limit
  return (
    <View style={[styles.saveButtons, compact && styles.saveButtonsCompact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        accessibilityState={{ selected: saved }}
        onPress={() => wishlist.toggle(product)}
        style={[styles.saveButton, saved && styles.saveButtonOn]}
      >
        <Text style={[styles.saveIcon, saved && styles.saveIconOn]}>{saved ? '♥' : '♡'}</Text>
        {compact ? null : <Text style={styles.saveLabel}>{saved ? 'Saved' : 'Save'}</Text>}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={picked ? 'Remove from compare' : full ? 'Compare holds four products' : 'Compare'}
        accessibilityState={{ selected: picked, disabled: full }}
        disabled={full}
        onPress={() => compareList.toggle(product)}
        style={[styles.saveButton, picked && styles.saveButtonOn, full && { opacity: 0.4 }]}
      >
        <Text style={[styles.saveIcon, picked && styles.saveIconOn]}>⇄</Text>
        {compact ? null : <Text style={styles.saveLabel}>{picked ? 'Comparing' : 'Compare'}</Text>}
      </Pressable>
    </View>
  )
}

/** Along the bottom of the store while products are picked to compare. */
export function CompareBar() {
  const picks = useSavedList(compareList)
  if (picks.length === 0) return null
  return (
    <View style={styles.compareBar}>
      <Text style={styles.compareText}>
        {picks.length} of {compareList.limit} picked to compare
      </Text>
      <Pressable accessibilityRole="button" onPress={() => compareList.clear()}>
        <Text style={styles.link}>Clear</Text>
      </Pressable>
      <Link href="/compare" asChild>
        <Pressable accessibilityRole="button" style={styles.button} disabled={picks.length < 2}>
          <Text style={styles.buttonText}>{picks.length < 2 ? 'Pick one more' : 'Compare'}</Text>
        </Pressable>
      </Link>
    </View>
  )
}

/** A row of saved products (related, recently viewed). */
export function ProductRail({ title, products }: { title: string; products: SavedProduct[] }) {
  if (products.length === 0) return null
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {products.map((product) => (
          <Link key={product.id} href={{ pathname: '/product/[id]', params: { id: product.id } }} asChild>
            <Pressable style={styles.railCard} accessibilityLabel={product.name}>
              <View style={styles.railMedia}>
                {product.image ? (
                  <Image source={{ uri: product.image }} style={styles.mediaImage} resizeMode="cover" />
                ) : null}
              </View>
              <Text style={styles.railName} numberOfLines={2}>
                {product.name}
              </Text>
              {product.priceCents != null ? <Text style={styles.muted}>{cents(product.priceCents)}</Text> : null}
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  )
}

/** The business's rating at the top of the store; it opens the reviews. */
export function ReviewStrip({ rating, total }: { rating: number | null; total: number }) {
  if (rating === null || total === 0) return null
  return (
    <Link href="/reviews" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Rated ${rating.toFixed(1)} from ${total} reviews. See all reviews.`}
        style={styles.strip}
      >
        <Stars rating={rating} size={12} />
        <Text style={styles.stripRating}>{rating.toFixed(1)}</Text>
        <Text style={styles.muted}>
          · {total} {total === 1 ? 'review' : 'reviews'}
        </Text>
        <Text style={[styles.muted, { marginLeft: 'auto' }]}>›</Text>
      </Pressable>
    </Link>
  )
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  muted: { color: shop.muted, fontSize: 13 },
  link: { color: shop.accent, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: shop.text },
  button: { backgroundColor: shop.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  ghostButton: { borderWidth: 1, borderColor: shop.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  ghostButtonText: { color: shop.text, fontWeight: '600' },
  chip: { borderWidth: 1, borderColor: shop.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fff' },
  chipActive: { borderColor: shop.accent, backgroundColor: shop.accentSoft },
  chipText: { color: shop.text, fontSize: 14 },
  chipTextActive: { color: shop.accent, fontWeight: '600' },
  chipCount: { color: shop.muted },
  card: { borderWidth: 1, borderColor: shop.border, borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden' },
  media: { aspectRatio: 1, backgroundColor: shop.soft, alignItems: 'center', justifyContent: 'center' },
  mediaImage: { width: '100%', height: '100%' },
  noImage: { color: shop.muted, fontSize: 12 },
  badges: { position: 'absolute', top: 8, left: 8, gap: 4, alignItems: 'flex-start' },
  badge: { backgroundColor: '#fff', color: shop.text, fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  cardBody: { padding: 10, gap: 4 },
  cardName: { fontWeight: '600', color: shop.text },
  price: { fontWeight: '700', color: shop.text, fontVariant: ['tabular-nums'] },
  compareAt: { color: shop.muted, textDecorationLine: 'line-through', fontSize: 13 },
  lowStock: { color: shop.sale, fontSize: 12, fontWeight: '600' },
  saveCorner: { position: 'absolute', top: 6, right: 6 },
  saveButtons: { flexDirection: 'row', gap: 8 },
  saveButtonsCompact: { gap: 4 },
  saveButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 32, minHeight: 32, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: shop.border },
  saveButtonOn: { borderColor: shop.accent, backgroundColor: shop.accentSoft },
  saveIcon: { fontSize: 15, color: shop.text },
  saveIconOn: { color: shop.accent },
  saveLabel: { fontSize: 14, color: shop.text },
  compareBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: shop.border, backgroundColor: '#fff' },
  compareText: { flex: 1, color: shop.text },
  railCard: { width: 132, gap: 4 },
  railMedia: { width: 132, height: 132, borderRadius: 10, overflow: 'hidden', backgroundColor: shop.soft },
  railName: { fontSize: 13, fontWeight: '600', color: shop.text },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: shop.soft },
  stripRating: { fontWeight: '700', color: shop.text },
})
