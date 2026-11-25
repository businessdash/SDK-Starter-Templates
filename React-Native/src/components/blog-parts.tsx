import { Link } from 'expo-router'
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import type { getBd } from '@/bd/client'
import { Chip, ChipRow, shop, styles as ui } from '@/components/shop'
import { formatPostDate, readingMinutes } from '@/shop/blog'

// The blog's parts. The Blog tab and `app/blog/[slug].tsx` lay them out;
// each takes plain values and callbacks, so you can move, restyle, drop or
// replace any of them. The post's body is `PostBody` (`PostBody.tsx`).

type Blog = NonNullable<ReturnType<typeof getBd>>['blog']

/** A post in the list (`blog.listPosts`). */
export type BlogListPost = Awaited<ReturnType<Blog['listPosts']>>['items'][number]

/** A post with its body (`blog.getPost`). */
export type BlogPost = Awaited<ReturnType<Blog['getPost']>>['post']

export type BlogComment = Awaited<ReturnType<Blog['listComments']>>['items'][number]

/** The longest comment BD takes. */
export const POST_COMMENT_MAX = 5000

/** All and a chip per category, then a chip per tag; choosing the chosen tag again clears it. */
export function BlogFilters({
  categories,
  tags,
  categoryId,
  tag,
  onCategory,
  onTag,
}: {
  categories: { id: string; name: string }[]
  tags: string[]
  categoryId: string | null
  tag: string | null
  onCategory: (categoryId: string | null) => void
  onTag: (tag: string | null) => void
}) {
  if (categories.length === 0 && tags.length === 0) return null
  return (
    <View style={{ gap: 10 }}>
      {categories.length > 0 ? (
        <ChipRow>
          <Chip label="All" active={categoryId === null} onPress={() => onCategory(null)} />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              active={categoryId === category.id}
              onPress={() => onCategory(category.id)}
            />
          ))}
        </ChipRow>
      ) : null}
      {tags.length > 0 ? (
        <ChipRow>
          {tags.map((value) => (
            <Chip key={value} label={`#${value}`} active={tag === value} onPress={() => onTag(tag === value ? null : value)} />
          ))}
        </ChipRow>
      ) : null}
    </View>
  )
}

/** A post in the list: cover, Pinned, date, reading time, title, excerpt and author. [lead] draws it larger. */
export function PostCard({ post, lead = false }: { post: BlogListPost; lead?: boolean }) {
  return (
    <Link href={{ pathname: '/blog/[slug]', params: { slug: post.slug } }} asChild>
      <Pressable accessibilityRole="link" style={{ gap: 6 }}>
        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            style={[styles.cardCover, { height: lead ? 190 : 130 }]}
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
        <Text style={lead ? styles.leadTitle : styles.cardTitle}>{post.title}</Text>
        {post.excerpt ? (
          <Text style={ui.muted} numberOfLines={3}>
            {post.excerpt}
          </Text>
        ) : null}
        {post.authorName ? <Text style={styles.cardAuthor}>{post.authorName}</Text> : null}
      </Pressable>
    </Link>
  )
}

/** The author with their photo, the date and the reading time. */
export function PostMeta({ post }: { post: BlogPost }) {
  return (
    <View style={[ui.row, { gap: 8 }]}>
      {post.authorAvatarUrl ? <Image source={{ uri: post.authorAvatarUrl }} style={styles.avatar} /> : null}
      {post.authorName ? <Text style={styles.author}>{post.authorName}</Text> : null}
      <Text style={ui.muted}>
        {formatPostDate(post.publishedAt)} · {readingMinutes(post.content)} min read
      </Text>
    </View>
  )
}

/** A post's cover photo, 16:9. Nothing when it has none. */
export function PostCover({ url }: { url: string | null | undefined }) {
  if (!url) return null
  return <Image source={{ uri: url }} style={styles.cover} resizeMode="cover" accessibilityIgnoresInvertColors />
}

/** In place of a members' post for visitors: Sign in to read it. */
export function MembersOnly({ onSignIn }: { onSignIn: () => void }) {
  return (
    <View style={styles.box}>
      <Text style={ui.sectionTitle}>This post is for members.</Text>
      <Pressable accessibilityRole="button" style={ui.button} onPress={onSignIn}>
        <Text style={ui.buttonText}>Sign in to read it</Text>
      </Pressable>
    </View>
  )
}

/** A post's call-to-action link when it has a label and opens a web or mail address; null otherwise. */
export function postCtaLink(post: Pick<BlogPost, 'ctaLabel' | 'ctaHref'>): string | null {
  if (!post.ctaLabel || !post.ctaHref) return null
  const href = post.ctaHref.trim()
  return /^(https?:|mailto:)/i.test(href) ? href : null
}

/** The post's call to action, when `postCtaLink` gives it one. It opens in the browser unless [onOpen] is given. */
export function PostCta({ post, onOpen }: { post: BlogPost; onOpen?: (url: string) => void }) {
  const link = postCtaLink(post)
  if (!link) return null
  return (
    <View style={styles.box}>
      {post.ctaDescription ? <Text style={styles.body}>{post.ctaDescription}</Text> : null}
      <Pressable
        accessibilityRole="link"
        style={ui.button}
        onPress={() => (onOpen ? onOpen(link) : void Linking.openURL(link))}
      >
        <Text style={ui.buttonText}>{post.ctaLabel}</Text>
      </Pressable>
    </View>
  )
}

/** The post's tags, as "#gear  #running". Nothing when it has none. */
export function PostTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return <Text style={ui.muted}>{tags.map((value) => `#${value}`).join('  ')}</Text>
}

/** ♡ Like with the count. Signed out, Sign in to like. */
export function LikeButton({
  signedIn,
  liked,
  count,
  liking = false,
  onToggle,
  onSignIn,
}: {
  signedIn: boolean
  liked: boolean
  count: number
  liking?: boolean
  onToggle: () => void
  onSignIn: () => void
}) {
  return (
    <View style={[ui.row, { gap: 12 }]}>
      {signedIn ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          disabled={liking}
          onPress={onToggle}
          style={[ui.ghostButton, liked && { borderColor: shop.accent }]}
        >
          <Text style={[ui.ghostButtonText, liked && { color: shop.accent }]}>{liked ? '♥ Liked' : '♡ Like'}</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" style={ui.ghostButton} onPress={onSignIn}>
          <Text style={ui.ghostButtonText}>♡ Sign in to like</Text>
        </Pressable>
      )}
      <Text style={ui.muted}>
        {count} {count === 1 ? 'like' : 'likes'}
      </Text>
    </View>
  )
}

/**
 * "Comments (3)", a box to add one and Post comment (Sign in to comment for
 * visitors), what happened after posting, and the comments.
 */
export function PostComments({
  comments,
  signedIn,
  draft,
  onDraftChange,
  posting = false,
  note,
  onPost,
  onSignIn,
}: {
  comments: BlogComment[]
  signedIn: boolean
  draft: string
  onDraftChange: (draft: string) => void
  posting?: boolean
  /** After posting: what happened, and whether it went well. */
  note?: { text: string; ok: boolean } | null
  onPost: () => void
  onSignIn: () => void
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.sectionTitle}>{comments.length > 0 ? `Comments (${comments.length})` : 'Comments'}</Text>
      {signedIn ? (
        <View style={{ gap: 8 }}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment"
            value={draft}
            onChangeText={onDraftChange}
            multiline
            maxLength={POST_COMMENT_MAX}
            accessibilityLabel="Add a comment"
          />
          <Pressable
            accessibilityRole="button"
            disabled={posting || !draft.trim()}
            onPress={onPost}
            style={[ui.button, (posting || !draft.trim()) && { opacity: 0.5 }]}
          >
            <Text style={ui.buttonText}>{posting ? 'Posting…' : 'Post comment'}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" style={ui.ghostButton} onPress={onSignIn}>
          <Text style={ui.ghostButtonText}>Sign in to comment</Text>
        </Pressable>
      )}
      {note ? <Text style={{ color: note.ok ? shop.ok : shop.sale }}>{note.text}</Text> : null}
      {comments.map((comment) => (
        <CommentRow key={comment.id} comment={comment} />
      ))}
    </View>
  )
}

/** One comment: who and when, then what they said. */
export function CommentRow({ comment }: { comment: BlogComment }) {
  return (
    <View style={styles.comment}>
      <Text style={styles.author}>
        {comment.authorName || 'Reader'}
        <Text style={ui.muted}> · {formatPostDate(comment.createdAt)}</Text>
      </Text>
      <Text style={styles.body}>{comment.content}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  cardCover: { width: '100%', borderRadius: 12, backgroundColor: shop.soft },
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
  cardTitle: { fontSize: 17, fontWeight: '700', color: shop.text },
  leadTitle: { fontSize: 21, fontWeight: '800', color: shop.text },
  cardAuthor: { fontSize: 12, fontWeight: '600', color: shop.text },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: shop.soft },
  author: { fontWeight: '600', color: shop.text },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: shop.soft },
  box: { gap: 10, padding: 16, borderRadius: 12, backgroundColor: shop.soft },
  body: { fontSize: 16, lineHeight: 24, color: shop.text },
  input: { minHeight: 80, padding: 10, borderWidth: 1, borderColor: shop.border, borderRadius: 10, textAlignVertical: 'top' },
  comment: { gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: shop.border },
})
