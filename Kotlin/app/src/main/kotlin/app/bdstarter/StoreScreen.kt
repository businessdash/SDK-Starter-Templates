package app.bdstarter

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.bd.ProductCategory
import app.bd.ProductListing
import app.bd.ReviewTotals
import app.bd.categories
import app.bd.productListing
import app.bd.reviewTotals
import kotlinx.coroutines.delay
import kotlin.math.ceil
import kotlin.math.roundToInt

private fun cents(dollars: Double?): Int? = dollars?.let { (it * 100).roundToInt() }

/**
 * The store: search, categories with their counts, a sort and filters, and
 * the grid. The rating strip at the top opens the business's reviews.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StoreScreen(modifier: Modifier = Modifier) {
    val app = LocalApp.current
    val client = app.client
    var typed by rememberSaveable { mutableStateOf("") }
    var search by rememberSaveable { mutableStateOf("") }
    var categoryId by rememberSaveable { mutableStateOf<String?>(null) }
    var filters by remember { mutableStateOf(StoreFilters()) }
    var shown by remember { mutableStateOf<ProductListing?>(null) }
    var error by remember { mutableStateOf<Throwable?>(null) }
    var loading by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }
    var categories by remember { mutableStateOf(emptyList<ProductCategory>()) }
    var totals by remember { mutableStateOf<ReviewTotals?>(null) }
    var filtering by rememberSaveable { mutableStateOf(false) }

    // A search waits for a pause in typing.
    LaunchedEffect(typed) {
        if (typed.trim() == search) return@LaunchedEffect
        delay(300)
        search = typed.trim()
    }
    // A newer search cancels an older one, so results never arrive out of order.
    LaunchedEffect(client, search, categoryId, filters, attempt) {
        client ?: return@LaunchedEffect
        loading = true
        error = null
        bdCall {
            client.productListing(
                search = search,
                categoryId = categoryId,
                minPriceCents = cents(filters.minDollars),
                maxPriceCents = cents(filters.maxDollars),
                minRating = filters.minRating,
                sort = filters.sort,
            )
        }.onSuccess { shown = it }.onFailure { error = it }
        loading = false
    }
    LaunchedEffect(client) {
        client ?: return@LaunchedEffect
        bdCall { client.categories() }.onSuccess { categories = it }
        bdCall { client.reviewTotals() }.onSuccess { totals = it }
    }

    val narrowed = search.isNotEmpty() || categoryId != null || filters.count > 0
    fun clearAll() {
        typed = ""
        search = ""
        categoryId = null
        filters = filters.copy(minDollars = null, maxDollars = null, minRating = null)
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("Shop") },
                actions = {
                    val saved = app.wishlist.items.size
                    IconButton(onClick = { app.open(Route.Wishlist) }) {
                        BadgedBox(badge = { if (saved > 0) Badge { Text("$saved") } }) {
                            Icon(
                                Icons.Filled.FavoriteBorder,
                                contentDescription = if (saved == 0) "Wishlist" else "Wishlist, $saved saved",
                            )
                        }
                    }
                },
            )
        },
        bottomBar = { CompareBar() },
    ) { padding ->
        val listing = shown
        val failure = error
        when {
            client == null -> Notice(
                "Not connected to BD — set bd.siteId and bd.publishableKey in local.properties.",
                Modifier.padding(padding),
            )
            listing == null && failure != null -> Notice(loadProblem(failure, "store"), Modifier.padding(padding)) {
                TextButton(onClick = { attempt++ }) { Text("Try again") }
            }
            listing == null -> Loading(Modifier.padding(padding))
            else -> BoxWithConstraints(Modifier.padding(padding).fillMaxSize()) {
                val columns = ceil(maxWidth / 240.dp).toInt().coerceIn(2, 6)
                val counts = listing.categoryCounts
                val counted = categories.filter { (counts[it.id] ?: 0) > 0 || it.id == categoryId }
                val products = listing.items
                LazyVerticalGrid(
                    columns = GridCells.Fixed(columns),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item(span = { GridItemSpan(maxLineSpan) }, key = "head") {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            ReviewStrip(totals)
                            StoreSearchField(typed) { typed = it }
                            CategoryChips(counted, counts, categoryId) { categoryId = it }
                            StoreResultsBar(
                                count = products.size,
                                loading = loading,
                                failed = failure != null,
                                filterCount = filters.count,
                                sort = filters.sort,
                            ) { filtering = true }
                        }
                    }
                    if (products.isEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }, key = "empty") { StoreEmpty(narrowed, onClear = ::clearAll) }
                    } else {
                        items(products, key = { it.id }) { ProductCard(it) }
                    }
                }
            }
        }
    }

    if (filtering) {
        ModalBottomSheet(onDismissRequest = { filtering = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
            StoreFilterSheet(
                start = filters,
                listing = shown,
                onCancel = { filtering = false },
                onApply = {
                    filters = it
                    filtering = false
                },
            )
        }
    }
}
