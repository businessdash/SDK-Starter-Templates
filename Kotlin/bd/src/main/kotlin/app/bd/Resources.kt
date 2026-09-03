package app.bd

import io.ktor.http.encodeURLPathPart

// The read/write surface, grouped the way the other starters group it.

// ── Storefront ────────────────────────────────────────────────────────────

public suspend fun BdClient.products(limit: Int? = null): List<Product> =
    get<ProductListResponse>(
        "storefront/products",
        mapOf("limit" to limit?.toString()),
    ).products

/**
 * The full shop grid: enriched cards plus `categoryCounts` for a filter UI.
 *
 * `sort` is one of featured | newest | price-asc | price-desc | rating-desc.
 */
public suspend fun BdClient.productGrid(
    search: String? = null,
    sort: String? = null,
    limit: Int = 24,
): List<Product> = get<ProductGridResponse>(
    "storefront/products",
    mapOf(
        "meta" to "1",
        "search" to search?.takeIf { it.isNotBlank() },
        "sort" to sort,
        "limit" to limit.toString(),
    ),
).products

public suspend fun BdClient.product(id: String): Product =
    get("storefront/products/${id.encodeURLPathPart()}")

public suspend fun BdClient.productReviews(id: String, limit: Int = 5): List<Review> =
    get<ReviewListResponse>(
        "storefront/products/${id.encodeURLPathPart()}/reviews",
        mapOf("limit" to limit.toString()),
    ).reviews

// ── Cart + checkout ───────────────────────────────────────────────────────

private fun cartHeaders(visitorToken: String) = mapOf("X-BD-Cart-Visitor" to visitorToken)

public suspend fun BdClient.cart(visitorToken: String): CartSnapshot =
    get("cart", headers = cartHeaders(visitorToken))

public suspend fun BdClient.cartAdd(
    visitorToken: String,
    productId: String,
    quantity: Int = 1,
): CartSnapshot = post(
    "cart/items",
    CartAddItemInput(productId, quantity),
    cartHeaders(visitorToken),
)

public suspend fun BdClient.cartSetQuantity(
    visitorToken: String,
    itemId: String,
    quantity: Int,
): CartSnapshot = patch(
    "cart/items/${itemId.encodeURLPathPart()}",
    CartQuantityInput(quantity),
    cartHeaders(visitorToken),
)

public suspend fun BdClient.cartRemove(visitorToken: String, itemId: String): CartSnapshot =
    delete("cart/items/${itemId.encodeURLPathPart()}", cartHeaders(visitorToken))

public suspend fun BdClient.cartClear(visitorToken: String): CartSnapshot =
    post("cart/clear", null, cartHeaders(visitorToken))

/**
 * Hand off to Stripe. Open [CheckoutSession.stripeUrl] in a browser — no card
 * data touches this process, which keeps the app out of PCI scope.
 */
public suspend fun BdClient.startCheckout(
    visitorToken: String,
    successUrl: String,
    cancelUrl: String,
): CheckoutSession = post(
    "checkout/start",
    CheckoutUrls(successUrl, cancelUrl),
    cartHeaders(visitorToken),
)

// ── Content ───────────────────────────────────────────────────────────────

public suspend fun BdClient.posts(limit: Int = 20): List<BlogPost> =
    get<BlogListResponse>("blog/posts", mapOf("limit" to limit.toString())).posts

public suspend fun BdClient.post(slug: String): BlogPostDetail =
    get("blog/posts/${slug.encodeURLPathPart()}")

public suspend fun BdClient.reviews(limit: Int = 10, offset: Int = 0): List<Review> =
    get<ReviewListResponse>(
        "reviews",
        mapOf("limit" to limit.toString(), "offset" to offset.toString()),
    ).reviews

public suspend fun BdClient.subscriptionPlans(): List<SubscriptionPlan> =
    get<SubscriptionListResponse>("subscriptions").subscriptions

// ── Forms ─────────────────────────────────────────────────────────────────

/**
 * The one surface a mobile app genuinely reimplements: `<bd-form>` is a DOM
 * web component with no Compose counterpart, so the app fetches the schema and
 * renders it with its own composables.
 */
public suspend fun BdClient.formSchema(slug: String): FormSchema =
    get("forms/${slug.encodeURLPathPart()}")

/**
 * Also the documented CREATE path for a custom collection — point a form's
 * output at the collection and post here. There is deliberately no direct
 * row-insert API, which keeps validation on the platform.
 */
public suspend fun BdClient.submitForm(
    slug: String,
    data: Map<String, String>,
    submitterEmail: String? = null,
): FormSubmitResult = post(
    "forms/${slug.encodeURLPathPart()}",
    FormSubmitInput(data, submitterEmail),
)
