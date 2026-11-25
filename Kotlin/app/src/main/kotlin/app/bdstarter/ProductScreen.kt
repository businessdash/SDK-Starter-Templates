package app.bdstarter

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bd.BdHttpException
import app.bd.Money
import app.bd.ProductAddon
import app.bd.ProductPrice
import app.bd.ProductReviewPage
import app.bd.ProductView
import app.bd.RelatedProduct
import app.bd.Reviews
import app.bd.cartAdd
import app.bd.productAddons
import app.bd.productDetail
import app.bd.productReviews
import app.bd.relatedProducts
import kotlinx.coroutines.launch
import java.net.URLEncoder
import kotlin.math.roundToInt

/**
 * One product: photos for the chosen style, the style and option rows,
 * quantity, add to cart, add-ons, features and specs, its reviews, and
 * "You may also like" / recently viewed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductScreen(productId: String) {
    val app = LocalApp.current
    val client = app.client
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    val clipboard = LocalClipboardManager.current
    var view by remember { mutableStateOf<ProductView?>(null) }
    var failure by remember { mutableStateOf<Throwable?>(null) }
    var variantId by remember { mutableStateOf<String?>(null) }
    var chosen by remember { mutableStateOf(mapOf<String, String>()) }
    var quantity by remember { mutableIntStateOf(1) }
    var adding by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var related by remember { mutableStateOf(emptyList<RelatedProduct>()) }
    var addons by remember { mutableStateOf(emptyList<ProductAddon>()) }
    val addedAddons = remember { mutableStateListOf<String>() }
    var reviews by remember { mutableStateOf<ProductReviewPage?>(null) }
    var reviewLimit by remember { mutableIntStateOf(10) }
    var loadingReviews by remember { mutableStateOf(false) }

    LaunchedEffect(client, productId) {
        client ?: return@LaunchedEffect
        bdCall { client.productDetail(productId) }
            .onSuccess { loaded ->
                view = loaded
                variantId = loaded.defaultVariant?.id
                app.recentlyViewed.add(loaded.saved())
            }
            .onFailure { failure = it }
    }
    LaunchedEffect(client, productId) {
        client ?: return@LaunchedEffect
        bdCall { client.relatedProducts(productId) }.onSuccess { related = it }
        bdCall { client.productAddons(productId) }.onSuccess { addons = it }
    }
    // "Show more" asks for a longer page; the reviews on screen stay while it loads.
    LaunchedEffect(client, productId, reviewLimit) {
        client ?: return@LaunchedEffect
        loadingReviews = true
        bdCall { client.productReviews(productId, limit = reviewLimit) }.onSuccess { reviews = it }
        loadingReviews = false
    }

    fun addToCart(product: ProductView, style: String) {
        client ?: return
        adding = true
        message = null
        scope.launch {
            bdCall {
                client.cartAdd(
                    app.visitorToken,
                    productId = product.id,
                    quantity = quantity,
                    variantId = style,
                    options = product.chosenOptions(style, chosen),
                )
            }.onSuccess { cart ->
                app.noteCart(cart)
                adding = false
                val result = snackbar.showSnackbar("Added ${product.name} to your cart.", actionLabel = "View cart", withDismissAction = true)
                if (result == SnackbarResult.ActionPerformed) app.showTab(Tab.Cart)
            }.onFailure {
                message = bdProblem(it, "Couldn't add it to your cart. Try again.")
                adding = false
            }
        }
    }

    fun addAddon(addon: ProductAddon) {
        client ?: return
        scope.launch {
            bdCall { client.cartAdd(app.visitorToken, productId = addon.addonProductId, variantId = addon.firstVariantId) }
                .onSuccess {
                    app.noteCart(it)
                    addedAddons += addon.id
                }
                .onFailure { message = "Couldn't add ${addon.name}. Try again." }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(view?.name ?: "Product", maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = { BackButton() },
                actions = {
                    val loaded = view
                    if (loaded != null && BuildConfig.BD_SITE_URL.isNotEmpty()) {
                        IconButton(onClick = {
                            clipboard.setText(AnnotatedString(productLink(loaded.id)))
                            scope.launch { snackbar.showSnackbar("Link copied.") }
                        }) { Icon(Icons.Filled.Share, contentDescription = "Copy link") }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        val loaded = view
        val problem = failure
        when {
            loaded != null -> {
                val style = variantId
                val groups = style?.let { loaded.optionGroups(it) }.orEmpty()
                val price = style?.let { loaded.price(it, chosen) } ?: ProductPrice(amount = null, from = false, ready = false)
                val gallery = style?.let { loaded.gallery(it) } ?: loaded.images
                val stock = price.stock
                val maxQuantity = stock?.coerceIn(1, 99) ?: 99
                val recent = app.recentlyViewed.items.filter { it.id != loaded.id }
                LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(top = 8.dp, bottom = 32.dp)) {
                    item {
                        Column(Modifier.padding(horizontal = 16.dp)) {
                            if (gallery.isNotEmpty()) Gallery(gallery, loaded.name)
                            Spacer(Modifier.height(16.dp))
                            loaded.categoryName?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                            Text(loaded.name, style = MaterialTheme.typography.headlineSmall)
                            Spacer(Modifier.height(4.dp))
                            val amount = price.amount
                            Text(
                                if (amount == null) "Unavailable" else (if (price.from) "From " else "") + Money.amount(amount),
                                style = MaterialTheme.typography.titleLarge,
                            )
                            if (stock != null && stock in 1..5) {
                                Text(
                                    "Only $stock left",
                                    color = MaterialTheme.colorScheme.error,
                                    fontWeight = FontWeight.SemiBold,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                            Spacer(Modifier.height(12.dp))
                            SaveButtons(loaded.saved())
                            if (loaded.variants.size > 1) {
                                OptionRow(
                                    title = "Style",
                                    options = loaded.variants.map { Option(it.id, it.name, it.available) },
                                    selected = style,
                                    onSelect = {
                                        variantId = it
                                        chosen = emptyMap()
                                        quantity = 1
                                        message = null
                                    },
                                )
                            }
                            for (group in groups) {
                                OptionRow(
                                    title = group.title,
                                    options = group.values.map { Option(it.id, it.value, it.available) },
                                    selected = chosen[group.id],
                                    onSelect = {
                                        chosen = chosen + (group.id to it)
                                        quantity = 1
                                    },
                                )
                            }
                            Spacer(Modifier.height(16.dp))
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Stepper(quantity, maxQuantity) { quantity = it }
                                Button(
                                    onClick = { if (style != null) addToCart(loaded, style) },
                                    enabled = !adding && price.ready && style != null,
                                    modifier = Modifier.weight(1f),
                                ) {
                                    Text(
                                        when {
                                            adding -> "Adding…"
                                            price.ready -> "Add to cart"
                                            groups.isNotEmpty() -> "Choose options"
                                            else -> "Unavailable"
                                        },
                                    )
                                }
                            }
                            message?.let {
                                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
                            }
                        }
                    }
                    if (addons.isNotEmpty()) {
                        item {
                            Text(
                                addons.first().groupLabel ?: "Goes well with",
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp),
                            )
                        }
                        for (addon in addons) {
                            item(key = "addon-${addon.id}") {
                                val added = addon.id in addedAddons
                                ListItem(
                                    leadingContent = { Photo(addon.imageUrl, Modifier.size(48.dp).clip(RoundedCornerShape(8.dp))) },
                                    headlineContent = { Text(addon.name) },
                                    supportingContent = if (addon.priceCents == null) null else ({ Text(Money.cents(addon.priceCents)) }),
                                    trailingContent = {
                                        OutlinedButton(onClick = { addAddon(addon) }, enabled = !added) { Text(if (added) "Added" else "Add") }
                                    },
                                )
                            }
                        }
                    }
                    item {
                        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (loaded.description.isNotEmpty()) {
                                Spacer(Modifier.height(18.dp))
                                Text(loaded.description, style = MaterialTheme.typography.bodyLarge)
                            }
                            if (loaded.features.isNotEmpty()) {
                                Spacer(Modifier.height(18.dp))
                                Text("Features", style = MaterialTheme.typography.titleMedium)
                                for (feature in loaded.features) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Text("•")
                                        Text(feature, Modifier.weight(1f))
                                    }
                                }
                            }
                            for (group in loaded.specs) {
                                Spacer(Modifier.height(18.dp))
                                Text(group.name, style = MaterialTheme.typography.titleMedium)
                                for (row in group.rows) {
                                    Row(Modifier.padding(vertical = 4.dp)) {
                                        Text(row.label, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                                        Text(row.value, Modifier.weight(1f))
                                    }
                                }
                            }
                            Spacer(Modifier.height(18.dp))
                            ProductReviews(
                                page = reviews,
                                loading = loadingReviews,
                                onMore = if (reviewLimit >= 100) null else ({ reviewLimit = (reviewLimit + 10).coerceAtMost(100) }),
                            )
                            Spacer(Modifier.height(18.dp))
                        }
                    }
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                            ProductRail("You may also like", related.map { it.saved() })
                            ProductRail("Recently viewed", recent)
                        }
                    }
                }
            }
            client == null -> Notice("Not connected to BD.", Modifier.padding(padding))
            problem != null -> Notice(
                if (problem is BdHttpException && problem.status == 404) "Product not found." else "Couldn't load this product.",
                Modifier.padding(padding),
            )
            else -> Loading(Modifier.padding(padding))
        }
    }
}

/** The store's own page for a product, for "Copy link". */
private fun productLink(id: String): String =
    "${BuildConfig.BD_SITE_URL.trimEnd('/')}/store/${URLEncoder.encode(id, "UTF-8").replace("+", "%20")}"

private fun ProductView.saved(): SavedProduct {
    val price = defaultVariant?.price
    return SavedProduct(id, name, images.firstOrNull(), price?.let { (it * 100).roundToInt() })
}

private fun RelatedProduct.saved() =
    SavedProduct(id, name, coverImageUrl, minPriceDollars?.let { (it * 100).roundToInt() })

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Gallery(urls: List<String>, name: String) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val side = maxWidth.coerceAtMost(520.dp)
        // A new style's photos start again at the first.
        val pager = androidx.compose.runtime.key(urls) { rememberPagerState { urls.size } }
        HorizontalPager(pager, Modifier.fillMaxWidth().height(side), pageSpacing = 4.dp) { index ->
            Photo(
                urls[index],
                Modifier.fillMaxSize().clip(RoundedCornerShape(14.dp)),
                label = if (urls.size > 1) "$name, photo ${index + 1} of ${urls.size}" else name,
            )
        }
    }
}

private data class Option(val id: String, val label: String, val available: Boolean)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OptionRow(title: String, options: List<Option>, selected: String?, onSelect: (String) -> Unit) {
    val current = options.firstOrNull { it.id == selected }
    Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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

/** − 1 +, between 1 and [max]. */
@Composable
fun Stepper(value: Int, max: Int, modifier: Modifier = Modifier, onChange: (Int) -> Unit) {
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

@Composable
private fun ProductReviews(page: ProductReviewPage?, loading: Boolean, onMore: (() -> Unit)?) {
    if (page == null || page.items.isEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Reviews", style = MaterialTheme.typography.titleMedium)
            Text(if (page == null && loading) "Loading…" else "No reviews yet.", style = MaterialTheme.typography.bodyMedium)
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Reviews", style = MaterialTheme.typography.titleMedium)
            StarRating(page.avgRating ?: 0.0)
            Text("${oneDecimal(page.avgRating ?: 0.0)} · ${page.totalCount}", style = MaterialTheme.typography.bodySmall)
        }
        for (review in page.items) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                StarRating(review.rating.toDouble(), size = 13.sp)
                review.title?.takeIf { it.isNotEmpty() }?.let { Text(it, style = MaterialTheme.typography.titleSmall) }
                review.body?.takeIf { it.isNotEmpty() }?.let { Text(it) }
                Text(
                    listOf(review.reviewerName ?: "Customer", Reviews.date(review.createdAt)).filter { it.isNotEmpty() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        if (page.items.size < page.totalCount && onMore != null) {
            OutlinedButton(onClick = onMore, enabled = !loading) { Text(if (loading) "Loading…" else "Show more reviews") }
        }
    }
}

/** The back arrow on a screen opened over the tabs. */
@Composable
fun BackButton() {
    val app = LocalApp.current
    IconButton(onClick = { app.back() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
}

/** A spinner in the middle of a screen. */
@Composable
fun Loading(modifier: Modifier = Modifier) {
    androidx.compose.foundation.layout.Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}
