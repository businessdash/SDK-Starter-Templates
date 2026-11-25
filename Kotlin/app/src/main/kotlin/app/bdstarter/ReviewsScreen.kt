package app.bdstarter

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.unit.dp
import app.bd.Review
import app.bd.ReviewTotals
import app.bd.Reviews
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
            item(key = "summary") { ReviewSummaryCard(Reviews.summarize(totals, fallbackTotal = total)) }
            if (sources.size > 1 || source != null) {
                item(key = "sources") { ReviewSourceFilter(sources, source) { source = it } }
            }
            when {
                failed -> item(key = "failed") { EmptyNote("Reviews aren't available right now. Please check back soon.") }
                shown == null -> item(key = "loading") {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }
                shown.isEmpty() -> item(key = "empty") { EmptyNote("No reviews yet", "Write one in Business Dash and it'll appear here.") }
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
