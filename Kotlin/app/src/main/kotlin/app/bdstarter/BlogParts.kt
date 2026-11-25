package app.bdstarter

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.bd.BlogCategory
import app.bd.BlogComment
import app.bd.BlogPost
import app.bd.PostHtml
import app.bd.Reviews

// The blog's parts. BlogScreen and PostScreen lay them out; each takes plain
// values and callbacks, so you can move, restyle, drop or replace any of
// them. The post's body is PostBody (BlogScreens.kt).

/** The longest comment BD takes. */
const val POST_COMMENT_MAX = 5000

/** All and a chip per category, then a chip per tag; choosing the chosen tag again clears it. */
@Composable
fun BlogFilters(
    categories: List<BlogCategory>,
    tags: List<String>,
    categoryId: String?,
    tag: String?,
    modifier: Modifier = Modifier,
    onCategory: (String?) -> Unit,
    onTag: (String?) -> Unit,
) {
    Column(modifier) {
        if (categories.isNotEmpty()) {
            ChipRow {
                FilterChip(selected = categoryId == null, onClick = { onCategory(null) }, label = { Text("All") })
                for (category in categories) {
                    FilterChip(selected = categoryId == category.id, onClick = { onCategory(category.id) }, label = { Text(category.name) })
                }
            }
        }
        if (tags.isNotEmpty()) {
            ChipRow {
                for (name in tags) {
                    FilterChip(selected = tag == name, onClick = { onTag(if (tag == name) null else name) }, label = { Text("#$name") })
                }
            }
        }
    }
}

/** A row of chips that scrolls sideways when it's too wide. */
@Composable
fun ChipRow(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Row(
        modifier.horizontalScroll(rememberScrollState()).padding(bottom = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) { content() }
}

/** A post in the list: cover, Pinned, title, excerpt, date and reading time. Tapping it opens the post. */
@Composable
fun PostCard(post: BlogPost, modifier: Modifier = Modifier, onOpen: (() -> Unit)? = null) {
    val app = LocalApp.current
    Column(
        modifier
            .padding(bottom = 20.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable { if (onOpen != null) onOpen() else app.open(Route.Post(post.slug)) },
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PostCover(post.imageUrl)
        if (post.isPinned) Text("Pinned", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
        Text(post.title, style = MaterialTheme.typography.titleMedium)
        post.excerpt?.takeIf { it.isNotEmpty() }?.let { Text(it, maxLines = 3, overflow = TextOverflow.Ellipsis) }
        Text(
            "${PostHtml.date(post.publishedAt)} · ${PostHtml.readingMinutes(post.content)} min read",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** The author with their photo, the date and the reading time. */
@Composable
fun PostMeta(post: BlogPost, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (!post.authorAvatarUrl.isNullOrEmpty()) Photo(post.authorAvatarUrl, Modifier.size(24.dp).clip(CircleShape))
        post.authorName?.takeIf { it.isNotEmpty() }?.let { Text(it, style = MaterialTheme.typography.labelLarge) }
        Text(
            "${PostHtml.date(post.publishedAt)} · ${PostHtml.readingMinutes(post.content)} min read",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** A post's cover photo, 16:9. Nothing when it has none. */
@Composable
fun PostCover(url: String?, modifier: Modifier = Modifier) {
    if (url.isNullOrEmpty()) return
    Photo(url, modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(12.dp)))
}

/** A tinted, rounded panel: the members-only notice, the call to action. */
@Composable
fun InfoPanel(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) { content() }
}

/** In place of a members' post for visitors: Sign in to read it. */
@Composable
fun MembersOnly(modifier: Modifier = Modifier, onSignIn: () -> Unit) {
    InfoPanel(modifier) {
        Text("This post is for members.", style = MaterialTheme.typography.titleMedium)
        Button(onClick = onSignIn) { Text("Sign in to read it") }
    }
}

/** A post's call-to-action link when it has a label and opens a web or mail address; null otherwise. */
fun postCtaLink(post: BlogPost): String? {
    if (post.ctaLabel.isNullOrEmpty()) return null
    val value = post.ctaHref?.trim().orEmpty()
    if (Reviews.safeWebUrl(value) != null) return value
    return value.takeIf { Regex("^mailto:[^\\s]+", RegexOption.IGNORE_CASE).containsMatchIn(it) }
}

/** The post's call to action, when [postCtaLink] gives it one. It opens in the browser unless [onOpen] is given. */
@Composable
fun PostCta(post: BlogPost, modifier: Modifier = Modifier, onOpen: ((String) -> Unit)? = null) {
    val link = postCtaLink(post) ?: return
    val uri = LocalUriHandler.current
    InfoPanel(modifier) {
        post.ctaDescription?.takeIf { it.isNotEmpty() }?.let { Text(it) }
        Button(onClick = { if (onOpen != null) onOpen(link) else runCatching { uri.openUri(link) } }) { Text(post.ctaLabel.orEmpty()) }
    }
}

/** The post's tags, as "#gear  #running". Nothing when it has none. */
@Composable
fun PostTags(tags: List<String>, modifier: Modifier = Modifier) {
    if (tags.isEmpty()) return
    Text(
        tags.joinToString("  ") { "#$it" },
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier,
    )
}

/** ♡ Like with the count. Signed out, Sign in to like. */
@Composable
fun LikeButton(
    signedIn: Boolean,
    liked: Boolean,
    count: Int,
    modifier: Modifier = Modifier,
    liking: Boolean = false,
    onToggle: () -> Unit,
    onSignIn: () -> Unit,
) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        if (signedIn) {
            OutlinedButton(onClick = onToggle, enabled = !liking) {
                Icon(if (liked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, null, Modifier.size(18.dp))
                Text(if (liked) "Liked" else "Like", Modifier.padding(start = 8.dp))
            }
        } else {
            OutlinedButton(onClick = onSignIn) {
                Icon(Icons.Filled.FavoriteBorder, null, Modifier.size(18.dp))
                Text("Sign in to like", Modifier.padding(start = 8.dp))
            }
        }
        Text(
            "$count ${if (count == 1) "like" else "likes"}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * "Comments (3)", then a box to add one and Post comment, or Sign in to
 * comment for visitors, and what happened after posting ([noteOk]: it went
 * well). The comments themselves are a [CommentRow] each.
 */
@Composable
fun CommentForm(
    count: Int,
    signedIn: Boolean,
    draft: String,
    onDraftChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    posting: Boolean = false,
    note: String? = null,
    noteOk: Boolean = true,
    onPost: () -> Unit,
    onSignIn: () -> Unit,
) {
    Column(modifier.padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(if (count > 0) "Comments ($count)" else "Comments", style = MaterialTheme.typography.titleMedium)
        if (signedIn) {
            OutlinedTextField(
                value = draft,
                onValueChange = { if (it.length <= POST_COMMENT_MAX) onDraftChange(it) },
                placeholder = { Text("Add a comment") },
                minLines = 2,
                maxLines = 6,
                supportingText = { Text("${draft.length} / $POST_COMMENT_MAX") },
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Add a comment" },
            )
            Button(onClick = onPost, enabled = !posting && draft.isNotBlank()) {
                Text(if (posting) "Posting…" else "Post comment")
            }
        } else {
            OutlinedButton(onClick = onSignIn) { Text("Sign in to comment") }
        }
        note?.let { Text(it, color = if (noteOk) Color(0xFF2E7D32) else MaterialTheme.colorScheme.error) }
    }
}

/** One comment: who and when, then what they said. */
@Composable
fun CommentRow(comment: BlogComment, modifier: Modifier = Modifier) {
    Column(modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            listOf(comment.authorName?.takeIf { it.isNotEmpty() } ?: "Reader", PostHtml.date(comment.createdAt))
                .filter { it.isNotEmpty() }
                .joinToString(" · "),
            style = MaterialTheme.typography.labelLarge,
        )
        Text(comment.content)
    }
}
