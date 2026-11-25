import { Link } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import type { getBd } from '@/bd/client'
import { amount } from '@/bd/money'
import { Chip, ChipRow, EmptyNote, shop, styles as ui } from '@/components/shop'

// The store list's and the cart's parts. The Shop and Cart tabs lay them
// out; each takes plain values and callbacks, so you can move, restyle, drop
// or replace any of them. The product card, the save buttons, the compare
// bar and the rating strip are in `shop.tsx`.

/** The sorts the store offers. */
export const STORE_SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating-desc', label: 'Top rated' },
] as const

export type StoreSort = (typeof STORE_SORTS)[number]['value']

/** The category, the sheet's price and rating, and the sort. */
export type StoreFilters = {
  categoryId: string | null
  /** Dollars, as typed. */
  priceMin: string
  priceMax: string
  minRating: number | null
  sort: StoreSort
}

export const NO_STORE_FILTERS: StoreFilters = {
  categoryId: null,
  priceMin: '',
  priceMax: '',
  minRating: null,
  sort: 'featured',
}

/** The search box. The store searches once typing pauses. */
export function StoreSearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <TextInput
      style={styles.search}
      placeholder="Search products"
      value={value}
      onChangeText={onChange}
      autoCorrect={false}
      returnKeyType="search"
      accessibilityLabel="Search products"
    />
  )
}

/** ♥ and how many are saved; it opens the wishlist. */
export function WishlistLink({ count }: { count: number }) {
  return (
    <Link href="/wishlist" asChild>
      <Pressable accessibilityRole="link" style={styles.wishlistLink}>
        <Text style={ui.link}>♥ {count}</Text>
      </Pressable>
    </Link>
  )
}

/**
 * All products, then a chip per category with how many products it has;
 * choosing the chosen one again clears it. Nothing when there are none.
 */
export function CategoryChips({
  categories,
  counts,
  selected,
  onSelect,
}: {
  categories: { id: string; name: string }[]
  counts: Map<string, number>
  selected: string | null
  onSelect: (categoryId: string | null) => void
}) {
  if (categories.length === 0) return null
  return (
    <ChipRow>
      <Chip label="All products" active={!selected} onPress={() => onSelect(null)} />
      {categories.map((category) => (
        <Chip
          key={category.id}
          label={category.name}
          count={counts.get(category.id) ?? 0}
          active={selected === category.id}
          onPress={() => onSelect(selected === category.id ? null : category.id)}
        />
      ))}
    </ChipRow>
  )
}

/** "12 products", a spinner while it loads, and Filters (with how many are on) · the sort. */
export function StoreResultsBar({
  count,
  loading,
  failed,
  filterCount,
  sort,
  onFilters,
}: {
  count: number
  loading: boolean
  failed: boolean
  filterCount: number
  sort: StoreSort
  onFilters: () => void
}) {
  return (
    <View style={styles.resultsBar}>
      <View style={[ui.row, { gap: 8 }]}>
        <Text style={ui.muted}>
          {count} {count === 1 ? 'product' : 'products'}
        </Text>
        {loading ? <ActivityIndicator size="small" /> : null}
        {failed ? <Text style={{ color: shop.sale, fontSize: 13 }}>Couldn't update. Try again.</Text> : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onFilters} style={styles.filtersButton}>
        <Text style={ui.link}>
          {filterCount ? `Filters (${filterCount})` : 'Filters'} · {STORE_SORTS.find((option) => option.value === sort)?.label}
        </Text>
      </Pressable>
    </View>
  )
}

/** No products: "No matches" and Clear all filters when the list is narrowed, else "No products yet". */
export function StoreEmpty({ narrowed, onClear }: { narrowed: boolean; onClear: () => void }) {
  return (
    <EmptyNote
      title={narrowed ? 'No matches' : 'No products yet'}
      detail={
        narrowed
          ? 'No products match these filters. Try clearing a filter or broadening your search.'
          : "Add and publish products in the BD dashboard and they'll appear here."
      }
    >
      {narrowed ? (
        <Pressable onPress={onClear}>
          <Text style={ui.link}>Clear all filters</Text>
        </Pressable>
      ) : null}
    </EmptyNote>
  )
}

/**
 * Price, rating and sort, applied together, so the list doesn't reload on
 * every keystroke of a price. The price fields show the catalogue's range.
 */
export function StoreFiltersSheet({
  visible,
  filters,
  range,
  onApply,
  onClose,
}: {
  visible: boolean
  filters: StoreFilters
  range: { minDollars: number; maxDollars: number } | null
  onApply: (filters: StoreFilters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(filters)
  useEffect(() => {
    if (visible) setDraft(filters)
  }, [visible, filters])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheet}>
        <View style={styles.sheetHead}>
          <Pressable accessibilityRole="button" onPress={onClose}>
            <Text style={ui.link}>Cancel</Text>
          </Pressable>
          <Text style={ui.sectionTitle}>Filters</Text>
          <Pressable accessibilityRole="button" onPress={() => onApply(draft)}>
            <Text style={ui.link}>Apply</Text>
          </Pressable>
        </View>

        <Text style={styles.sheetLabel}>Sort</Text>
        <View style={styles.wrap}>
          {STORE_SORTS.map((sort) => (
            <Chip
              key={sort.value}
              label={sort.label}
              active={draft.sort === sort.value}
              onPress={() => setDraft({ ...draft, sort: sort.value })}
            />
          ))}
        </View>

        <Text style={styles.sheetLabel}>Price</Text>
        <View style={styles.priceRow}>
          <TextInput
            style={[styles.search, { flex: 1 }]}
            placeholder={range ? `$${Math.floor(range.minDollars)}` : 'Min'}
            value={draft.priceMin}
            onChangeText={(priceMin) => setDraft({ ...draft, priceMin })}
            keyboardType="decimal-pad"
            accessibilityLabel="Lowest price"
          />
          <Text style={ui.muted}>–</Text>
          <TextInput
            style={[styles.search, { flex: 1 }]}
            placeholder={range ? `$${Math.ceil(range.maxDollars)}` : 'Max'}
            value={draft.priceMax}
            onChangeText={(priceMax) => setDraft({ ...draft, priceMax })}
            keyboardType="decimal-pad"
            accessibilityLabel="Highest price"
          />
        </View>

        <Text style={styles.sheetLabel}>Rating</Text>
        <View style={styles.wrap}>
          <Chip label="Any" active={draft.minRating === null} onPress={() => setDraft({ ...draft, minRating: null })} />
          {[4, 3, 2].map((stars) => (
            <Chip
              key={stars}
              label={`${stars} stars & up`}
              active={draft.minRating === stars}
              onPress={() => setDraft({ ...draft, minRating: stars })}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          style={[ui.ghostButton, { marginTop: 24 }]}
          onPress={() => onApply({ ...NO_STORE_FILTERS, sort: draft.sort, categoryId: draft.categoryId })}
        >
          <Text style={[ui.ghostButtonText, { color: shop.sale }]}>Clear price and rating</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  )
}

/** A cart as BD hands it back. Its lines are DOLLARS, unlike product prices (cents). */
export type Cart = Awaited<ReturnType<ReturnType<NonNullable<ReturnType<typeof getBd>>['cart']['forVisitor']>['get']>>

export type CartItem = Cart['items'][number]

/**
 * A line in the cart: photo, name, style, − quantity +, the line's total and
 * Remove. [onQuantity] gets the new quantity; 0 means take it out.
 */
export function CartLine({
  item,
  currency,
  disabled = false,
  onQuantity,
  onRemove,
}: {
  item: CartItem
  currency: string
  disabled?: boolean
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  const name = item.productName ?? 'item'
  return (
    <View style={styles.line}>
      <View style={styles.photo}>
        {item.productImage ? <Image source={{ uri: item.productImage }} style={{ width: '100%', height: '100%' }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.name}>{item.productName ?? 'Item'}</Text>
        {/* The chosen style and options, e.g. "Onyx · Size 38". */}
        {item.variantTitle ? <Text style={ui.muted}>{item.variantTitle}</Text> : null}
        <View style={styles.lineFoot}>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`One fewer ${name}`}
              disabled={disabled}
              onPress={() => onQuantity(item.quantity - 1)}
              style={styles.stepButton}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.quantity}>{item.quantity}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`One more ${name}`}
              disabled={disabled}
              onPress={() => onQuantity(item.quantity + 1)}
              style={styles.stepButton}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.price}>{amount(item.subtotal, item.currency ?? currency)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name}`} disabled={disabled} onPress={onRemove}>
          <Text style={[ui.link, { color: shop.sale }]}>Remove</Text>
        </Pressable>
      </View>
    </View>
  )
}

/** The coupon box and Apply; once one is on, "Coupon RUN10 applied" and Remove. */
export function CouponField({
  coupon,
  code,
  onCodeChange,
  disabled = false,
  onApply,
  onRemove,
}: {
  coupon: string | null | undefined
  code: string
  onCodeChange: (code: string) => void
  disabled?: boolean
  onApply: () => void
  onRemove: () => void
}) {
  if (coupon) {
    return (
      <View style={styles.coupon}>
        <Text style={{ flex: 1, color: shop.ok }}>Coupon {coupon} applied</Text>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={onRemove}>
          <Text style={ui.link}>Remove</Text>
        </Pressable>
      </View>
    )
  }
  return (
    <View style={styles.coupon}>
      <TextInput
        style={styles.input}
        placeholder="Coupon code"
        value={code}
        onChangeText={onCodeChange}
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityLabel="Coupon code"
      />
      <Pressable accessibilityRole="button" disabled={disabled || !code.trim()} onPress={onApply} style={ui.ghostButton}>
        <Text style={ui.ghostButtonText}>Apply</Text>
      </Pressable>
    </View>
  )
}

/** Under the cart: the subtotal with how many things, Clear and Checkout. */
export function CartSummary({
  itemCount,
  subtotal,
  currency,
  disabled = false,
  onClear,
  onCheckout,
}: {
  itemCount: number
  subtotal: number
  currency: string
  disabled?: boolean
  onClear: () => void
  onCheckout: () => void
}) {
  return (
    <View style={styles.footer}>
      <View style={styles.subtotal}>
        <Text style={{ color: shop.text }}>
          Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
        </Text>
        <Text style={styles.total}>{amount(subtotal, currency)}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={onClear} style={ui.ghostButton}>
          <Text style={ui.ghostButtonText}>Clear</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onCheckout}
          style={[ui.button, { flex: 1 }, disabled && { opacity: 0.6 }]}
        >
          <Text style={ui.buttonText}>Checkout</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  search: { flex: 1, padding: 10, borderWidth: 1, borderColor: shop.border, borderRadius: 10 },
  wishlistLink: { paddingVertical: 8, paddingHorizontal: 4 },
  resultsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filtersButton: { paddingVertical: 6 },
  sheet: { padding: 20, gap: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetLabel: { fontWeight: '700', color: shop.text, marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
