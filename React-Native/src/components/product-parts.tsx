import { Image, Pressable, ScrollView, Share, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native'

import { cents } from '@/bd/money'
import { shop, Stars, styles as ui } from '@/components/shop'
import { formatDollars, type OptionGroup, type Price, type ProductView } from '@/shop/shop'

// The product page's parts. `app/product/[id].tsx` lays them out; each takes
// plain values and callbacks, so you can move, restyle, drop or replace any
// of them, or lay out a product page of your own. The rules (the price for a
// style and options, its photos, which options it has) are `src/shop/shop.ts`.
// The save buttons, the rails and the stars are in `shop.tsx`.

/** A product review (`storefront.getProductReviews`). */
export type ProductReview = {
  id: string
  rating: number
  title?: string | null
  body?: string | null
  content?: string | null
  reviewerName?: string | null
  createdAt?: string | null
}

export type ProductReviewPage = { items: ProductReview[]; avgRating?: number | null; totalCount: number }

/** An add-on (`storefront.getProductAddons`). */
export type Addon = {
  id: string
  addonProductId: string
  addonName: string
  addonDescription?: string | null
  groupLabel?: string | null
  priceCents?: number | null
  originalPriceCents?: number | null
  imageUrl?: string | null
  /** Each with its `variantId` (or `id`); an add-on goes in as its first. */
  variants?: Record<string, unknown>[] | null
}

/** The style's photos, swiped, each [width] square. */
export function ProductGallery({ urls, name, width }: { urls: string[]; name: string; width: number }) {
  if (urls.length === 0) return null
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width }}>
      {urls.map((url) => (
        <Image
          key={url}
          source={{ uri: url }}
          style={{ width, height: width, borderRadius: 14, backgroundColor: shop.soft }}
          resizeMode="cover"
          accessibilityLabel={name}
        />
      ))}
    </ScrollView>
  )
}

/** The category over the product's name. */
export function ProductTitle({ categoryName, name }: { categoryName?: string | null; name: string }) {
  return (
    <View style={{ gap: 6 }}>
      {categoryName ? <Text style={ui.muted}>{categoryName}</Text> : null}
      <Text style={styles.name}>{name}</Text>
    </View>
  )
}

/** The price for the style and options chosen: "From $120.00" until every option is chosen. */
export function ProductPriceText({ price }: { price: Price }) {
  return (
    <Text style={styles.price}>
      {price.amount === null ? 'Unavailable' : `${price.from ? 'From ' : ''}${formatDollars(price.amount)}`}
    </Text>
  )
}

/** "Only 3 left" when five or fewer are left; nothing otherwise. */
export function StockNote({ stock }: { stock: number | null }) {
  if (stock === null || stock <= 0 || stock > 5) return null
  return <Text style={{ color: shop.sale, fontWeight: '600' }}>Only {stock} left</Text>
}

/** A choice in an `OptionRow`: a style, or a size. */
export type ChoiceOption = { id: string; label: string; available: boolean }

/** A titled row of choices. Sold-out ones are struck through and can't be chosen. */
export function OptionRow({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string
  options: ChoiceOption[]
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

/** The product's styles, when it has more than one. */
export function VariantPicker({
  variants,
  selected,
  onSelect,
}: {
  variants: ProductView['variants']
  selected: string | null
  onSelect: (id: string) => void
}) {
  if (variants.length <= 1) return null
  return (
    <OptionRow
      title="Style"
      options={variants.map((variant) => ({ id: variant.id, label: variant.name, available: variant.available }))}
      selected={selected}
      onSelect={onSelect}
    />
  )
}

/** One of the style's option groups: Size, then its values. */
export function OptionPicker({
  group,
  selected,
  onSelect,
}: {
  group: OptionGroup
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <OptionRow
      title={group.title}
      options={group.values.map((value) => ({ id: value.id, label: value.value, available: value.available }))}
      selected={selected}
      onSelect={onSelect}
    />
  )
}

/** − 1 +, between 1 and [max]. */
export function QuantityStepper({
  quantity,
  max,
  onChange,
}: {
  quantity: number
  max: number
  onChange: (quantity: number) => void
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="One fewer"
        disabled={quantity <= 1}
        onPress={() => onChange(Math.max(1, quantity - 1))}
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
        disabled={quantity >= max}
        onPress={() => onChange(Math.min(max, quantity + 1))}
        style={styles.stepButton}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  )
}

/**
 * Add to cart once the price is ready; until then it says why not: Choose
 * options, or Unavailable. Adding… while it goes.
 */
export function AddToCartButton({
  price,
  adding,
  hasOptions,
  disabled = false,
  onPress,
  style,
}: {
  price: Price
  adding: boolean
  hasOptions: boolean
  disabled?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!price.ready || adding || disabled}
      onPress={onPress}
      style={[ui.button, style, (!price.ready || adding) && { opacity: 0.5 }]}
    >
      <Text style={ui.buttonText}>
        {adding ? 'Adding…' : price.ready ? 'Add to cart' : hasOptions ? 'Choose options' : 'Unavailable'}
      </Text>
    </Pressable>
  )
}

/** What happened, under the button: added, or what went wrong. */
export function ProductNotice({ text, ok }: { text: string; ok: boolean }) {
  return <Text style={{ color: ok ? shop.ok : shop.sale }}>{text}</Text>
}

/** Share the product's page on your web store. */
export function ShareButton({ title, url }: { title: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={styles.share}
      onPress={() => void Share.share({ message: `${title} ${url}`, url })}
    >
      <Text style={ui.link}>Share</Text>
    </Pressable>
  )
}

/** The description, Features, and the spec tables. Nothing when the product has none. */
export function ProductDetails({
  description,
  features,
  specs,
}: {
  description: string
  features: string[]
  specs: ProductView['specs']
}) {
  if (!description && features.length === 0 && specs.length === 0) return null
  return (
    <View style={{ gap: 16 }}>
      {description ? <Text style={styles.body}>{description}</Text> : null}

      {features.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={ui.sectionTitle}>Features</Text>
          {features.map((feature) => (
            <Text key={feature} style={styles.body}>
              • {feature}
            </Text>
          ))}
        </View>
      ) : null}

      {specs.map((group) => (
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
    </View>
  )
}

/**
 * Add-ons, each added to the cart on its own, under the first one's group
 * label or "Complete your {product}". [added] holds the ids already added.
 */
export function ProductAddons({
  addons,
  productName,
  added,
  disabled = false,
  onAdd,
}: {
  addons: Addon[]
  productName: string
  added: string[]
  disabled?: boolean
  onAdd: (addon: Addon) => void
}) {
  if (addons.length === 0) return null
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.sectionTitle}>{addons[0].groupLabel || `Complete your ${productName}`}</Text>
      {addons.map((addon) => (
        <AddonRow
          key={addon.id}
          addon={addon}
          added={added.includes(addon.id)}
          disabled={disabled}
          onAdd={() => onAdd(addon)}
        />
      ))}
    </View>
  )
}

/** An add-on: its photo, name and price (struck-through was-price on sale), and Add. */
export function AddonRow({
  addon,
  added,
  disabled = false,
  onAdd,
}: {
  addon: Addon
  added: boolean
  disabled?: boolean
  onAdd: () => void
}) {
  return (
    <View style={styles.addon}>
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
      <Pressable accessibilityRole="button" disabled={added || disabled} onPress={onAdd} style={ui.ghostButton}>
        <Text style={ui.ghostButtonText}>{added ? 'Added' : 'Add'}</Text>
      </Pressable>
    </View>
  )
}

/** The product's reviews: the average and count, the reviews, and "Show more reviews" while there are more. */
export function ProductReviews({ page, onMore }: { page: ProductReviewPage; onMore: () => void }) {
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
        <ProductReviewRow key={review.id} review={review} />
      ))}
      {page.totalCount > page.items.length ? (
        <Pressable accessibilityRole="button" onPress={onMore} style={ui.ghostButton}>
          <Text style={ui.ghostButtonText}>Show more reviews</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/** One product review: stars, who and when, the title and what they said. */
export function ProductReviewRow({ review }: { review: ProductReview }) {
  return (
    <View style={styles.review}>
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
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 24, fontWeight: '800', color: shop.text },
  price: { fontSize: 20, fontWeight: '700', color: shop.text, fontVariant: ['tabular-nums'] },
  body: { color: shop.text, lineHeight: 21 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: shop.border, borderRadius: 10 },
  stepButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, color: shop.text },
  quantity: { minWidth: 28, textAlign: 'center', fontWeight: '700', fontVariant: ['tabular-nums'] },
  share: { paddingVertical: 8, paddingHorizontal: 4 },
  specRow: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: shop.border },
  addon: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: shop.border, borderRadius: 12 },
  addonImage: { width: 52, height: 52, borderRadius: 8, backgroundColor: shop.soft },
  review: { gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: shop.border },
})
