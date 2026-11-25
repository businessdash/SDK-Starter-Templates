import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { noteCart } from '@/bd/cart-count'
import { getBd } from '@/bd/client'
import { useLoad, useVisitorToken } from '@/bd/useBd'
import { LoadState } from '@/components/LoadState'
import {
  type Addon,
  AddToCartButton,
  OptionPicker,
  ProductAddons,
  ProductDetails,
  ProductGallery,
  ProductNotice,
  ProductPriceText,
  type ProductReviewPage,
  ProductReviews,
  ProductTitle,
  QuantityStepper,
  ShareButton,
  StockNote,
  VariantPicker,
} from '@/components/product-parts'
import { ProductRail, SaveButtons, shop } from '@/components/shop'
import { recentlyViewed, type SavedProduct } from '@/shop/saved'
import {
  chosenOptions,
  defaultVariant,
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
  const [reviews, setReviews] = useState<ProductReviewPage | null>(null)
  useEffect(() => {
    const bd = getBd()
    if (!bd || !id) return
    let alive = true
    bd.storefront
      .getProductReviews(id, { limit: Math.min(reviewLimit, 100) })
      .then((page) => {
        if (alive) setReviews(page as ProductReviewPage)
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
                <ProductReviews page={reviews} onMore={() => setReviewLimit((limit) => limit + REVIEWS_PAGE)} />
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
      <ProductGallery urls={gallery} name={view.name} width={width} />

      <View style={{ gap: 6 }}>
        <ProductTitle categoryName={view.categoryName} name={view.name} />
        <ProductPriceText price={price} />
        <StockNote stock={price.stock} />
      </View>

      <VariantPicker
        variants={view.variants}
        selected={variantId}
        onSelect={(next) => {
          if (next === variantId) return
          setVariantId(next)
          setChosen({})
          setQuantity(1)
          setMessage(null)
        }}
      />

      {groups.map((group) => (
        <OptionPicker
          key={group.id}
          group={group}
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
        <QuantityStepper quantity={quantity} max={most} onChange={setQuantity} />
        <AddToCartButton
          price={price}
          adding={adding}
          hasOptions={groups.length > 0}
          disabled={!visitorToken}
          onPress={addToCart}
          style={{ flex: 1 }}
        />
      </View>
      {message ? <ProductNotice text={message.text} ok={message.ok} /> : null}

      <View style={styles.actions}>
        <SaveButtons product={summary(view, variantId)} />
        {SITE_URL ? <ShareButton title={view.name} url={`${SITE_URL}/store/${encodeURIComponent(view.id)}`} /> : null}
      </View>

      <ProductDetails description={view.description} features={view.features} specs={view.specs} />

      <ProductAddons
        addons={addons}
        productName={view.name}
        added={addedAddons}
        disabled={!visitorToken}
        onAdd={(addon) => void addAddon(addon)}
      />
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
  note: { color: shop.muted, padding: 16 },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
})
