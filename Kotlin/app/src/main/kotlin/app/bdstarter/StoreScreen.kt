package app.bdstarter

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.bd.ProductCategory
import app.bd.ProductListing
import app.bd.ReviewTotals
import app.bd.categories
import app.bd.productListing
import app.bd.reviewTotals
import kotlinx.coroutines.delay
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.roundToInt

private val SORTS = linkedMapOf(
    "featured" to "Featured",
    "newest" to "Newest",
    "price-asc" to "Price: low to high",
    "price-desc" to "Price: high to low",
    "rating-desc" to "Top rated",
)

/** The sort and the filters in the sheet. Prices are dollars, as typed. */
data class StoreFilters(
    val sort: String = "featured",
    val minDollars: Double? = null,
    val maxDollars: Double? = null,
    val minRating: Int? = null,
) {
    /** How many of the sheet's filters are on, for the button. */
    val count: Int get() = (if (minDollars != null || maxDollars != null) 1 else 0) + (if (minRating != null) 1 else 0)
}

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
                            OutlinedTextField(
                                value = typed,
                                onValueChange = { typed = it },
                                placeholder = { Text("Search products") },
                                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                                modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Search products" },
                            )
                            if (counted.isNotEmpty()) {
                                Row(
                                    Modifier.horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    FilterChip(selected = categoryId == null, onClick = { categoryId = null }, label = { Text("All") })
                                    for (category in counted) {
                                        FilterChip(
                                            selected = categoryId == category.id,
                                            onClick = { categoryId = if (categoryId == category.id) null else category.id },
                                            label = { Text("${category.name} ${counts[category.id] ?: 0}") },
                                        )
                                    }
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    "${products.size} ${if (products.size == 1) "product" else "products"}",
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                if (loading) {
                                    CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                                } else if (failure != null) {
                                    Text(
                                        "Couldn't update. Try again.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.error,
                                    )
                                }
                                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.End) {
                                    TextButton(onClick = { filtering = true }) {
                                        Text(
                                            (if (filters.count > 0) "Filters (${filters.count})" else "Filters") +
                                                " · ${SORTS[filters.sort]}",
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
                                }
                            }
                        }
                    }
                    if (products.isEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }, key = "empty") {
                            Column(
                                Modifier.fillMaxWidth().padding(32.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Text(if (narrowed) "No matches" else "No products yet", style = MaterialTheme.typography.titleMedium)
                                if (narrowed) TextButton(onClick = ::clearAll) { Text("Clear all filters") }
                            }
                        }
                    } else {
                        items(products, key = { it.id }) { ProductCard(it) }
                    }
                }
            }
        }
    }

    if (filtering) {
        ModalBottomSheet(onDismissRequest = { filtering = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
            FilterSheet(
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

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FilterSheet(start: StoreFilters, listing: ProductListing?, onCancel: () -> Unit, onApply: (StoreFilters) -> Unit) {
    var sort by remember { mutableStateOf(start.sort) }
    var minRating by remember { mutableStateOf(start.minRating) }
    var min by remember { mutableStateOf(dollarsText(start.minDollars)) }
    var max by remember { mutableStateOf(dollarsText(start.maxDollars)) }
    val low = listing?.priceRange?.minDollars
    val high = listing?.priceRange?.maxDollars
    Column(
        Modifier.verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onCancel) { Text("Cancel") }
            Text(
                "Filters",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.weight(1f),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            TextButton(onClick = {
                var lowest = readDollars(min)
                var highest = readDollars(max)
                if (lowest != null && highest != null && lowest > highest) lowest = highest.also { highest = lowest }
                onApply(StoreFilters(sort, lowest, highest, minRating))
            }) { Text("Apply") }
        }
        Text("Sort", style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((value, label) in SORTS) FilterChip(selected = sort == value, onClick = { sort = value }, label = { Text(label) })
        }
        Text("Price", style = MaterialTheme.typography.labelLarge)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(
                value = min,
                onValueChange = { min = it },
                label = { Text("Min") },
                placeholder = if (low == null) null else ({ Text("\$${floor(low).toInt()}") }),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f),
            )
            OutlinedTextField(
                value = max,
                onValueChange = { max = it },
                label = { Text("Max") },
                placeholder = if (high == null) null else ({ Text("\$${ceil(high).toInt()}") }),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f),
            )
        }
        Text("Rating", style = MaterialTheme.typography.labelLarge)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (stars in listOf(4, 3, 2)) {
                FilterChip(
                    selected = minRating == stars,
                    onClick = { minRating = if (minRating == stars) null else stars },
                    label = { Text("$stars★ & up") },
                )
            }
        }
        TextButton(onClick = {
            min = ""
            max = ""
            minRating = null
        }) { Text("Clear price and rating", color = MaterialTheme.colorScheme.error) }
    }
}

private fun dollarsText(value: Double?): String = when {
    value == null -> ""
    value == floor(value) -> value.toLong().toString()
    else -> String.format(java.util.Locale.US, "%.2f", value)
}

private fun readDollars(text: String): Double? =
    text.replace(Regex("[$,\\s]"), "").toDoubleOrNull()?.takeIf { it >= 0 && it.isFinite() }
