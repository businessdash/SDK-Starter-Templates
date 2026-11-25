package app.bdstarter

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bd.BdHttpException
import app.bd.BlogCategory
import app.bd.BlogComment
import app.bd.BlogPost
import app.bd.BlogPostDetail
import app.bd.PostBlock
import app.bd.PostBlocks
import app.bd.PostLikes
import app.bd.PostRun
import app.bd.blogCategories
import app.bd.blogPage
import app.bd.blogPost
import app.bd.blogTags
import app.bd.postComment
import app.bd.postComments
import app.bd.postLikes
import app.bd.togglePostLike
import kotlinx.coroutines.launch

private const val PAGE_SIZE = 12

/**
 * The blog: categories, tags, pinned posts first, and "Older posts". A tag
 * is matched over the newest 50 posts, as the API filters by category only.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BlogScreen(modifier: Modifier = Modifier) {
    val app = LocalApp.current
    val client = app.client
    val scope = rememberCoroutineScope()
    var categories by remember { mutableStateOf(emptyList<BlogCategory>()) }
    var tags by remember { mutableStateOf(emptyList<String>()) }
    var categoryId by rememberSaveable { mutableStateOf<String?>(null) }
    var tag by rememberSaveable { mutableStateOf<String?>(null) }
    var posts by remember { mutableStateOf<List<BlogPost>?>(null) }
    var failed by remember { mutableStateOf(false) }
    var cursor by remember { mutableStateOf<Int?>(null) }
    var loadingMore by remember { mutableStateOf(false) }

    LaunchedEffect(client) {
        client ?: return@LaunchedEffect
        bdCall { client.blogCategories() }.onSuccess { categories = it }
        bdCall { client.blogTags() }.onSuccess { tags = it }
    }
    LaunchedEffect(client, categoryId, tag) {
        client ?: return@LaunchedEffect
        posts = null
        failed = false
        val chosenTag = tag
        bdCall { client.blogPage(limit = if (chosenTag != null) 50 else PAGE_SIZE, categoryId = categoryId) }
            .onSuccess { page ->
                val matched = page.items.filter { chosenTag == null || chosenTag in it.tags }
                // Pinned first; the rest keep their order.
                posts = matched.filter { it.isPinned } + matched.filterNot { it.isPinned }
                cursor = if (chosenTag != null) null else page.nextCursor
            }
            .onFailure { failed = true }
    }

    fun loadOlder() {
        val shown = posts ?: return
        val from = cursor ?: return
        client ?: return
        loadingMore = true
        scope.launch {
            // On failure the button stays; trying again is the answer.
            bdCall { client.blogPage(limit = PAGE_SIZE, cursor = from, categoryId = categoryId) }.onSuccess { page ->
                val ids = shown.map { it.id }.toSet()
                posts = shown + page.items.filter { it.id !in ids }
                cursor = page.nextCursor
            }
            loadingMore = false
        }
    }

    val active = categories.firstOrNull { it.id == categoryId }
    Scaffold(modifier = modifier, topBar = { TopAppBar(title = { Text(active?.name ?: "Blog") }) }) { padding ->
        if (client == null) {
            Notice("The blog isn't connected yet.", Modifier.padding(padding))
            return@Scaffold
        }
        val shown = posts
        LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 24.dp)) {
            if (categories.isNotEmpty() || tags.isNotEmpty()) {
                item(key = "filters") {
                    BlogFilters(categories, tags, categoryId, tag, onCategory = { categoryId = it }, onTag = { tag = it })
                }
            }
            active?.description?.takeIf { it.isNotEmpty() }?.let { description ->
                item(key = "about") {
                    Text(
                        description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
            }
            when {
                failed -> item(key = "failed") { EmptyNote("The blog isn't available right now. Please check back soon.") }
                shown == null -> item(key = "loading") {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }
                shown.isEmpty() -> item(key = "empty") {
                    EmptyNote("No posts here yet", if (categoryId != null || tag != null) "Try another topic." else null)
                }
                else -> {
                    items(shown, key = { it.id }) { PostCard(it) }
                    if (cursor != null) {
                        item(key = "older") {
                            OutlinedButton(onClick = ::loadOlder, enabled = !loadingMore) {
                                Text(if (loadingMore) "Loading…" else "Older posts")
                            }
                        }
                    }
                }
            }
        }
    }
}

/** A post drawn natively, with likes and comments for the signed-in customer. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostScreen(slug: String) {
    val app = LocalApp.current
    val client = app.client
    val token = app.sessionToken
    val scope = rememberCoroutineScope()
    var detail by remember { mutableStateOf<BlogPostDetail?>(null) }
    var blocks by remember { mutableStateOf(emptyList<PostBlock>()) }
    var failure by remember { mutableStateOf<Throwable?>(null) }
    var likes by remember { mutableStateOf<PostLikes?>(null) }
    var liking by remember { mutableStateOf(false) }
    var comments by remember { mutableStateOf(emptyList<BlogComment>()) }
    var commentsVersion by remember { mutableIntStateOf(0) }
    var draft by rememberSaveable { mutableStateOf("") }
    var posting by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf<Pair<String, Boolean>?>(null) }

    // Signing in or out reloads it: signed in, a members-only post comes with
    // its body, and likes say whether this customer liked it.
    LaunchedEffect(client, slug, token) {
        client ?: return@LaunchedEffect
        launch { bdCall { client.postLikes(slug, token) }.onSuccess { likes = it } }
        bdCall { client.blogPost(slug, token) }
            .onSuccess {
                detail = it
                blocks = PostBlocks.from(it.post.content)
                failure = null
            }
            .onFailure { failure = it }
    }
    // The comments already shown stay if a reload fails.
    LaunchedEffect(client, slug, commentsVersion) {
        client ?: return@LaunchedEffect
        bdCall { client.postComments(slug) }.onSuccess { comments = it }
    }

    fun toggleLike(signedIn: String) {
        client ?: return
        liking = true
        scope.launch {
            bdCall { client.togglePostLike(slug, signedIn) }.onSuccess { likes = it }
            liking = false
        }
    }

    fun postComment(signedIn: String) {
        client ?: return
        val content = draft.trim()
        if (content.isEmpty()) return
        if (content.length > POST_COMMENT_MAX) {
            note = "Comments are up to 5,000 characters." to false
            return
        }
        posting = true
        note = null
        scope.launch {
            bdCall { client.postComment(slug, content, signedIn) }
                .onSuccess {
                    draft = ""
                    note = (if (it.isApproved) "Comment posted." else "Thanks! Your comment shows once it's approved.") to true
                    commentsVersion++
                }
                .onFailure { note = "Couldn't post your comment. Try again." to false }
            posting = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(detail?.post?.title ?: "Blog", maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = { BackButton() },
            )
        },
    ) { padding ->
        val shown = detail
        val problem = failure
        when {
            client == null -> Notice("The blog isn't connected yet.", Modifier.padding(padding))
            shown == null && problem != null -> Notice(
                if (problem is BdHttpException && problem.status == 404) "This post is gone."
                else "The blog isn't available right now. Please check back soon.",
                Modifier.padding(padding),
            )
            shown == null -> Loading(Modifier.padding(padding))
            else -> LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 32.dp)) {
                val post = shown.post
                item(key = "head") {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(post.title, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
                        PostMeta(post)
                        PostCover(post.imageUrl, Modifier.padding(top = 8.dp))
                        Spacer(Modifier.height(8.dp))
                    }
                }
                item(key = "body") {
                    if (shown.isPaywalled) MembersOnly { app.showTab(Tab.Account) } else PostBody(blocks)
                }
                if (postCtaLink(post) != null) {
                    item(key = "cta") { PostCta(post, Modifier.padding(top = 16.dp)) }
                }
                if (post.tags.isNotEmpty()) {
                    item(key = "tags") { PostTags(post.tags, Modifier.padding(top = 16.dp)) }
                }
                item(key = "likes") {
                    HorizontalDivider(Modifier.padding(vertical = 20.dp))
                    LikeButton(
                        signedIn = token != null,
                        liked = likes?.liked == true,
                        count = likes?.count ?: post.likes,
                        liking = liking,
                        onToggle = { token?.let { toggleLike(it) } },
                        onSignIn = { app.showTab(Tab.Account) },
                    )
                }
                item(key = "comment") {
                    CommentForm(
                        count = comments.size,
                        signedIn = token != null,
                        draft = draft,
                        onDraftChange = { draft = it },
                        posting = posting,
                        note = note?.first,
                        noteOk = note?.second ?: true,
                        onPost = { token?.let { postComment(it) } },
                        onSignIn = { app.showTab(Tab.Account) },
                    )
                }
                items(comments, key = { "comment-${it.id}" }) { CommentRow(it) }
            }
        }
    }
}

/** A post's blocks as native text, lists, photos and tables. Links open in the browser or the mail and phone apps. */
@Composable
fun PostBody(blocks: List<PostBlock>, modifier: Modifier = Modifier) {
    val type = MaterialTheme.typography
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        for (block in blocks) {
            when (block) {
                is PostBlock.Heading -> Runs(
                    block.text,
                    when (block.level) {
                        1 -> type.headlineSmall
                        2 -> type.titleLarge
                        3 -> type.titleMedium
                        else -> type.titleSmall
                    },
                    Modifier.semantics { heading() },
                )
                is PostBlock.Paragraph -> Runs(block.text, type.bodyLarge)
                is PostBlock.Quote -> Row(Modifier.height(IntrinsicSize.Min)) {
                    Box(Modifier.width(3.dp).fillMaxHeight().background(MaterialTheme.colorScheme.primary))
                    Runs(block.text, type.bodyLarge.copy(fontStyle = FontStyle.Italic), Modifier.padding(start = 12.dp))
                }
                is PostBlock.ItemList -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (item in block.items) {
                        Row(Modifier.padding(start = (16 * item.depth).dp)) {
                            Text(item.marker, style = type.bodyLarge, modifier = Modifier.width(24.dp))
                            Runs(item.text, type.bodyLarge, Modifier.weight(1f))
                        }
                    }
                }
                is PostBlock.Code -> Text(
                    block.text,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .horizontalScroll(rememberScrollState())
                        .padding(12.dp),
                    softWrap = false,
                )
                is PostBlock.Image -> Photo(
                    block.url,
                    Modifier.fillMaxWidth().wrapContentHeight().clip(RoundedCornerShape(10.dp)),
                    label = block.alt.ifEmpty { null },
                    contentScale = ContentScale.FillWidth,
                )
                is PostBlock.Caption -> Runs(
                    block.text,
                    type.bodySmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center),
                    Modifier.fillMaxWidth(),
                )
                is PostBlock.Table -> Column(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)),
                ) {
                    for (row in block.rows) {
                        Row {
                            for (cell in row.cells) {
                                Runs(
                                    cell,
                                    if (row.isHeader) type.bodyMedium.copy(fontWeight = FontWeight.Bold) else type.bodyMedium,
                                    Modifier.width(140.dp).padding(horizontal = 10.dp, vertical = 6.dp),
                                )
                            }
                        }
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    }
                }
                PostBlock.Rule -> HorizontalDivider()
            }
        }
    }
}

/** Styled runs as one text. A run with a link is underlined and opens it. */
@Composable
private fun Runs(runs: List<PostRun>, style: TextStyle, modifier: Modifier = Modifier) {
    val linkColor = MaterialTheme.colorScheme.primary
    val text: AnnotatedString = remember(runs, linkColor) {
        buildAnnotatedString {
            for (run in runs) {
                val look = SpanStyle(
                    fontWeight = if (run.bold) FontWeight.Bold else null,
                    fontStyle = if (run.italic) FontStyle.Italic else null,
                    fontFamily = if (run.code) FontFamily.Monospace else null,
                    textDecoration = if (run.strike) TextDecoration.LineThrough else null,
                )
                val link = run.link
                if (link == null) {
                    withStyle(look) { append(run.text) }
                } else {
                    val lines = listOfNotNull(TextDecoration.Underline, TextDecoration.LineThrough.takeIf { run.strike })
                    val styles = TextLinkStyles(look.merge(SpanStyle(color = linkColor, textDecoration = TextDecoration.combine(lines))))
                    withLink(LinkAnnotation.Url(link, styles)) { append(run.text) }
                }
            }
        }
    }
    Text(text, style = style, modifier = modifier)
}
