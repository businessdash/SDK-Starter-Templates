import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'

import { getBd } from '@/bd/client'
import { useCustomer } from '@/bd/customer'
import { useLoad } from '@/bd/useBd'
import { LoadState } from '@/components/LoadState'
import {
  type BlogComment,
  LikeButton,
  MembersOnly,
  POST_COMMENT_MAX,
  PostComments,
  PostCover,
  PostCta,
  PostMeta,
  PostTags,
} from '@/components/blog-parts'
import { PostBody } from '@/components/PostBody'
import { shop, styles as ui } from '@/components/shop'
import { postBlocks } from '@/shop/post-blocks'

/** The web store's address, for Share (e.g. https://example.com). */
const SITE_URL = process.env.EXPO_PUBLIC_BD_SITE_URL?.replace(/\/+$/, '') ?? null

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
  const [comments, setComments] = useState<BlogComment[]>([])
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
    if (content.length > POST_COMMENT_MAX) {
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
              <PostMeta post={post} />
            </View>

            <PostCover url={post.imageUrl} />

            {paywalled ? <MembersOnly onSignIn={() => router.navigate('/account')} /> : <PostBody blocks={blocks} />}

            <PostCta post={post} />

            <PostTags tags={post.tags} />

            <View style={styles.divider} />

            <LikeButton
              signedIn={!!token}
              liked={!!likes?.liked}
              count={likes?.likesCount ?? post.likes}
              liking={liking}
              onToggle={toggleLike}
              onSignIn={() => router.navigate('/account')}
            />

            <PostComments
              comments={comments}
              signedIn={!!token}
              draft={draft}
              onDraftChange={setDraft}
              posting={posting}
              note={note}
              onPost={postComment}
              onSignIn={() => router.navigate('/account')}
            />
          </ScrollView>
        )
      }}
    </LoadState>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: shop.text },
  divider: { height: 1, backgroundColor: shop.border },
  note: { color: shop.muted, padding: 16 },
})
