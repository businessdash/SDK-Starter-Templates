package app.bdstarter

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalIconToggleButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bd.BdAccessRejectedException
import app.bd.BdException
import app.bd.BdHttpException
import app.bd.Money
import app.bd.Product
import app.bd.ReviewTotals
import app.bd.Reviews
import coil3.compose.AsyncImage
import java.util.Locale

/**
 * Runs a BD call. A BD failure comes back as the result's exception; a screen
 * that moved on (cancellation) still cancels.
 */
suspend fun <T> bdCall(block: suspend () -> T): Result<T> =
    try {
        Result.success(block())
    } catch (error: BdException) {
        Result.failure(error)
    }

/**
 * What to tell the customer when a call fails: BD's own message when it sent
 * one (a coupon it doesn't know, a sold-out size), else [fallback].
 */
fun bdProblem(error: Throwable, fallback: String): String = when (error) {
    // Without a message from BD, the exception says which path failed: not for a customer.
    is BdHttpException -> error.message?.takeIf { it.isNotBlank() && !it.startsWith("BD request to ") } ?: fallback
    is BdAccessRejectedException -> error.message ?: fallback
    else -> fallback
}

/** BD's own message for a failed load, saying when the business is temporarily unavailable. */
fun loadProblem(error: Throwable, what: String): String =
    if (error is BdException && error.isUnavailable) "The $what is temporarily unavailable." else "Couldn't load the $what."

/** 4.1, in any locale. */
fun oneDecimal(value: Double): String = String.format(Locale.US, "%.1f", value)

/** ★★★★☆, with the rating said out loud. */
@Composable
fun StarRating(rating: Double, size: TextUnit = 14.sp, modifier: Modifier = Modifier) {
    Text(
        Reviews.stars(rating),
        color = MaterialTheme.colorScheme.primary,
        fontSize = size,
        modifier = modifier.clearAndSetSemantics { contentDescription = "${oneDecimal(rating)} out of 5" },
    )
}

/** A photo from the web, on a soft box while it loads or when there is none. */
@Composable
fun Photo(url: String?, modifier: Modifier = Modifier, label: String? = null, contentScale: ContentScale = ContentScale.Crop) {
    val soft = MaterialTheme.colorScheme.surfaceVariant
    if (url.isNullOrEmpty()) {
        Box(modifier.background(soft))
    } else {
        AsyncImage(model = url, contentDescription = label, contentScale = contentScale, modifier = modifier.background(soft))
    }
}

/** A message in the middle of a screen, with an optional button. */
@Composable
fun Notice(message: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(
        modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(message, textAlign = TextAlign.Center)
        action?.invoke()
    }
}

/** A card in the store grid: photo, badges, stars, "From" and sale prices. */
@Composable
fun ProductCard(product: Product, modifier: Modifier = Modifier) {
    val app = LocalApp.current
    val reviews = product.reviewCount ?: 0
    val price = product.cheapestPriceCents
    OutlinedCard(onClick = { app.open(Route.Product(product.id)) }, modifier = modifier) {
        Box(Modifier.fillMaxWidth().aspectRatio(1f)) {
            Photo(product.coverImage, Modifier.fillMaxSize())
            Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (product.isBestSeller == true) Badge("Best seller")
                if (product.isNew == true) Badge("New")
                if (product.isOnSale == true) Badge("Sale", sale = true)
            }
            SaveButtons(SavedProduct.of(product), compact = true, modifier = Modifier.align(Alignment.TopEnd).padding(4.dp))
        }
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                product.name.ifEmpty { "Untitled" },
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.titleSmall,
            )
            if (reviews > 0) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    StarRating(product.avgRating ?: 0.0, size = 13.sp)
                    Text("($reviews)", style = MaterialTheme.typography.bodySmall)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (price == null) "View details" else (if (product.hasMultipleVariants == true) "From " else "") + Money.cents(price),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                if (product.isOnSale == true && product.comparePriceCents != null) {
                    Text(
                        Money.cents(product.comparePriceCents),
                        style = MaterialTheme.typography.bodySmall,
                        textDecoration = TextDecoration.LineThrough,
                    )
                }
            }
            if (product.isLowStock == true) {
                Text("Low stock", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun Badge(label: String, sale: Boolean = false) {
    val scheme = MaterialTheme.colorScheme
    Text(
        label,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = if (sale) scheme.onError else scheme.onSurface,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (sale) scheme.error else scheme.surface)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

/** Save to the wishlist (♥) and pick for comparing (⇄). */
@Composable
fun SaveButtons(product: SavedProduct, modifier: Modifier = Modifier, compact: Boolean = false) {
    val app = LocalApp.current
    val saved = product.id in app.wishlist
    val picked = product.id in app.compare
    val full = !picked && app.compare.isFull
    val compareLabel = when {
        picked -> "Remove from compare"
        full -> "Compare holds four products"
        else -> "Compare"
    }
    if (compact) {
        Row(modifier) {
            FilledTonalIconToggleButton(
                checked = saved,
                onCheckedChange = { app.wishlist.toggle(product) },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    if (saved) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                    contentDescription = if (saved) "Remove from wishlist" else "Save to wishlist",
                    modifier = Modifier.size(18.dp),
                )
            }
            FilledTonalIconToggleButton(
                checked = picked,
                onCheckedChange = { app.compare.toggle(product) },
                enabled = !full,
                // Its own stop for TalkBack, read as "Compare, checkbox, checked".
                modifier = Modifier.size(36.dp).semantics { contentDescription = compareLabel },
            ) {
                Text("⇄", fontSize = 16.sp, modifier = Modifier.clearAndSetSemantics { })
            }
        }
    } else {
        Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = saved,
                onClick = { app.wishlist.toggle(product) },
                label = { Text(if (saved) "Saved" else "Save") },
                leadingIcon = {
                    Icon(if (saved) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, null, Modifier.size(18.dp))
                },
            )
            FilterChip(
                selected = picked,
                onClick = { app.compare.toggle(product) },
                enabled = !full,
                label = { Text(if (picked) "Comparing" else if (full) "Compare holds four" else "Compare") },
                leadingIcon = { Text("⇄") },
            )
        }
    }
}

/** Along the bottom of the store while products are picked to compare. */
@Composable
fun CompareBar() {
    val app = LocalApp.current
    val picks = app.compare.items.size
    if (picks == 0) return
    Surface(tonalElevation = 3.dp, shadowElevation = 3.dp) {
        Row(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("$picks of ${app.compare.limit} picked to compare", Modifier.weight(1f))
            TextButton(onClick = app.compare::clear) { Text("Clear") }
            Button(onClick = { app.open(Route.Compare) }, enabled = picks >= 2) {
                Text(if (picks < 2) "Pick one more" else "Compare")
            }
        }
    }
}

/** A row of saved products (related, recently viewed). */
@Composable
fun ProductRail(title: String, products: List<SavedProduct>) {
    if (products.isEmpty()) return
    val app = LocalApp.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 16.dp))
        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(products, key = { it.id }) { product ->
                Column(
                    Modifier.width(132.dp).clickable { app.open(Route.Product(product.id)) },
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Photo(product.image, Modifier.size(132.dp).clip(RoundedCornerShape(10.dp)))
                    Text(product.name, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelLarge)
                    if (product.priceCents != null) Text(Money.cents(product.priceCents), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

/** The business's rating at the top of the store; it opens the reviews. */
@Composable
fun ReviewStrip(totals: ReviewTotals?, modifier: Modifier = Modifier) {
    val rating = totals?.rating
    val total = totals?.totalCount ?: 0
    if (rating == null || total == 0) return
    val app = LocalApp.current
    val label = "Rated ${oneDecimal(rating)} from $total reviews. See all reviews."
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier.fillMaxWidth().clearAndSetSemantics {
            contentDescription = label
            role = Role.Button
            onClick { app.open(Route.Reviews); true }
        },
        onClick = { app.open(Route.Reviews) },
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            StarRating(rating)
            Text(oneDecimal(rating), style = MaterialTheme.typography.titleSmall)
            Text(
                "· $total ${if (total == 1) "review" else "reviews"}",
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, modifier = Modifier.size(18.dp))
        }
    }
}
