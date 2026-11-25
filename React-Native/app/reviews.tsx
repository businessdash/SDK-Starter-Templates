import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { getBd } from '@/bd/client'
import { ReviewCard, ReviewSourceFilter, ReviewSummaryCard } from '@/components/review-parts'
import { styles as ui } from '@/components/shop'
import {
  type BundleReviewTotals,
  REVIEW_PAGE_SIZE,
  type ReviewSource,
  type ReviewSummary,
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
          <ReviewSummaryCard summary={summary} />
          {sources.length > 1 ? <ReviewSourceFilter sources={sources} selected={source} onSelect={setSource} /> : null}
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

const styles = StyleSheet.create({
  empty: { padding: 24 },
})
