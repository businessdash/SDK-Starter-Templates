import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native'

import { getBd } from '@/bd/client'
import { useCustomer } from '@/bd/customer'
import { useLoad } from '@/bd/useBd'
import { LoadState } from '@/components/LoadState'
import { PostBody } from '@/components/PostBody'
import { shop, styles as ui } from '@/components/shop'
import { formatPostDate, readingMinutes } from '@/shop/blog'
import { postBlocks } from '@/shop/post-blocks'

type Blog = NonNullable<ReturnType<typeof getBd>>['blog']
type Comment = Awaited<ReturnType<Blog['listComments']>>['items'][number]

/** The web store's address, for Share (e.g. https://example.com). */
const SITE_URL = process.env.EXPO_PUBLIC_BD_SITE_URL?.replace(/\/+$/, '') ?? null

/** The longest comment BD takes. */
const COMMENT_MAX = 5000

/**
 * One post: its body drawn natively (`PostBody`), its call to action and
 * tags, likes, and comments. Liking and commenting are for the signed-in
 * customer; a members-only post asks them to sign in.
 */
export default function PostScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { customer, refresh } = useCustomer()
  const [likes, setLikes] = useState<{ liked: boolean; likesCount: number } | null>(null)
  const [liking, setLiking] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null)

  // Coming back from signing in on the Account tab.
  useFocusEffect(useCallback(() => refresh(), []))

  const token = customer?.token ?? null
  const state = useLoad(async () => {
    const bd = getBd()
    if (!bd || !slug) return null
    // Wait for the sign-in check, so the post loads once: signed in, a
    // members-only post comes with its body.
    if (customer === undefined) return new Promise<never>(() => {})
    const detail = await (token ? bd.blog.withSession(token) : bd.blog).getPost(slug)
    return { post: detail.post, paywalled: detail.access === 'paywall' }
  }, [slug, token, customer === undefined])

  const blocks = useMemo(
    () => (state.status === 'loaded' && state.value ? postBlocks(state.value.post.content) : []),
    [state],
  )

  // Likes say whether this customer liked it, so they wait for the sign-in check.
  useEffect(() => {
    const bd = getBd()
    if (!bd || !slug || customer === undefined) return
    let alive = true
    const blog = token ? bd.blog.withSession(token) : bd.blog
    blog
      .likeStatus(slug)
      .then((res) => alive && setLikes(res))
      .catch(() => {})
    bd.blog
      .listComments(slug, { limit: 50 })
      .then((res) => alive && setComments(res.items))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [slug, token, customer === undefined])

  async function toggleLike() {
    const bd = getBd()
    if (!bd || !token || !slug) return
    setLiking(true)
    try {
      setLikes(await bd.blog.withSession(token).toggleLike(slug))
    } catch {
      // The heart stays as it was.
    } finally {
      setLiking(false)
    }
  }

  async function postComment() {
    const bd = getBd()
    const content = draft.trim()
    if (!bd || !token || !slug || !content) return
    if (content.length > COMMENT_MAX) {
      setNote({ text: 'Comments are up to 5,000 characters.', ok: false })
      return
    }
    setPosting(true)
    setNote(null)
    try {
      const posted = await bd.blog.withSession(token).postComment(slug, { content })
      setDraft('')
      setNote({
        text: posted.moderation.isApproved ? 'Comment posted.' : "Thanks! Your comment shows once it's approved.",
        ok: true,
      })
      const fresh = await bd.blog.listComments(slug, { limit: 50 }).catch(() => null)
      if (fresh) setComments(fresh.items)
    } catch {
      setNote({ text: "Couldn't post your comment. Try again.", ok: false })
    } finally {
      setPosting(false)
    }
  }

  return (
    <LoadState state={state}>
      {(loaded) => {
        if (!loaded) {
          return <Text style={styles.note}>The blog isn't connected yet.</Text>
        }
        const { post, paywalled } = loaded
        const cta = safeCta(post.ctaHref)
        return (
          <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
            <Stack.Screen
              options={{
                title: post.title,
                headerRight: SITE_URL
                  ? () => (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() =>
                          void Share.share({
                            message: `${post.title} ${SITE_URL}/blog/${post.slug}`,
                            url: `${SITE_URL}/blog/${post.slug}`,
                          })
                        }
                      >
                        <Text style={ui.link}>Share</Text>
                      </Pressable>
                    )
                  : undefined,
              }}
            />
            <View style={{ gap: 8 }}>
              <Text style={styles.title} accessibilityRole="header">
                {post.title}
              </Text>
              <View style={[ui.row, { gap: 8 }]}>
                {post.authorAvatarUrl ? <Image source={{ uri: post.authorAvatarUrl }} style={styles.avatar} /> : null}
                {post.authorName ? <Text style={styles.author}>{post.authorName}</Text> : null}
                <Text style={ui.muted}>
                  {formatPostDate(post.publishedAt)} · {readingMinutes(post.content)} min read
                </Text>
              </View>
            </View>

            {post.imageUrl ? (
              <Image source={{ uri: post.imageUrl }} style={styles.cover} resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : null}

            {paywalled ? (
              <View style={styles.box}>
                <Text style={ui.sectionTitle}>This post is for members.</Text>
                <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.navigate('/account')}>
                  <Text style={ui.buttonText}>Sign in to read it</Text>
                </Pressable>
              </View>
            ) : (
              <PostBody blocks={blocks} />
            )}

            {post.ctaLabel && cta ? (
              <View style={styles.box}>
                {post.ctaDescription ? <Text style={styles.body}>{post.ctaDescription}</Text> : null}
                <Pressable accessibilityRole="link" style={ui.button} onPress={() => void Linking.openURL(cta)}>
                  <Text style={ui.buttonText}>{post.ctaLabel}</Text>
                </Pressable>
              </View>
            ) : null}

            {post.tags.length > 0 ? (
              <Text style={ui.muted}>{post.tags.map((value) => `#${value}`).join('  ')}</Text>
            ) : null}

            <View style={styles.divider} />

            <View style={[ui.row, { gap: 12 }]}>
              {token ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!likes?.liked }}
                  disabled={liking}
                  onPress={toggleLike}
                  style={[ui.ghostButton, likes?.liked && { borderColor: shop.accent }]}
                >
                  <Text style={[ui.ghostButtonText, likes?.liked && { color: shop.accent }]}>
                    {likes?.liked ? '♥ Liked' : '♡ Like'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" style={ui.ghostButton} onPress={() => router.navigate('/account')}>
                  <Text style={ui.ghostButtonText}>♡ Sign in to like</Text>
                </Pressable>
              )}
              <Text style={ui.muted}>
                {likes?.likesCount ?? post.likes} {(likes?.likesCount ?? post.likes) === 1 ? 'like' : 'likes'}
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <Text style={ui.sectionTitle}>
                {comments.length > 0 ? `Comments (${comments.length})` : 'Comments'}
              </Text>
              {token ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Add a comment"
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                    maxLength={COMMENT_MAX}
                    accessibilityLabel="Add a comment"
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={posting || !draft.trim()}
                    onPress={postComment}
                    style={[ui.button, (posting || !draft.trim()) && { opacity: 0.5 }]}
                  >
                    <Text style={ui.buttonText}>{posting ? 'Posting…' : 'Post comment'}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable accessibilityRole="button" style={ui.ghostButton} onPress={() => router.navigate('/account')}>
                  <Text style={ui.ghostButtonText}>Sign in to comment</Text>
                </Pressable>
              )}
              {note ? <Text style={{ color: note.ok ? shop.ok : shop.sale }}>{note.text}</Text> : null}
              {comments.map((comment) => (
                <View key={comment.id} style={styles.comment}>
                  <Text style={styles.author}>
                    {comment.authorName || 'Reader'}
                    <Text style={ui.muted}> · {formatPostDate(comment.createdAt)}</Text>
                  </Text>
                  <Text style={styles.body}>{comment.content}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )
      }}
    </LoadState>
  )
}

/** The call to action opens only web and mail links. */
function safeCta(href: string | null | undefined): string | null {
  if (!href) return null
  return /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : null
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: shop.text },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: shop.soft },
  author: { fontWeight: '600', color: shop.text },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: shop.soft },
  box: { gap: 10, padding: 16, borderRadius: 12, backgroundColor: shop.soft },
  body: { fontSize: 16, lineHeight: 24, color: shop.text },
  divider: { height: 1, backgroundColor: shop.border },
  input: { minHeight: 80, padding: 10, borderWidth: 1, borderColor: shop.border, borderRadius: 10, textAlignVertical: 'top' },
  comment: { gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: shop.border },
  note: { color: shop.muted, padding: 16 },
})
