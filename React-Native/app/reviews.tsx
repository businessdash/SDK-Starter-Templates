import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { getBd } from '@/bd/client'
import { portalFor, useCustomer } from '@/bd/customer'
import { Chip, shop, styles as ui } from '@/components/shop'
import {
  type BundleReviewTotals,
  checkReview,
  formatReviewDate,
  platformName,
  REVIEW_MAX_LENGTH,
  REVIEW_PAGE_SIZE,
  REVIEW_SENT,
  type ReviewSource,
  type ReviewSummary,
  reviewerInitial,
  reviewerName,
  reviewLink,
  reviewStars,
  safeImage,
  sourceLabel,
  sourcesIn,
  summarizeReviews,
  type WallReview,
} from '@/shop/reviews'

type Page = { reviews: WallReview[]; nextOffset: number | null }

/**
 * The business's reviews: the average with a bar per star, a platform
 * filter, each review with its photos, Verified and a link to it on Google or
 * Yelp, "Show more", and writing one (signed-in customers; the business
 * approves it first). The rules are `src/shop/reviews.ts`, the same in every
 * BD starter.
 */
export default function ReviewsScreen() {
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [sources, setSources] = useState<ReviewSource[]>([])
  const [source, setSource] = useState<ReviewSource | null>(null)
  const [page, setPage] = useState<Page | null>(null)
  const [failed, setFailed] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // The rating and its star counts ride the marketing bundle; the platforms
  // are learned from the unfiltered list.
  useEffect(() => {
    const bd = getBd()
    if (!bd) return
    void Promise.all([
      bd.marketing.getPageBundle({ pageKey: 'home', locale: 'en' }).catch(() => null),
      bd.reviews.list({ limit: 50 }).catch(() => null),
    ]).then(([bundle, all]) => {
      const totals = (bundle as { reviews?: BundleReviewTotals | null } | null)?.reviews
      setSummary(summarizeReviews(totals, all?.totalCount ?? 0))
      setSources(sourcesIn((all?.items ?? []) as WallReview[]))
    })
  }, [])

  useEffect(() => {
    const bd = getBd()
    if (!bd) {
      setPage({ reviews: [], nextOffset: null })
      return
    }
    let alive = true
    setPage(null)
    setFailed(false)
    bd.reviews
      .list({ limit: REVIEW_PAGE_SIZE, ...(source ? { source } : {}) })
      .then((res) => alive && setPage({ reviews: res.items as WallReview[], nextOffset: res.nextOffset ?? null }))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [source])

  async function showMore() {
    const bd = getBd()
    if (!bd || !page || page.nextOffset === null) return
    setLoadingMore(true)
    try {
      const next = await bd.reviews.list({
        limit: REVIEW_PAGE_SIZE,
        offset: page.nextOffset,
        ...(source ? { source } : {}),
      })
      const shown = new Set(page.reviews.map((review) => review.id))
      setPage({
        reviews: [...page.reviews, ...(next.items as WallReview[]).filter((review) => !shown.has(review.id))],
        nextOffset: next.nextOffset ?? null,
      })
    } catch {
      // The button stays; trying again is the answer.
    } finally {
      setLoadingMore(false)
    }
  }

  if (!getBd()) {
    return (
      <View style={styles.empty}>
        <Text style={ui.muted}>
          Reviews aren't connected yet. Set EXPO_PUBLIC_BD_SITE_ID and EXPO_PUBLIC_BD_PK, and your rating and reviews
          appear here.
        </Text>
      </View>
    )
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      data={page?.reviews ?? []}
      keyExtractor={(review) => review.id}
      ListHeaderComponent={
        <View style={{ gap: 14 }}>
          <SummaryCard summary={summary} />
          {sources.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label="All" active={source === null} onPress={() => setSource(null)} />
              {sources.map((value) => (
                <Chip key={value} label={sourceLabel(value)} active={source === value} onPress={() => setSource(value)} />
              ))}
            </ScrollView>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        failed ? (
          <Text style={ui.muted}>Reviews aren't available right now. Please check back soon.</Text>
        ) : page ? (
          <Text style={ui.muted}>
            {source
              ? `No ${sourceLabel(source)} reviews yet.`
              : "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."}
          </Text>
        ) : (
          <ActivityIndicator style={{ padding: 24 }} />
        )
      }
      renderItem={({ item }) => <ReviewCard review={item} />}
      ListFooterComponent={
        page && page.nextOffset !== null ? (
          <Pressable accessibilityRole="button" disabled={loadingMore} onPress={showMore} style={ui.ghostButton}>
            <Text style={ui.ghostButtonText}>{loadingMore ? 'Loading…' : 'Show more reviews'}</Text>
          </Pressable>
        ) : undefined
      }
    />
  )
}

/** The average, a bar per star, and writing a review. */
function SummaryCard({ summary }: { summary: ReviewSummary | null }) {
  return (
    <View style={styles.summary}>
      {summary?.average != null ? (
        <>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={styles.average}>{summary.average.toFixed(1)}</Text>
            <Text
              style={styles.stars}
              accessibilityRole="image"
              accessibilityLabel={`${summary.average.toFixed(1)} out of 5`}
            >
              {reviewStars(summary.average)}
            </Text>
            <Text style={ui.muted}>
              {summary.total} {summary.total === 1 ? 'review' : 'reviews'}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            {summary.histogram.map((row) => (
              <View
                key={row.stars}
                style={styles.bar}
                accessible
                accessibilityLabel={`${row.stars} ${row.stars === 1 ? 'star' : 'stars'}: ${row.count}`}
              >
                <Text style={styles.barLabel}>{row.stars} ★</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(row.share * 100)}%` }]} />
                </View>
                <Text style={styles.barCount}>{row.count}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
      <ReviewWriter />
    </View>
  )
}

function ReviewCard({ review }: { review: WallReview }) {
  const avatar = safeImage(review.reviewerImageUrl)
  const platform = platformName(review.source)
  const link = reviewLink(review)
  const photos = (review.photos ?? []).map(safeImage).filter((photo): photo is string => photo !== null)
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.avatar, styles.initial]} accessibilityElementsHidden>
            <Text style={styles.initialText}>{reviewerInitial(review)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{reviewerName(review)}</Text>
          <Text style={ui.muted}>
            <Text style={styles.cardStars} accessibilityLabel={`${review.rating} out of 5`}>
              {reviewStars(review.rating)}
            </Text>{' '}
            · {formatReviewDate(review.timeCreated)}
          </Text>
        </View>
      </View>
      <Text style={styles.text}>{review.text}</Text>
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.map((photo) => (
            <Image key={photo} source={{ uri: photo }} style={styles.photo} accessibilityLabel="Photo from the reviewer" />
          ))}
        </ScrollView>
      ) : null}
      {platform || review.verified ? (
        <View style={styles.foot}>
          {platform ? <Text style={styles.platform}>{platform}</Text> : null}
          {review.verified ? <Text style={styles.verified}>✓ Verified</Text> : null}
          {link && platform ? (
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(link)} style={{ marginLeft: 'auto' }}>
              <Text style={ui.link}>Read on {platform}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/**
 * Writing a review: stars, an optional title and the review, checked with
 * the shared rules and sent as the signed-in customer. Signed out, it's a
 * way to the Account tab to sign in.
 */
function ReviewWriter() {
  const { customer, refresh } = useCustomer()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // Coming back from signing in on the Account tab.
  useFocusEffect(useCallback(() => refresh(), []))

  if (customer === undefined) return null
  if (sent) return <Text style={{ color: shop.ok, fontWeight: '600' }}>{REVIEW_SENT}</Text>
  if (!customer) {
    return (
      <Pressable accessibilityRole="link" style={ui.ghostButton} onPress={() => router.navigate('/account')}>
        <Text style={[ui.ghostButtonText, { color: shop.accent }]}>Sign in to write a review</Text>
      </Pressable>
    )
  }
  if (!open) {
    return (
      <Pressable accessibilityRole="button" style={ui.button} onPress={() => setOpen(true)}>
        <Text style={ui.buttonText}>Write a review</Text>
      </Pressable>
    )
  }

  async function send() {
    if (!customer) return
    const checked = checkReview({ rating, title, body })
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    const portal = portalFor(customer)
    if (!portal) return
    setSending(true)
    setError(null)
    try {
      await portal.submitReview(checked.review)
      setSent(true)
    } catch {
      setError("Couldn't send your review. Try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontWeight: '700', color: shop.text }}>Your rating</Text>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((stars) => (
          <Pressable
            key={stars}
            accessibilityRole="radio"
            accessibilityLabel={`${stars} ${stars === 1 ? 'star' : 'stars'}`}
            accessibilityState={{ checked: rating === stars }}
            onPress={() => setRating(stars)}
            hitSlop={4}
          >
            <Text style={[styles.pickStar, stars <= rating && { color: shop.accent }]}>{stars <= rating ? '★' : '☆'}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Title (optional)"
        value={title}
        onChangeText={setTitle}
        maxLength={200}
        accessibilityLabel="Title"
      />
      <TextInput
        style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]}
        placeholder="What was it like?"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={REVIEW_MAX_LENGTH}
        accessibilityLabel="Your review"
      />
      {error ? <Text style={{ color: shop.sale }}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={sending} onPress={send} style={[ui.button, sending && { opacity: 0.6 }]}>
        <Text style={ui.buttonText}>{sending ? 'Sending…' : 'Send review'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { padding: 24 },
  summary: { gap: 16, padding: 16, borderWidth: 1, borderColor: shop.border, borderRadius: 16 },
  average: { fontSize: 48, fontWeight: '800', color: shop.text },
  stars: { color: shop.accent, fontSize: 18, letterSpacing: 2 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 32, color: shop.muted },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: shop.soft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: shop.accent },
  barCount: { width: 28, textAlign: 'right', color: shop.muted, fontVariant: ['tabular-nums'] },
  card: { gap: 10, padding: 14, borderWidth: 1, borderColor: shop.border, borderRadius: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: shop.soft },
  initial: { alignItems: 'center', justifyContent: 'center', backgroundColor: shop.accentSoft },
  initialText: { color: shop.accent, fontWeight: '700' },
  name: { fontWeight: '700', color: shop.text },
  cardStars: { color: shop.accent },
  text: { color: shop.text, lineHeight: 21 },
  photo: { width: 88, height: 88, borderRadius: 8, backgroundColor: shop.soft },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  platform: { fontSize: 12, fontWeight: '600', color: shop.muted },
  verified: { fontSize: 12, fontWeight: '600', color: shop.ok },
  input: { padding: 10, borderWidth: 1, borderColor: shop.border, borderRadius: 10 },
  pickStar: { fontSize: 30, color: shop.muted },
})
