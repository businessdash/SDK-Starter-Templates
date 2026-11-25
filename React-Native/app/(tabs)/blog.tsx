import { useNavigation } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'

import { getBd } from '@/bd/client'
import { BlogFilters, type BlogListPost, PostCard } from '@/components/blog-parts'
import { EmptyNote, styles as ui } from '@/components/shop'

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
  const [posts, setPosts] = useState<BlogListPost[] | null>(null)
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
            <BlogFilters
              categories={categories}
              tags={tags}
              categoryId={categoryId}
              tag={tag}
              onCategory={setCategoryId}
              onTag={setTag}
            />
            {active?.description ? <Text style={ui.muted}>{active.description}</Text> : null}
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        failed ? (
          <Text style={ui.muted}>The blog isn't available right now. Please check back soon.</Text>
        ) : posts ? (
          <EmptyNote
            title="No posts here yet"
            detail={unfiltered ? "Write one in Business Dash and it'll appear here." : 'Try another topic.'}
          />
        ) : (
          <ActivityIndicator style={{ padding: 24 }} />
        )
      }
      renderItem={({ item, index }) => <PostCard post={item} lead={index === 0 && unfiltered} />}
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
