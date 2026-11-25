package app.bdstarter

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bd.Money
import app.bd.OptionGroup
import app.bd.ProductAddon
import app.bd.ProductPrice
import app.bd.ProductReview
import app.bd.ProductReviewPage
import app.bd.ProductVariant
import app.bd.ProductView
import app.bd.Reviews
import app.bd.SpecGroup

// The product page's parts. ProductScreen lays them out; each takes plain
// values and callbacks, so you can move, restyle, drop or replace any of
// them, or lay out a product page of your own. The rules (the price for a
// style and options, its photos, which options it has) are ProductView's.
// The save buttons, the rails and the stars are in ShopParts.kt.

/** The style's photos, swiped. A new style's photos start again at the first. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ProductGallery(urls: List<String>, name: String, modifier: Modifier = Modifier) {
    if (urls.isEmpty()) return
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val side = maxWidth.coerceAtMost(520.dp)
        val pager = key(urls) { rememberPagerState { urls.size } }
        HorizontalPager(pager, Modifier.fillMaxWidth().height(side), pageSpacing = 4.dp) { index ->
            Photo(
                urls[index],
                Modifier.fillMaxSize().clip(RoundedCornerShape(14.dp)),
                label = if (urls.size > 1) "$name, photo ${index + 1} of ${urls.size}" else name,
            )
        }
    }
}

/** The category over the product's name. */
@Composable
fun ProductTitle(categoryName: String?, name: String, modifier: Modifier = Modifier) {
    Column(modifier) {
        categoryName?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        Text(name, style = MaterialTheme.typography.headlineSmall)
    }
}

/** The price for the style and options chosen: "From $120.00" until every option is chosen. */
@Composable
fun ProductPriceText(price: ProductPrice, modifier: Modifier = Modifier) {
    val amount = price.amount
    Text(
        if (amount == null) "Unavailable" else (if (price.from) "From " else "") + Money.amount(amount),
        style = MaterialTheme.typography.titleLarge,
        modifier = modifier,
    )
}

/** "Only 3 left" when five or fewer are left; nothing otherwise. */
@Composable
fun StockNote(stock: Int?, modifier: Modifier = Modifier) {
    if (stock == null || stock !in 1..5) return
    Text(
        "Only $stock left",
        color = MaterialTheme.colorScheme.error,
        fontWeight = FontWeight.SemiBold,
        style = MaterialTheme.typography.bodyMedium,
        modifier = modifier,
    )
}

/** A choice in an [OptionRow]: a style, or a size. */
data class ChoiceOption(val id: String, val label: String, val available: Boolean)

/** A titled row of chips, "Size: M" once one is chosen. Sold-out ones can't be chosen. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OptionRow(
    title: String,
    options: List<ChoiceOption>,
    selected: String?,
    modifier: Modifier = Modifier,
    onSelect: (String) -> Unit,
) {
    val current = options.firstOrNull { it.id == selected }
    Column(modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(if (current == null) title else "$title: ${current.label}", style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (option in options) {
                FilterChip(
                    selected = option.id == selected,
                    onClick = { onSelect(option.id) },
                    enabled = option.available,
                    label = { Text(option.label) },
                    modifier = if (option.available) Modifier else Modifier.semantics { contentDescription = "${option.label}, sold out" },
                )
            }
        }
    }
}

/** The product's styles, when it has more than one. */
@Composable
fun VariantPicker(variants: List<ProductVariant>, selected: String?, modifier: Modifier = Modifier, onSelect: (String) -> Unit) {
    if (variants.size <= 1) return
    OptionRow("Style", variants.map { ChoiceOption(it.id, it.name, it.available) }, selected, modifier, onSelect)
}

/** One of the style's option groups: Size, then its values. */
@Composable
fun OptionPicker(group: OptionGroup, selected: String?, modifier: Modifier = Modifier, onSelect: (String) -> Unit) {
    OptionRow(group.title, group.values.map { ChoiceOption(it.id, it.value, it.available) }, selected, modifier, onSelect)
}

/** − 1 +, between 1 and [max]. */
@Composable
fun QuantityStepper(value: Int, max: Int, modifier: Modifier = Modifier, onChange: (Int) -> Unit) {
    Surface(
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = modifier.semantics(mergeDescendants = false) { contentDescription = "Quantity $value" },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { onChange(value - 1) }, enabled = value > 1) {
                Text("−", fontSize = 22.sp, modifier = Modifier.semantics { contentDescription = "One fewer" })
            }
            Text("$value", style = MaterialTheme.typography.titleMedium)
            IconButton(onClick = { onChange(value + 1) }, enabled = value < max) {
                Icon(Icons.Filled.Add, contentDescription = "One more")
            }
        }
    }
}

/**
 * Add to cart once the price is ready; until then it says why not: Choose
 * options, or Unavailable. Adding… while it goes.
 */
@Composable
fun AddToCartButton(
    price: ProductPrice,
    adding: Boolean,
    hasOptions: Boolean,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Button(onClick = onClick, enabled = enabled && !adding && price.ready, modifier = modifier) {
        Text(
            when {
                adding -> "Adding…"
                price.ready -> "Add to cart"
                hasOptions -> "Choose options"
                else -> "Unavailable"
            },
        )
    }
}

/** What went wrong, under the button. */
@Composable
fun ProductNotice(message: String, modifier: Modifier = Modifier) {
    Text(message, color = MaterialTheme.colorScheme.error, modifier = modifier.padding(top = 8.dp))
}

/** "Goes well with": add-ons, each added to the cart on its own. [added] holds the add-on ids already added. */
@Composable
fun ProductAddons(addons: List<ProductAddon>, added: Set<String>, modifier: Modifier = Modifier, onAdd: (ProductAddon) -> Unit) {
    if (addons.isEmpty()) return
    Column(modifier) {
        Text(
            addons.first().groupLabel ?: "Goes well with",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp),
        )
        for (addon in addons) AddonRow(addon, added = addon.id in added) { onAdd(addon) }
    }
}

/** An add-on: its photo, name and price, and Add (Added once it's in). */
@Composable
fun AddonRow(addon: ProductAddon, added: Boolean, modifier: Modifier = Modifier, onAdd: () -> Unit) {
    ListItem(
        leadingContent = { Photo(addon.imageUrl, Modifier.size(48.dp).clip(RoundedCornerShape(8.dp))) },
        headlineContent = { Text(addon.name) },
        supportingContent = if (addon.priceCents == null) null else ({ Text(Money.cents(addon.priceCents)) }),
        trailingContent = {
            OutlinedButton(onClick = onAdd, enabled = !added) { Text(if (added) "Added" else "Add") }
        },
        modifier = modifier,
    )
}

/** The description, Features, and the spec tables. Nothing when the product has none. */
@Composable
fun ProductDetails(description: String, features: List<String>, specs: List<SpecGroup>, modifier: Modifier = Modifier) {
    if (description.isEmpty() && features.isEmpty() && specs.isEmpty()) return
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (description.isNotEmpty()) {
            Spacer(Modifier.height(18.dp))
            Text(description, style = MaterialTheme.typography.bodyLarge)
        }
        if (features.isNotEmpty()) {
            Spacer(Modifier.height(18.dp))
            Text("Features", style = MaterialTheme.typography.titleMedium)
            for (feature in features) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("•")
                    Text(feature, Modifier.weight(1f))
                }
            }
        }
        for (group in specs) {
            Spacer(Modifier.height(18.dp))
            Text(group.name, style = MaterialTheme.typography.titleMedium)
            for (row in group.rows) {
                Row(Modifier.padding(vertical = 4.dp)) {
                    Text(row.label, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                    Text(row.value, Modifier.weight(1f))
                }
            }
        }
    }
}

/** [ProductDetails] for a loaded product. */
@Composable
fun ProductDetails(view: ProductView, modifier: Modifier = Modifier) =
    ProductDetails(view.description, view.features, view.specs, modifier)

/**
 * The product's reviews: the average and count, the reviews, and "Show
 * more reviews" while there are more and [onMore] is given.
 */
@Composable
fun ProductReviews(page: ProductReviewPage?, loading: Boolean, modifier: Modifier = Modifier, onMore: (() -> Unit)? = null) {
    if (page == null || page.items.isEmpty()) {
        Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Reviews", style = MaterialTheme.typography.titleMedium)
            Text(if (page == null && loading) "Loading…" else "No reviews yet.", style = MaterialTheme.typography.bodyMedium)
        }
        return
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Reviews", style = MaterialTheme.typography.titleMedium)
            StarRating(page.avgRating ?: 0.0)
            Text("${oneDecimal(page.avgRating ?: 0.0)} · ${page.totalCount}", style = MaterialTheme.typography.bodySmall)
        }
        for (review in page.items) ProductReviewRow(review)
        if (page.items.size < page.totalCount && onMore != null) {
            OutlinedButton(onClick = onMore, enabled = !loading) { Text(if (loading) "Loading…" else "Show more reviews") }
        }
    }
}

/** One product review: stars, title, what they said, who and when. */
@Composable
fun ProductReviewRow(review: ProductReview, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        StarRating(review.rating.toDouble(), size = 13.sp)
        review.title?.takeIf { it.isNotEmpty() }?.let { Text(it, style = MaterialTheme.typography.titleSmall) }
        review.body?.takeIf { it.isNotEmpty() }?.let { Text(it) }
        Text(
            listOf(review.reviewerName ?: "Customer", Reviews.date(review.createdAt)).filter { it.isNotEmpty() }.joinToString(" · "),
            style = MaterialTheme.typography.bodySmall,
        )
    }
}
