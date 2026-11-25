package app.bdstarter

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.bd.BdHttpException
import app.bd.ProductAddon
import app.bd.ProductPrice
import app.bd.ProductReviewPage
import app.bd.ProductView
import app.bd.RelatedProduct
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
                val maxQuantity = price.stock?.coerceIn(1, 99) ?: 99
                val recent = app.recentlyViewed.items.filter { it.id != loaded.id }
                LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(top = 8.dp, bottom = 32.dp)) {
                    item {
                        Column(Modifier.padding(horizontal = 16.dp)) {
                            ProductGallery(gallery, loaded.name)
                            Spacer(Modifier.height(16.dp))
                            ProductTitle(loaded.categoryName, loaded.name)
                            Spacer(Modifier.height(4.dp))
                            ProductPriceText(price)
                            StockNote(price.stock)
                            Spacer(Modifier.height(12.dp))
                            SaveButtons(loaded.saved())
                            VariantPicker(loaded.variants, style) {
                                variantId = it
                                chosen = emptyMap()
                                quantity = 1
                                message = null
                            }
                            for (group in groups) {
                                OptionPicker(group, chosen[group.id]) {
                                    chosen = chosen + (group.id to it)
                                    quantity = 1
                                }
                            }
                            Spacer(Modifier.height(16.dp))
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                QuantityStepper(quantity, maxQuantity) { quantity = it }
                                AddToCartButton(
                                    price,
                                    adding = adding,
                                    hasOptions = groups.isNotEmpty(),
                                    modifier = Modifier.weight(1f),
                                    enabled = style != null,
                                ) { if (style != null) addToCart(loaded, style) }
                            }
                            message?.let { ProductNotice(it) }
                        }
                    }
                    if (addons.isNotEmpty()) {
                        item(key = "addons") { ProductAddons(addons, addedAddons.toSet()) { addAddon(it) } }
                    }
                    item {
                        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            ProductDetails(loaded)
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
