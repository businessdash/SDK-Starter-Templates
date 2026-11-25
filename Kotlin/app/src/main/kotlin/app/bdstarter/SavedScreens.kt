package app.bdstarter

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.bd.Money
import app.bd.ProductReviewPage
import app.bd.ProductView
import app.bd.productDetail
import app.bd.productReviews
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/** The products saved with ♡, kept on this device. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WishlistScreen() {
    val app = LocalApp.current
    val items = app.wishlist.items
    Scaffold(topBar = { TopAppBar(title = { Text("Wishlist") }, navigationIcon = { BackButton() }) }) { padding ->
        if (items.isEmpty()) {
            Column(
                Modifier.padding(padding).fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp, androidx.compose.ui.Alignment.CenterVertically),
                horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
            ) {
                Text("Your wishlist is empty", style = MaterialTheme.typography.titleMedium)
                Text("Tap ♡ on a product to save it here.")
            }
        } else {
            LazyColumn(Modifier.padding(padding)) {
                items(items, key = { it.id }) { item ->
                    ListItem(
                        modifier = Modifier.clickable { app.open(Route.Product(item.id)) },
                        leadingContent = { Photo(item.image, Modifier.size(56.dp).clip(RoundedCornerShape(8.dp))) },
                        headlineContent = { Text(item.name.ifEmpty { "Untitled" }) },
                        supportingContent = if (item.priceCents == null) null else ({ Text(Money.cents(item.priceCents)) }),
                        trailingContent = { TextButton(onClick = { app.wishlist.remove(item.id) }) { Text("Remove") } },
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

private class CompareColumn(val view: ProductView, val reviews: ProductReviewPage?)

/** Up to four products side by side: price, rating, category, styles and every spec any of them has. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompareScreen() {
    val app = LocalApp.current
    val client = app.client
    val ids = app.compare.items.map { it.id }
    var columns by remember { mutableStateOf<List<CompareColumn>?>(null) }
    LaunchedEffect(client, ids) {
        client ?: return@LaunchedEffect
        // A product that can't be loaded drops out rather than failing the table.
        columns = coroutineScope {
            ids.map { id ->
                async {
                    val view = bdCall { client.productDetail(id) }.getOrNull() ?: return@async null
                    CompareColumn(view, bdCall { client.productReviews(id, limit = 1) }.getOrNull())
                }
            }.awaitAll().filterNotNull()
        }
    }
    Scaffold(topBar = { TopAppBar(title = { Text("Compare") }, navigationIcon = { BackButton() }) }) { padding ->
        val loaded = columns
        when {
            ids.isEmpty() -> Column(
                Modifier.padding(padding).fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(6.dp, androidx.compose.ui.Alignment.CenterVertically),
                horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
            ) {
                Text("Nothing to compare", style = MaterialTheme.typography.titleMedium)
                Text("Tap ⇄ on up to four products.")
            }
            client == null -> Notice("Not connected to BD.", Modifier.padding(padding))
            loaded == null -> Loading(Modifier.padding(padding))
            loaded.isEmpty() -> Notice("Couldn't load these products.", Modifier.padding(padding))
            else -> Column(Modifier.padding(padding).verticalScroll(rememberScrollState()).padding(16.dp)) {
                CompareTable(loaded)
                OutlinedButton(onClick = app.compare::clear, modifier = Modifier.padding(top = 16.dp)) { Text("Clear compare") }
            }
        }
    }
}

@Composable
private fun CompareTable(columns: List<CompareColumn>) {
    val app = LocalApp.current
    // Every spec label, in the order first met.
    val labels = columns.flatMap { column -> column.view.specs.flatMap { group -> group.rows.map { it.label } } }.distinct()
    fun spec(column: CompareColumn, label: String): String =
        column.view.specs.firstNotNullOfOrNull { group -> group.rows.firstOrNull { it.label == label }?.value } ?: "—"
    val rows: List<Pair<String, (CompareColumn) -> String>> = listOf<Pair<String, (CompareColumn) -> String>>(
        "Price" to { column -> column.view.defaultVariant?.price?.let { Money.amount(it) } ?: "—" },
        "Rating" to { column ->
            val reviews = column.reviews
            if (reviews == null || reviews.totalCount == 0) "No reviews" else "${oneDecimal(reviews.avgRating ?: 0.0)} ★ (${reviews.totalCount})"
        },
        "Category" to { column -> column.view.categoryName ?: "—" },
        "Options" to { column -> column.view.variants.joinToString(", ") { it.name }.ifEmpty { "—" } },
    ) + labels.map { label -> label to { column: CompareColumn -> spec(column, label) } }

    val label = 96.dp
    val cell = 150.dp
    val width = label + cell * columns.size
    Column(Modifier.horizontalScroll(rememberScrollState())) {
        Row {
            Spacer(Modifier.width(label))
            for (column in columns) {
                Column(Modifier.width(cell).padding(start = 4.dp, end = 8.dp, bottom = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Photo(
                        column.view.images.firstOrNull(),
                        Modifier.size(cell - 12.dp).clip(RoundedCornerShape(10.dp)).clickable { app.open(Route.Product(column.view.id)) },
                    )
                    Text(column.view.name, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleSmall)
                    TextButton(onClick = { app.compare.remove(column.view.id) }, contentPadding = PaddingValues(0.dp)) { Text("Remove") }
                }
            }
        }
        for ((name, value) in rows) {
            HorizontalDivider(Modifier.width(width))
            Row(Modifier.padding(vertical = 10.dp)) {
                Text(
                    name,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.width(label).padding(end = 8.dp),
                )
                for (column in columns) Text(value(column), Modifier.width(cell).padding(start = 4.dp, end = 8.dp))
            }
        }
    }
}
