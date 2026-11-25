import { Link } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'

import { getBd, isConfigured } from '@/bd/client'
import { useLoad } from '@/bd/useBd'
import { LoadState, SetupBanner } from '@/components/LoadState'
import {
  Chip,
  CompareBar,
  type ListedProduct,
  ProductCard,
  ReviewStrip,
  shop,
  styles as ui,
} from '@/components/shop'
import { useSavedList, wishlist } from '@/shop/saved'

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating-desc', label: 'Top rated' },
] as const

type Sort = (typeof SORTS)[number]['value']

type Filters = {
  categoryId: string | null
  /** Dollars, as typed. */
  priceMin: string
  priceMax: string
  minRating: number | null
  sort: Sort
}

const NO_FILTERS: Filters = { categoryId: null, priceMin: '', priceMax: '', minRating: null, sort: 'featured' }

/**
 * The store: the business's rating (it opens the reviews), search, category
 * chips with counts, a sheet for price, rating and sort, and the product
 * grid. Each card saves to the wishlist or the compare picks; the bar along
 * the bottom leads to the compare table. The web starters' store has the
 * same parts (`listProductsWithMeta`).
 */
export default function ShopScreen() {
  const { width } = useWindowDimensions()
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  const saved = useSavedList(wishlist)

  // Search once typing pauses, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), 300)
    return () => clearTimeout(timer)
  }, [typed])

  const extras = useLoad(async () => {
    const bd = getBd()
    if (!bd) return { categories: [], rating: null, total: 0 }
    const [categories, bundle] = await Promise.all([
      bd.storefront.listCategories().catch(() => ({ items: [] })),
      bd.marketing.getPageBundle({ pageKey: 'home', locale: 'en' }).catch(() => null),
    ])
    const reviews = (bundle as { reviews?: { rating?: number | null; totalCount?: number | null } | null } | null)
      ?.reviews
    return {
      categories: categories.items ?? [],
      rating: typeof reviews?.rating === 'number' ? reviews.rating : null,
      total: reviews?.totalCount ?? 0,
    }
  }, [])

  const listing = useLoad(async () => {
    const bd = getBd()
    if (!bd) return { products: [] as ListedProduct[], counts: new Map<string, number>(), range: null }
    const minPriceCents = toCents(filters.priceMin)
    const maxPriceCents = toCents(filters.priceMax)
    const meta = await bd.storefront.listProductsWithMeta({
      limit: 48,
      sort: filters.sort,
      ...(search ? { search } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(minPriceCents != null ? { minPriceCents } : {}),
      ...(maxPriceCents != null ? { maxPriceCents } : {}),
      ...(filters.minRating != null ? { minRating: filters.minRating } : {}),
    })
    return {
      products: (meta.items ?? []) as ListedProduct[],
      counts: new Map((meta.categoryCounts ?? []).map((row) => [row.categoryId, row.count ?? 0])),
      range: meta.priceRange ?? null,
    }
  }, [search, filters])

  // The results on screen stay while the next ones load, so the search box
  // (in the list's header) keeps its keyboard as you type.
  type Listing = Extract<typeof listing, { status: 'loaded' }>['value']
  const [shown, setShown] = useState<Listing | null>(null)
  useEffect(() => {
    if (listing.status === 'loaded') setShown(listing.value)
  }, [listing])
  const current = listing.status === 'loaded' ? listing.value : shown
  const { products, counts, range } = current ?? { products: [], counts: new Map<string, number>(), range: null }

  const narrowed =
    !!search || !!filters.categoryId || !!filters.priceMin || !!filters.priceMax || filters.minRating !== null
  const sheetCount = (filters.priceMin || filters.priceMax ? 1 : 0) + (filters.minRating !== null ? 1 : 0)
  const cardWidth = Math.floor((Math.min(width, 900) - 16 * 2 - 12) / 2)
  const categories = extras.status === 'loaded' ? extras.value.categories : []

  return (
    <View style={styles.screen}>
      {!isConfigured && <SetupBanner />}
      {current === null ? (
        <LoadState state={listing}>{() => null}</LoadState>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              {extras.status === 'loaded' ? (
                <ReviewStrip rating={extras.value.rating} total={extras.value.total} />
              ) : null}
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.search}
                  placeholder="Search products"
                  value={typed}
                  onChangeText={setTyped}
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel="Search products"
                />
                <Link href="/wishlist" asChild>
                  <Pressable accessibilityRole="link" style={styles.wishlistLink}>
                    <Text style={ui.link}>♥ {saved.length}</Text>
                  </Pressable>
                </Link>
              </View>
              {categories.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <Chip
                    label="All products"
                    active={!filters.categoryId}
                    onPress={() => setFilters({ ...filters, categoryId: null })}
                  />
                  {categories.map((category) => (
                    <Chip
                      key={category.id}
                      label={category.name}
                      count={counts.get(category.id) ?? 0}
                      active={filters.categoryId === category.id}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          categoryId: filters.categoryId === category.id ? null : category.id,
                        })
                      }
                    />
                  ))}
                </ScrollView>
              ) : null}
              <View style={styles.resultsBar}>
                <View style={[ui.row, { gap: 8 }]}>
                  <Text style={ui.muted}>
                    {products.length} {products.length === 1 ? 'product' : 'products'}
                  </Text>
                  {listing.status === 'loading' ? <ActivityIndicator size="small" /> : null}
                  {listing.status === 'failed' ? (
                    <Text style={{ color: shop.sale, fontSize: 13 }}>Couldn't update. Try again.</Text>
                  ) : null}
                </View>
                <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} style={styles.filtersButton}>
                  <Text style={ui.link}>
                    {sheetCount ? `Filters (${sheetCount})` : 'Filters'} ·{' '}
                    {SORTS.find((sort) => sort.value === filters.sort)?.label}
                  </Text>
                </Pressable>
              </View>
              <FiltersSheet
                visible={sheetOpen}
                filters={filters}
                range={range}
                onApply={(next) => {
                  setFilters(next)
                  setSheetOpen(false)
                }}
                onClose={() => setSheetOpen(false)}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{narrowed ? 'No matches' : 'No products yet'}</Text>
              <Text style={[ui.muted, { textAlign: 'center' }]}>
                {narrowed
                  ? 'No products match these filters. Try clearing a filter or broadening your search.'
                  : "Add and publish products in the BD dashboard and they'll appear here."}
              </Text>
              {narrowed ? (
                <Pressable
                  onPress={() => {
                    setTyped('')
                    setSearch('')
                    setFilters({ ...NO_FILTERS, sort: filters.sort })
                  }}
                >
                  <Text style={ui.link}>Clear all filters</Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
        />
      )}
      <CompareBar />
    </View>
  )
}

/**
 * Price, rating and sort, applied together, so the list doesn't reload on
 * every keystroke of a price. The price fields show the catalogue's range.
 */
function FiltersSheet({
  visible,
  filters,
  range,
  onApply,
  onClose,
}: {
  visible: boolean
  filters: Filters
  range: { minDollars: number; maxDollars: number } | null
  onApply: (filters: Filters) => void
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
          {SORTS.map((sort) => (
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
          onPress={() => onApply({ ...NO_FILTERS, sort: draft.sort, categoryId: draft.categoryId })}
        >
          <Text style={[ui.ghostButtonText, { color: shop.sale }]}>Clear price and rating</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  )
}

/** "12.50" → 1250; null for anything that isn't a price. */
function toCents(dollars: string): number | null {
  const value = Number(dollars.trim())
  return dollars.trim() && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  search: { flex: 1, padding: 10, borderWidth: 1, borderColor: shop.border, borderRadius: 10 },
  wishlistLink: { paddingVertical: 8, paddingHorizontal: 4 },
  resultsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filtersButton: { paddingVertical: 6 },
  empty: { padding: 32, gap: 8, alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: shop.text },
  sheet: { padding: 20, gap: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetLabel: { fontWeight: '700', color: shop.text, marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
