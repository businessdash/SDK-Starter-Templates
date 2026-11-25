import { Link, useNavigation } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { getBd } from '@/bd/client'
import { Chip, shop, styles as ui } from '@/components/shop'
import { formatPostDate, readingMinutes } from '@/shop/blog'

type Post = Awaited<ReturnType<NonNullable<ReturnType<typeof getBd>>['blog']['listPosts']>>['items'][number]
type Category = { id: string; name: string; description?: string | null }

const PAGE_SIZE = 12

/**
 * The blog: category and tag filters, pinned posts first, older posts on
 * demand. The API filters by category only, so a tag is matched here, over
 * the newest 50 posts — the same rule as the web and Swift starters.
 */
export default function BlogScreen() {
  const navigation = useNavigation()
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [cursor, setCursor] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    const bd = getBd()
    if (!bd) return
    void bd.blog
      .listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => {})
    void bd.blog
      .listTags()
      .then((res) => setTags(res.items))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const bd = getBd()
    if (!bd) {
      setPosts([])
      return
    }
    let alive = true
    setPosts(null)
    setFailed(false)
    bd.blog
      .listPosts({ limit: tag ? 50 : PAGE_SIZE, ...(categoryId ? { categoryId } : {}) })
      .then((page) => {
        if (!alive) return
        const matched = page.items.filter((post) => !tag || (post.tags ?? []).includes(tag))
        // Pinned first; the rest keep their order.
        setPosts([...matched.filter((post) => post.isPinned), ...matched.filter((post) => !post.isPinned)])
        setCursor(tag ? null : (page.nextCursor ?? null))
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [categoryId, tag])

  const active = categories.find((category) => category.id === categoryId) ?? null
  useEffect(() => {
    navigation.setOptions({ title: active?.name ?? 'Blog' })
  }, [navigation, active])

  async function loadOlder() {
    const bd = getBd()
    if (!bd || cursor === null || !posts) return
    setLoadingMore(true)
    try {
      const page = await bd.blog.listPosts({ limit: PAGE_SIZE, cursor, ...(categoryId ? { categoryId } : {}) })
      const shown = new Set(posts.map((post) => post.id))
      setPosts([...posts, ...page.items.filter((post) => !shown.has(post.id))])
      setCursor(page.nextCursor ?? null)
    } catch {
      // The button stays; trying again is the answer.
    } finally {
      setLoadingMore(false)
    }
  }

  const unfiltered = categoryId === null && tag === null

  return (
    <FlatList
      style={{ backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: 16, gap: 20 }}
      data={posts ?? []}
      keyExtractor={(post) => post.id}
      ListHeaderComponent={
        categories.length > 0 || tags.length > 0 ? (
          <View style={{ gap: 10 }}>
            {categories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Chip label="All" active={categoryId === null} onPress={() => setCategoryId(null)} />
                {categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    active={categoryId === category.id}
                    onPress={() => setCategoryId(category.id)}
                  />
                ))}
              </ScrollView>
            ) : null}
            {tags.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {tags.map((value) => (
                  <Chip
                    key={value}
                    label={`#${value}`}
                    active={tag === value}
                    onPress={() => setTag(tag === value ? null : value)}
                  />
                ))}
              </ScrollView>
            ) : null}
            {active?.description ? <Text style={ui.muted}>{active.description}</Text> : null}
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        failed ? (
          <Text style={ui.muted}>The blog isn't available right now. Please check back soon.</Text>
        ) : posts ? (
          <View style={styles.empty}>
            <Text style={ui.sectionTitle}>No posts here yet</Text>
            <Text style={[ui.muted, { textAlign: 'center' }]}>
              {unfiltered ? "Write one in Business Dash and it'll appear here." : 'Try another topic.'}
            </Text>
          </View>
        ) : (
          <ActivityIndicator style={{ padding: 24 }} />
        )
      }
      renderItem={({ item, index }) => <PostRow post={item} lead={index === 0 && unfiltered} />}
      ListFooterComponent={
        cursor !== null && posts && posts.length > 0 ? (
          <Pressable accessibilityRole="button" disabled={loadingMore} onPress={loadOlder} style={ui.ghostButton}>
            <Text style={ui.ghostButtonText}>{loadingMore ? 'Loading…' : 'Older posts'}</Text>
          </Pressable>
        ) : undefined
      }
    />
  )
}

/** A post in the list; the newest on the first page is drawn larger. */
function PostRow({ post, lead }: { post: Post; lead: boolean }) {
  return (
    <Link href={{ pathname: '/blog/[slug]', params: { slug: post.slug } }} asChild>
      <Pressable accessibilityRole="link" style={{ gap: 6 }}>
        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            style={[styles.cover, { height: lead ? 190 : 130 }]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View style={ui.row}>
          {post.isPinned ? <Text style={styles.pinned}>Pinned</Text> : null}
          <Text style={styles.meta}>
            {formatPostDate(post.publishedAt)} · {readingMinutes(post.content || post.excerpt || '')} min read
          </Text>
        </View>
        <Text style={lead ? styles.leadTitle : styles.title}>{post.title}</Text>
        {post.excerpt ? (
          <Text style={ui.muted} numberOfLines={3}>
            {post.excerpt}
          </Text>
        ) : null}
        {post.authorName ? <Text style={styles.author}>{post.authorName}</Text> : null}
      </Pressable>
    </Link>
  )
}

const styles = StyleSheet.create({
  empty: { padding: 32, gap: 8, alignItems: 'center' },
  cover: { width: '100%', borderRadius: 12, backgroundColor: shop.soft },
  pinned: {
    fontSize: 11,
    fontWeight: '700',
    color: shop.accent,
    backgroundColor: shop.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 6,
  },
  meta: { fontSize: 12, color: shop.muted },
  title: { fontSize: 17, fontWeight: '700', color: shop.text },
  leadTitle: { fontSize: 21, fontWeight: '800', color: shop.text },
  author: { fontSize: 12, fontWeight: '600', color: shop.text },
})
