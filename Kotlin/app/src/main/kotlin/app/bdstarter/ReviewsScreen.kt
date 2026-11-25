package app.bdstarter

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bd.Review
import app.bd.ReviewSummary
import app.bd.ReviewTotals
import app.bd.Reviews
import app.bd.portal
import app.bd.reviewPage
import app.bd.reviewTotals
import kotlinx.coroutines.launch

/**
 * The business's reviews: the average and a bar per star, a platform filter,
 * the reviews with "Show more", and a review writer for the signed-in customer.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewsScreen() {
    val app = LocalApp.current
    val client = app.client
    val scope = rememberCoroutineScope()
    var totals by remember { mutableStateOf<ReviewTotals?>(null) }
    var sources by remember { mutableStateOf(emptyList<String>()) }
    var source by rememberSaveable { mutableStateOf<String?>(null) }
    var reviews by remember { mutableStateOf<List<Review>?>(null) }
    var nextOffset by remember { mutableStateOf<Int?>(null) }
    var total by remember { mutableIntStateOf(0) }
    var failed by remember { mutableStateOf(false) }
    var loadingMore by remember { mutableStateOf(false) }

    LaunchedEffect(client) {
        client ?: return@LaunchedEffect
        bdCall { client.reviewTotals() }.onSuccess { totals = it }
    }
    LaunchedEffect(client, source) {
        client ?: return@LaunchedEffect
        val picked = source
        reviews = null
        failed = false
        bdCall { client.reviewPage(source = picked) }
            .onSuccess { page ->
                reviews = page.items
                nextOffset = page.nextOffset
                total = page.totalCount
                // The platforms come from the unfiltered list, and stay put while one is picked.
                if (picked == null) sources = Reviews.sourcesIn(page.items)
            }
            .onFailure { failed = true }
    }

    fun loadMore() {
        val shown = reviews ?: return
        val offset = nextOffset ?: return
        client ?: return
        loadingMore = true
        scope.launch {
            // On failure the button stays; trying again is the answer.
            bdCall { client.reviewPage(offset = offset, source = source) }.onSuccess { page ->
                val ids = shown.map { it.id }.toSet()
                reviews = shown + page.items.filter { it.id !in ids }
                nextOffset = page.nextOffset
            }
            loadingMore = false
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text("Reviews") }, navigationIcon = { BackButton() }) }) { padding ->
        if (client == null) {
            Notice("Not connected to BD.", Modifier.padding(padding))
            return@Scaffold
        }
        val shown = reviews
        LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 32.dp)) {
            item(key = "summary") { SummaryCard(Reviews.summarize(totals, fallbackTotal = total)) }
            if (sources.size > 1 || source != null) {
                item(key = "sources") {
                    Row(
                        Modifier.horizontalScroll(rememberScrollState()).padding(top = 16.dp, bottom = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        FilterChip(selected = source == null, onClick = { source = null }, label = { Text("All") })
                        for (name in sources) {
                            FilterChip(selected = source == name, onClick = { source = name }, label = { Text(Reviews.sourceLabel(name)) })
                        }
                    }
                }
            }
            when {
                failed -> item(key = "failed") { Note("Reviews aren't available right now. Please check back soon.") }
                shown == null -> item(key = "loading") {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }
                shown.isEmpty() -> item(key = "empty") { Note("No reviews yet", "Write one in Business Dash and it'll appear here.") }
                else -> {
                    items(shown, key = { it.id }) { ReviewCard(it) }
                    if (nextOffset != null) {
                        item(key = "more") {
                            OutlinedButton(onClick = ::loadMore, enabled = !loadingMore) { Text(if (loadingMore) "Loading…" else "Show more") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SummaryCard(summary: ReviewSummary) {
    OutlinedCard(Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            summary.average?.let { average ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(oneDecimal(average), style = MaterialTheme.typography.displaySmall)
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        StarRating(average, size = 18.sp)
                        Text("${summary.total} ${if (summary.total == 1) "review" else "reviews"}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            if (summary.histogram.any { it.count > 0 }) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (bar in summary.histogram) {
                        Row(
                            Modifier.clearAndSetSemantics {
                                contentDescription = "${bar.stars} ${if (bar.stars == 1) "star" else "stars"}: ${bar.count}"
                            },
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text("${bar.stars} ★", style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(32.dp))
                            LinearProgressIndicator(
                                progress = { bar.share.toFloat() },
                                modifier = Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(4.dp)),
                                drawStopIndicator = {},
                                gapSize = 0.dp,
                            )
                            Text(
                                "${bar.count}",
                                style = MaterialTheme.typography.bodySmall,
                                textAlign = TextAlign.End,
                                modifier = Modifier.width(28.dp),
                            )
                        }
                    }
                }
            }
            ReviewWriter()
        }
    }
}

@Composable
private fun ReviewCard(review: Review) {
    val uri = LocalUriHandler.current
    val platform = Reviews.platformName(review.source)
    val link = Reviews.link(review)
    val avatar = Reviews.safeWebUrl(review.reviewerImageUrl)
    val photos = review.photos.mapNotNull { Reviews.safeWebUrl(it) }
    Column(Modifier.padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            // A photo that won't load leaves the initial showing.
            Box(
                Modifier.size(36.dp).clip(CircleShape).background(MaterialTheme.colorScheme.secondaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Text(Reviews.reviewerInitial(review), color = MaterialTheme.colorScheme.onSecondaryContainer)
                if (avatar != null) Photo(avatar, Modifier.size(36.dp).background(Color.Transparent))
            }
            Column(Modifier.weight(1f)) {
                Text(Reviews.reviewerName(review), style = MaterialTheme.typography.titleSmall)
                Text(
                    listOfNotNull(Reviews.date(review.timeCreated), platform).filter { it.isNotEmpty() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (review.verified == true) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    Icon(Icons.Filled.CheckCircle, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                    Text("Verified", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
        StarRating(review.rating)
        review.text?.trim()?.takeIf { it.isNotEmpty() }?.let { Text(it) }
        if (photos.isNotEmpty()) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(photos) { Photo(it, Modifier.size(84.dp).clip(RoundedCornerShape(8.dp)), label = "Photo from the reviewer") }
            }
        }
        if (link != null && platform != null) {
            TextButton(onClick = { runCatching { uri.openUri(link) } }, contentPadding = PaddingValues(0.dp)) { Text("Read on $platform") }
        }
    }
}

@Composable
private fun ReviewWriter() {
    val app = LocalApp.current
    val client = app.client
    val token = app.sessionToken
    val scope = rememberCoroutineScope()
    var open by rememberSaveable { mutableStateOf(false) }
    var rating by rememberSaveable { mutableIntStateOf(0) }
    var title by rememberSaveable { mutableStateOf("") }
    var body by rememberSaveable { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }
    var sent by rememberSaveable { mutableStateOf(false) }

    fun send(signedIn: String) {
        client ?: return
        val check = Reviews.check(rating, title, body)
        val review = check.review ?: run {
            problem = check.error
            return
        }
        sending = true
        problem = null
        scope.launch {
            bdCall { client.portal(signedIn).submitReview(review) }
                .onSuccess {
                    sent = true
                    open = false
                }
                .onFailure { problem = bdProblem(it, "Couldn't send your review. Try again.") }
            sending = false
        }
    }

    when {
        sent -> Text(Reviews.SENT, color = Color(0xFF2E7D32))
        token == null || client == null -> OutlinedButton(onClick = { app.showTab(Tab.Account) }) { Text("Sign in to write a review") }
        !open -> Button(onClick = { open = true }) { Text("Write a review") }
        else -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Your rating", style = MaterialTheme.typography.labelLarge)
            Row {
                for (stars in 1..5) {
                    IconButton(
                        onClick = { rating = stars },
                        // Read as "4 stars, selected"; the glyphs themselves stay silent.
                        modifier = Modifier.semantics {
                            contentDescription = "$stars ${if (stars == 1) "star" else "stars"}"
                            selected = rating == stars
                        },
                    ) {
                        Text(
                            if (stars <= rating) "★" else "☆",
                            fontSize = 26.sp,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.clearAndSetSemantics { },
                        )
                    }
                }
            }
            OutlinedTextField(
                value = title,
                onValueChange = { if (it.length <= Reviews.MAX_TITLE_LENGTH) title = it },
                label = { Text("Title (optional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = body,
                onValueChange = { if (it.length <= Reviews.MAX_LENGTH) body = it },
                label = { Text("Your review") },
                placeholder = { Text("What was it like?") },
                minLines = 3,
                maxLines = 8,
                supportingText = { Text("${body.length} / ${Reviews.MAX_LENGTH}") },
                modifier = Modifier.fillMaxWidth(),
            )
            problem?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { send(token) }, enabled = !sending) { Text(if (sending) "Sending…" else "Send review") }
                TextButton(onClick = { open = false }, enabled = !sending) { Text("Cancel") }
            }
        }
    }
}

@Composable
private fun Note(title: String, detail: String? = null) {
    Column(
        Modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        detail?.let { Text(it, textAlign = TextAlign.Center) }
    }
}
