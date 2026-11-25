import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native'

import { getBd, isConfigured } from '@/bd/client'
import { useLoad } from '@/bd/useBd'
import { LoadState, SetupBanner } from '@/components/LoadState'
import { CompareBar, type ListedProduct, ProductCard, ReviewStrip } from '@/components/shop'
import {
  CategoryChips,
  NO_STORE_FILTERS,
  StoreEmpty,
  type StoreFilters,
  StoreFiltersSheet,
  StoreResultsBar,
  StoreSearchField,
  WishlistLink,
} from '@/components/store-parts'
import { useSavedList, wishlist } from '@/shop/saved'

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
  const [filters, setFilters] = useState<StoreFilters>(NO_STORE_FILTERS)
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
                <StoreSearchField value={typed} onChange={setTyped} />
                <WishlistLink count={saved.length} />
              </View>
              <CategoryChips
                categories={categories}
                counts={counts}
                selected={filters.categoryId}
                onSelect={(categoryId) => setFilters({ ...filters, categoryId })}
              />
              <StoreResultsBar
                count={products.length}
                loading={listing.status === 'loading'}
                failed={listing.status === 'failed'}
                filterCount={sheetCount}
                sort={filters.sort}
                onFilters={() => setSheetOpen(true)}
              />
              <StoreFiltersSheet
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
            <StoreEmpty
              narrowed={narrowed}
              onClear={() => {
                setTyped('')
                setSearch('')
                setFilters({ ...NO_STORE_FILTERS, sort: filters.sort })
              }}
            />
          }
          renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
        />
      )}
      <CompareBar />
    </View>
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
})
