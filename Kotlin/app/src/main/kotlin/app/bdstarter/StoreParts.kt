package app.bdstarter

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bd.CartItem
import app.bd.Money
import app.bd.ProductCategory
import app.bd.ProductListing
import kotlin.math.ceil
import kotlin.math.floor

// The store list's and the cart's parts. StoreScreen and CartScreen lay them
// out; each takes plain values and callbacks, so you can move, restyle, drop
// or replace any of them. The product card, the save buttons, the compare
// bar and the rating strip are in ShopParts.kt.

/** The sorts the store offers: value to label. */
val storeSorts: Map<String, String> = linkedMapOf(
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


/** The search box. The store waits for a pause in typing before it searches. */
@Composable
fun StoreSearchField(value: String, modifier: Modifier = Modifier, onValueChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text("Search products") },
        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        modifier = modifier.fillMaxWidth().semantics { contentDescription = "Search products" },
    )
}

/**
 * All, then a chip per category with how many products it has; choosing the
 * chosen one again clears it. Nothing when there are no categories.
 */
@Composable
fun CategoryChips(
    categories: List<ProductCategory>,
    counts: Map<String, Int>,
    selected: String?,
    modifier: Modifier = Modifier,
    onSelect: (String?) -> Unit,
) {
    if (categories.isEmpty()) return
    Row(modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(selected = selected == null, onClick = { onSelect(null) }, label = { Text("All") })
        for (category in categories) {
            FilterChip(
                selected = selected == category.id,
                onClick = { onSelect(if (selected == category.id) null else category.id) },
                label = { Text("${category.name} ${counts[category.id] ?: 0}") },
            )
        }
    }
}

/** "12 products", a spinner while it loads, and Filters (with how many are on) · the sort. */
@Composable
fun StoreResultsBar(
    count: Int,
    loading: Boolean,
    failed: Boolean,
    filterCount: Int,
    sort: String,
    modifier: Modifier = Modifier,
    onFilters: () -> Unit,
) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("$count ${if (count == 1) "product" else "products"}", style = MaterialTheme.typography.bodyMedium)
        if (loading) {
            CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
        } else if (failed) {
            Text("Couldn't update. Try again.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }
        Row(Modifier.weight(1f), horizontalArrangement = Arrangement.End) {
            TextButton(onClick = onFilters) {
                Text(
                    (if (filterCount > 0) "Filters ($filterCount)" else "Filters") + " · ${storeSorts[sort] ?: sort}",
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/** No products: "No matches" and Clear all filters when the list is narrowed, else "No products yet". */
@Composable
fun StoreEmpty(narrowed: Boolean, modifier: Modifier = Modifier, onClear: () -> Unit) {
    Column(
        modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(if (narrowed) "No matches" else "No products yet", style = MaterialTheme.typography.titleMedium)
        if (narrowed) TextButton(onClick = onClear) { Text("Clear all filters") }
    }
}

/**
 * A line in the cart: photo, name, style, price each, − quantity + and
 * Remove, and the line's total. [onQuantity] gets the new quantity; 0 means
 * take it out.
 */
@Composable
fun CartLine(
    item: CartItem,
    currency: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onQuantity: (Int) -> Unit,
    onRemove: () -> Unit,
) {
    Row(
        modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Photo(item.productImage, Modifier.size(64.dp).clip(RoundedCornerShape(8.dp)))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(item.name ?: "Item", style = MaterialTheme.typography.titleSmall)
            item.variantTitle?.takeIf { it.isNotEmpty() }?.let {
                Text(it, style = MaterialTheme.typography.bodySmall)
            }
            Text(Money.amount(item.unitPrice, currency), style = MaterialTheme.typography.bodySmall)
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(enabled = enabled, onClick = { onQuantity(item.quantity - 1) }) {
                    Text(
                        "−",
                        fontSize = 22.sp,
                        modifier = Modifier.semantics {
                            contentDescription = if (item.quantity <= 1) "Remove" else "One fewer"
                        },
                    )
                }
                Text(
                    "${item.quantity}",
                    modifier = Modifier.semantics { contentDescription = "Quantity ${item.quantity}" },
                )
                IconButton(enabled = enabled, onClick = { onQuantity(item.quantity + 1) }) {
                    Icon(Icons.Filled.Add, contentDescription = "One more")
                }
                TextButton(enabled = enabled, onClick = onRemove) { Text("Remove") }
            }
        }
        Text(
            Money.amount(item.subtotal ?: (item.unitPrice ?: 0.0) * item.quantity, currency),
            style = MaterialTheme.typography.titleSmall,
        )
    }
}

/** The coupon box and Apply; once one is on, "Coupon RUN10 applied" and Remove. */
@Composable
fun CouponField(
    coupon: String?,
    code: String,
    onCodeChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onApply: () -> Unit,
    onRemove: () -> Unit,
) {
    Column(modifier.padding(16.dp)) {
        if (coupon != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Coupon $coupon applied", Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                TextButton(enabled = enabled, onClick = onRemove) { Text("Remove") }
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = code,
                    onValueChange = onCodeChange,
                    placeholder = { Text("Coupon code") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Characters,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(onDone = { onApply() }),
                    modifier = Modifier.weight(1f).semantics { contentDescription = "Coupon code" },
                )
                OutlinedButton(enabled = enabled, onClick = onApply) { Text("Apply") }
            }
        }
    }
}

/** The bar under the cart: what went wrong, if anything, the subtotal, Clear and Checkout. */
@Composable
fun CartSummaryBar(
    subtotal: Double?,
    currency: String,
    modifier: Modifier = Modifier,
    note: String? = null,
    enabled: Boolean = true,
    onClear: () -> Unit,
    onCheckout: () -> Unit,
) {
    Surface(modifier, tonalElevation = 3.dp) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp)) {
            note?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 8.dp)) }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("Subtotal", style = MaterialTheme.typography.bodySmall)
                    Text(Money.amount(subtotal, currency), style = MaterialTheme.typography.titleMedium)
                }
                TextButton(enabled = enabled, onClick = onClear) { Text("Clear") }
                Button(enabled = enabled, onClick = onCheckout) { Text("Checkout") }
            }
        }
    }
}

/**
 * Sort, price and rating. The fields are applied together, so the list
 * doesn't reload on every keystroke of a price.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun StoreFilterSheet(start: StoreFilters, listing: ProductListing?, onCancel: () -> Unit, onApply: (StoreFilters) -> Unit) {
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
                textAlign = TextAlign.Center,
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
            for ((value, label) in storeSorts) FilterChip(selected = sort == value, onClick = { sort = value }, label = { Text(label) })
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
