import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

import { noteCart } from '@/bd/cart-count'
import { getBd } from '@/bd/client'
import { cents } from '@/bd/money'
import { useLoad, useVisitorToken } from '@/bd/useBd'
import { LoadState } from '@/components/LoadState'
import { ProductRail, SaveButtons, shop, Stars, styles as ui } from '@/components/shop'
import { recentlyViewed, type SavedProduct } from '@/shop/saved'
import {
  chosenOptions,
  defaultVariant,
  formatDollars,
  galleryFor,
  optionGroupsFor,
  priceFor,
  type ProductView,
  toProductView,
} from '@/shop/shop'

/** Reviews shown at first, and how many more each "Show more" adds. */
const REVIEWS_PAGE = 10

/** The web store's address, for Share (e.g. https://example.com). */
const SITE_URL = process.env.EXPO_PUBLIC_BD_SITE_URL?.replace(/\/+$/, '') ?? null

type ProductReview = {
  id: string
  rating: number
  title?: string | null
  body?: string | null
  content?: string | null
  reviewerName?: string | null
  createdAt?: string | null
}

type ReviewPage = { items: ProductReview[]; avgRating?: number | null; totalCount: number }

type Addon = {
  id: string
  addonProductId: string
  addonName: string
  addonDescription?: string | null
  groupLabel?: string | null
  priceCents?: number | null
  originalPriceCents?: number | null
  imageUrl?: string | null
  /** Each with its `id`; an add-on goes in as its first. */
  variants?: Record<string, unknown>[] | null
}

/**
 * One product: photos for the chosen option, option and size buttons, the
 * price for what's chosen, quantity, add to cart, save and compare, share,
 * details and specs, add-ons, reviews and the rails. The rules (which photos,
 * what "from" means) are the web starters' (`src/shop/shop.ts`).
 */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { width } = useWindowDimensions()
  const visitorToken = useVisitorToken()
  const [reviewLimit, setReviewLimit] = useState(REVIEWS_PAGE)
  const [recent, setRecent] = useState<SavedProduct[]>([])

  const state = useLoad(async () => {
    const bd = getBd()
    if (!bd || !id) return null
    const product = await bd.storefront.getProduct(id)
    const [addons, related] = await Promise.all([
      bd.storefront
        .getProductAddons(id)
        .then((res) => (res.items ?? []) as Addon[])
        .catch(() => [] as Addon[]),
      bd.storefront
        .getRelatedProducts(id, { limit: 6 })
        .then((res) =>
          (res.items ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            image: item.coverImageUrl ?? null,
            priceCents: item.minPriceDollars != null ? Math.round(item.minPriceDollars * 100) : null,
          })),
        )
        .catch(() => [] as SavedProduct[]),
    ])
    return { view: toProductView(product), addons, related }
  }, [id])

  // "Show more" asks for a longer page; the reviews shown stay until it comes.
  const [reviews, setReviews] = useState<ReviewPage | null>(null)
  useEffect(() => {
    const bd = getBd()
    if (!bd || !id) return
    let alive = true
    bd.storefront
      .getProductReviews(id, { limit: Math.min(reviewLimit, 100) })
      .then((page) => {
        if (alive) setReviews(page as ReviewPage)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [id, reviewLimit])

  // What was viewed before this one, then this one goes first.
  useEffect(() => {
    if (state.status !== 'loaded' || !state.value) return
    const { view } = state.value
    setRecent(recentlyViewed.items().filter((item) => item.id !== view.id))
    recentlyViewed.add(summary(view, defaultVariant(view)?.id ?? ''))
  }, [state])

  return (
    <LoadState state={state}>
      {(loaded) =>
        loaded ? (
          <>
            <Stack.Screen options={{ title: loaded.view.name }} />
            <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
              <ProductBody
                view={loaded.view}
                addons={loaded.addons}
                width={Math.min(width, 700) - 32}
                visitorToken={visitorToken}
              />
              {reviews ? (
                <ReviewsBlock page={reviews} onMore={() => setReviewLimit((limit) => limit + REVIEWS_PAGE)} />
              ) : null}
              <ProductRail title="You may also like" products={loaded.related} />
              <ProductRail title="Recently viewed" products={recent} />
            </ScrollView>
          </>
        ) : (
          <ScrollView contentInsetAdjustmentBehavior="automatic">
            <Text style={styles.note}>Product not found.</Text>
          </ScrollView>
        )
      }
    </LoadState>
  )
}

function ProductBody({
  view,
  addons,
  width,
  visitorToken,
}: {
  view: ProductView
  addons: Addon[]
  width: number
  visitorToken: string | null
}) {
  const [variantId, setVariantId] = useState(defaultVariant(view)?.id ?? '')
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [addedAddons, setAddedAddons] = useState<string[]>([])

  const gallery = useMemo(() => galleryFor(view, variantId), [view, variantId])
  const groups = useMemo(() => optionGroupsFor(view, variantId), [view, variantId])
  const price = priceFor(view, variantId, chosen)
  const most = price.stock && price.stock > 0 ? price.stock : 99

  async function addToCart() {
    const bd = getBd()
    if (!bd || !visitorToken) return
    setAdding(true)
    setMessage(null)
    try {
      const options = chosenOptions(view, variantId, chosen)
      const cart = await bd.cart.forVisitor(visitorToken).addItem({
        productId: view.id,
        quantity,
        ...(variantId ? { variantId } : {}),
        ...(options ? { options } : {}),
      })
      noteCart(cart)
      setMessage({ text: `Added ${quantity} to your cart.`, ok: true })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Couldn't add that to your cart. Try again.", ok: false })
    } finally {
      setAdding(false)
    }
  }

  /** An add-on goes in as one of its first variant. */
  async function addAddon(addon: Addon) {
    const bd = getBd()
    if (!bd || !visitorToken) return
    try {
      // The variant rows' id is `variantId`; `id` is read too, as the web starters do.
      const first = addon.variants?.[0]
      const id = first?.variantId ?? first?.id
      const variant = typeof id === 'string' && id ? id : undefined
      const cart = await bd.cart.forVisitor(visitorToken).addItem({
        productId: addon.addonProductId,
        quantity: 1,
        ...(variant ? { variantId: variant } : {}),
      })
      noteCart(cart)
      setAddedAddons((ids) => [...ids, addon.id])
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Couldn't add that to your cart. Try again.", ok: false })
    }
  }

  return (
    <View style={{ gap: 16 }}>
      {gallery.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width }}>
          {gallery.map((url) => (
            <Image
              key={url}
              source={{ uri: url }}
              style={{ width, height: width, borderRadius: 14, backgroundColor: shop.soft }}
              resizeMode="cover"
              accessibilityLabel={view.name}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ gap: 6 }}>
        {view.categoryName ? <Text style={ui.muted}>{view.categoryName}</Text> : null}
        <Text style={styles.name}>{view.name}</Text>
        <Text style={styles.price}>
          {price.amount === null ? 'Unavailable' : `${price.from ? 'From ' : ''}${formatDollars(price.amount)}`}
        </Text>
        {price.stock !== null && price.stock > 0 && price.stock <= 5 ? (
          <Text style={{ color: shop.sale, fontWeight: '600' }}>Only {price.stock} left</Text>
        ) : null}
      </View>

      {view.variants.length > 1 ? (
        <OptionRow
          title="Style"
          options={view.variants.map((variant) => ({ id: variant.id, label: variant.name, available: variant.available }))}
          selected={variantId}
          onSelect={(next) => {
            if (next === variantId) return
            setVariantId(next)
            setChosen({})
            setQuantity(1)
            setMessage(null)
          }}
        />
      ) : null}

      {groups.map((group) => (
        <OptionRow
          key={group.id}
          title={group.title}
          options={group.values.map((value) => ({
            id: value.id,
            label: value.value,
            available: value.available,
          }))}
          selected={chosen[group.id] ?? null}
          onSelect={(valueId) => {
            const next = { ...chosen, [group.id]: valueId }
            setChosen(next)
            setMessage(null)
            // Never more than there is.
            const stock = priceFor(view, variantId, next).stock
            if (stock && stock > 0) setQuantity((q) => Math.min(q, stock))
          }}
        />
      ))}

      <View style={styles.buyRow}>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="One fewer"
            disabled={quantity <= 1}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            style={styles.stepButton}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.quantity} accessibilityLabel={`Quantity ${quantity}`}>
            {quantity}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="One more"
            disabled={quantity >= most}
            onPress={() => setQuantity((q) => Math.min(most, q + 1))}
            style={styles.stepButton}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!price.ready || adding || !visitorToken}
          onPress={addToCart}
          style={[ui.button, { flex: 1 }, (!price.ready || adding) && { opacity: 0.5 }]}
        >
          <Text style={ui.buttonText}>
            {adding ? 'Adding…' : price.ready ? 'Add to cart' : groups.length > 0 ? 'Choose options' : 'Unavailable'}
          </Text>
        </Pressable>
      </View>
      {message ? <Text style={{ color: message.ok ? shop.ok : shop.sale }}>{message.text}</Text> : null}

      <View style={styles.actions}>
        <SaveButtons product={summary(view, variantId)} />
        {SITE_URL ? (
          <Pressable
            accessibilityRole="button"
            style={styles.share}
            onPress={() =>
              void Share.share({
                message: `${view.name} ${SITE_URL}/store/${encodeURIComponent(view.id)}`,
                url: `${SITE_URL}/store/${encodeURIComponent(view.id)}`,
              })
            }
          >
            <Text style={ui.link}>Share</Text>
          </Pressable>
        ) : null}
      </View>

      {view.description ? <Text style={styles.body}>{view.description}</Text> : null}

      {view.features.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={ui.sectionTitle}>Features</Text>
          {view.features.map((feature) => (
            <Text key={feature} style={styles.body}>
              • {feature}
            </Text>
          ))}
        </View>
      ) : null}

      {view.specs.map((group) => (
        <View key={group.name} style={{ gap: 4 }}>
          <Text style={ui.sectionTitle}>{group.name}</Text>
          {group.rows.map((row) => (
            <View key={row.label} style={styles.specRow}>
              <Text style={[ui.muted, { flex: 1 }]}>{row.label}</Text>
              <Text style={[styles.body, { flex: 1 }]}>{row.value}</Text>
            </View>
          ))}
        </View>
      ))}

      {addons.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={ui.sectionTitle}>{addons[0].groupLabel || `Complete your ${view.name}`}</Text>
          {addons.map((addon) => {
            const added = addedAddons.includes(addon.id)
            return (
              <View key={addon.id} style={styles.addon}>
                {addon.imageUrl ? <Image source={{ uri: addon.imageUrl }} style={styles.addonImage} /> : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontWeight: '600', color: shop.text }}>{addon.addonName}</Text>
                  <Text style={ui.muted}>
                    {addon.priceCents != null ? cents(addon.priceCents) : ''}
                    {addon.originalPriceCents != null && addon.originalPriceCents !== addon.priceCents ? (
                      <Text style={{ textDecorationLine: 'line-through' }}> {cents(addon.originalPriceCents)}</Text>
                    ) : null}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={added || !visitorToken}
                  onPress={() => void addAddon(addon)}
                  style={ui.ghostButton}
                >
                  <Text style={ui.ghostButtonText}>{added ? 'Added' : 'Add'}</Text>
                </Pressable>
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

/** One row of choices: the product's styles, or an option group (Size…). */
function OptionRow({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string
  options: { id: string; label: string; available: boolean }[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: '700', color: shop.text }}>{title}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const active = option.id === selected
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: !option.available }}
              disabled={!option.available}
              onPress={() => onSelect(option.id)}
              style={[ui.chip, active && ui.chipActive, !option.available && { opacity: 0.4 }]}
            >
              <Text
                style={[
                  ui.chipText,
                  active && ui.chipTextActive,
                  !option.available && { textDecorationLine: 'line-through' },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function ReviewsBlock({ page, onMore }: { page: ReviewPage; onMore: () => void }) {
  if (page.totalCount === 0) {
    return (
      <View style={{ gap: 4 }}>
        <Text style={ui.sectionTitle}>Reviews</Text>
        <Text style={ui.muted}>No reviews yet.</Text>
      </View>
    )
  }
  return (
    <View style={{ gap: 12 }}>
      <View style={ui.row}>
        <Text style={ui.sectionTitle}>Reviews </Text>
        <Stars rating={page.avgRating ?? 0} />
        <Text style={ui.muted}>
          {' '}
          {(page.avgRating ?? 0).toFixed(1)} · {page.totalCount}
        </Text>
      </View>
      {page.items.map((review) => (
        <View key={review.id} style={styles.review}>
          <View style={ui.row}>
            <Stars rating={review.rating} size={12} />
            <Text style={ui.muted}>
              {' '}
              {review.reviewerName || 'A customer'}
              {review.createdAt ? ` · ${new Date(review.createdAt).toLocaleDateString()}` : ''}
            </Text>
          </View>
          {review.title ? <Text style={{ fontWeight: '600', color: shop.text }}>{review.title}</Text> : null}
          <Text style={styles.body}>{review.body || review.content || ''}</Text>
        </View>
      ))}
      {page.totalCount > page.items.length ? (
        <Pressable accessibilityRole="button" onPress={onMore} style={ui.ghostButton}>
          <Text style={ui.ghostButtonText}>Show more reviews</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/** What the saved lists keep of this product. */
function summary(view: ProductView, variantId: string): SavedProduct {
  const price = defaultVariant(view)?.price
  return {
    id: view.id,
    name: view.name,
    image: galleryFor(view, variantId)[0] ?? null,
    priceCents: price != null ? Math.round(price * 100) : null,
  }
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 48 },
  name: { fontSize: 24, fontWeight: '800', color: shop.text },
  price: { fontSize: 20, fontWeight: '700', color: shop.text, fontVariant: ['tabular-nums'] },
  body: { color: shop.text, lineHeight: 21 },
  note: { color: shop.muted, padding: 16 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: shop.border, borderRadius: 10 },
  stepButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, color: shop.text },
  quantity: { minWidth: 28, textAlign: 'center', fontWeight: '700', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  share: { paddingVertical: 8, paddingHorizontal: 4 },
  specRow: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: shop.border },
  addon: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: shop.border, borderRadius: 12 },
  addonImage: { width: 52, height: 52, borderRadius: 8, backgroundColor: shop.soft },
  review: { gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: shop.border },
})
