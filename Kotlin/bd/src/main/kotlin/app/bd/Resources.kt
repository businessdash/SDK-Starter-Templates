package app.bd

import io.ktor.http.encodeURLPathPart
import kotlinx.serialization.json.JsonObject

// The read/write surface, grouped the way the other starters group it.

// ── Storefront ────────────────────────────────────────────────────────────

public suspend fun BdClient.products(limit: Int? = null): List<Product> =
    get<ProductListResponse>(
        "storefront/products",
        mapOf("limit" to limit?.toString()),
    ).products

/**
 * The full shop grid: enriched cards, the products per category for the
 * current search (`categoryCounts`), and the price range in dollars.
 *
 * `sort` is one of featured | newest | price-asc | price-desc | rating-desc.
 * Prices are **integer cents**; `minRating` is 1 to 5.
 */
public suspend fun BdClient.productListing(
    search: String? = null,
    categoryId: String? = null,
    minPriceCents: Int? = null,
    maxPriceCents: Int? = null,
    minRating: Int? = null,
    sort: String? = null,
    limit: Int = 24,
): ProductListing = get(
    "storefront/products",
    mapOf(
        "meta" to "1",
        "search" to search?.takeIf { it.isNotBlank() },
        "categoryId" to categoryId,
        "minPriceCents" to minPriceCents?.toString(),
        "maxPriceCents" to maxPriceCents?.toString(),
        "minRating" to minRating?.toString(),
        "sort" to sort,
        "limit" to limit.toString(),
    ),
)

/** The grid's cards alone. See [productListing] for the counts and filters. */
public suspend fun BdClient.productGrid(
    search: String? = null,
    sort: String? = null,
    limit: Int = 24,
): List<Product> = productListing(search = search, sort = sort, limit = limit).products

public suspend fun BdClient.categories(): List<ProductCategory> =
    get<ProductCategoryList>("storefront/categories").items

public suspend fun BdClient.product(id: String): Product =
    get("storefront/products/${id.encodeURLPathPart()}")

/** A product with its styles, options, photos and specs, for the product page. */
public suspend fun BdClient.productDetail(id: String): ProductView =
    ProductView.from(get<JsonObject>("storefront/products/${id.encodeURLPathPart()}"))

public suspend fun BdClient.relatedProducts(id: String, limit: Int = 6): List<RelatedProduct> =
    get<RelatedProductList>(
        "storefront/products/${id.encodeURLPathPart()}/related",
        mapOf("limit" to limit.toString()),
    ).items

/** A product's approved reviews, with its average and how many there are. */
public suspend fun BdClient.productReviews(id: String, limit: Int = 10): ProductReviewPage =
    get(
        "storefront/products/${id.encodeURLPathPart()}/reviews",
        mapOf("limit" to limit.toString()),
    )

/** What is sold alongside a product. Each goes in the cart as its own line. */
public suspend fun BdClient.productAddons(id: String): List<ProductAddon> =
    get<ProductAddonList>("storefront/products/${id.encodeURLPathPart()}/addons").items

// ── Cart + checkout ───────────────────────────────────────────────────────

private fun cartHeaders(visitorToken: String) = mapOf("X-BD-Cart-Visitor" to visitorToken)

public suspend fun BdClient.cart(visitorToken: String): CartSnapshot =
    get("cart", headers = cartHeaders(visitorToken))

/**
 * Add a product in a style ([variantId]) with its chosen [options]
 * (`{"Size": "M"}`, from [ProductView.chosenOptions]).
 */
public suspend fun BdClient.cartAdd(
    visitorToken: String,
    productId: String,
    quantity: Int = 1,
    variantId: String? = null,
    options: Map<String, String>? = null,
): CartSnapshot = post(
    "cart/items",
    CartAddItemInput(productId, quantity, variantId, options?.ifEmpty { null }),
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

/** A code the business doesn't know answers 4xx with a message to show. */
public suspend fun BdClient.cartApplyCoupon(visitorToken: String, code: String): CartSnapshot =
    post("cart/coupon", CouponInput(code), cartHeaders(visitorToken))

public suspend fun BdClient.cartRemoveCoupon(visitorToken: String): CartSnapshot =
    delete("cart/coupon", cartHeaders(visitorToken))

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

/** After Stripe sends the customer back: was it paid? `sessionId` is Stripe's `session_id`. */
public suspend fun BdClient.checkoutStatus(sessionId: String): CheckoutStatus =
    get("checkout/${sessionId.encodeURLPathPart()}")

// ── Blog ──────────────────────────────────────────────────────────────────
//
// Liking and commenting are done as the signed-in customer: their session
// token goes out as `X-BD-Session-Token` (the portal's header, not the
// `x-bd-session` that sign-in's `auth/me` takes).

private fun sessionHeaders(token: String?) =
    if (token == null) emptyMap() else mapOf("X-BD-Session-Token" to token)

public suspend fun BdClient.posts(limit: Int = 20): List<BlogPost> = blogPage(limit).posts

/** A page of posts, newest first. Pass the last page's `nextCursor` as [cursor] for more. */
public suspend fun BdClient.blogPage(
    limit: Int = 20,
    cursor: Int? = null,
    categoryId: String? = null,
): BlogPage = get(
    "blog/posts",
    mapOf("limit" to limit.toString(), "cursor" to cursor?.toString(), "categoryId" to categoryId),
)

public suspend fun BdClient.blogCategories(): List<BlogCategory> =
    get<BlogCategoryList>("blog/categories").items

public suspend fun BdClient.blogTags(): List<String> =
    get<BlogTagList>("blog/tags").items

/** Signed in, a members-only post comes back whole when the customer may read it. */
public suspend fun BdClient.blogPost(slug: String, sessionToken: String? = null): BlogPostDetail =
    get("blog/posts/${slug.encodeURLPathPart()}", headers = sessionHeaders(sessionToken))

public suspend fun BdClient.postLikes(slug: String, sessionToken: String? = null): PostLikes =
    get("blog/posts/${slug.encodeURLPathPart()}/like", headers = sessionHeaders(sessionToken))

/** Like, or unlike when already liked. */
public suspend fun BdClient.togglePostLike(slug: String, sessionToken: String): PostLikes =
    post("blog/posts/${slug.encodeURLPathPart()}/like", null, sessionHeaders(sessionToken))

/** Approved comments, oldest first. */
public suspend fun BdClient.postComments(slug: String, limit: Int = 50): List<BlogComment> =
    get<BlogCommentList>(
        "blog/posts/${slug.encodeURLPathPart()}/comments",
        mapOf("limit" to limit.toString()),
    ).items

public suspend fun BdClient.postComment(slug: String, content: String, sessionToken: String): CommentPosted =
    post(
        "blog/posts/${slug.encodeURLPathPart()}/comments",
        CommentInput(content),
        sessionHeaders(sessionToken),
    )

// ── Business reviews ──────────────────────────────────────────────────────

public suspend fun BdClient.reviews(limit: Int = 10, offset: Int = 0): List<Review> =
    reviewPage(limit, offset).reviews

/** A page of the business's reviews, newest first; [source] keeps one platform's. */
public suspend fun BdClient.reviewPage(
    limit: Int = Reviews.PAGE_SIZE,
    offset: Int = 0,
    source: String? = null,
): ReviewPage = get(
    "reviews",
    mapOf("limit" to limit.toString(), "offset" to offset.toString(), "source" to source),
)

/** The marketing bundle for one page of the site: whatever `bd.config.ts` declared. */
public suspend fun BdClient.pageBundle(pageKey: String = "home"): JsonObject =
    get(sitePath("marketing/bundle"), mapOf("pageKey" to pageKey))

/**
 * The average and a count per star for the reviews summary, from the page
 * bundle's `reviews` block. Null when the site has none.
 */
public suspend fun BdClient.reviewTotals(): ReviewTotals? =
    (pageBundle()["reviews"] as? JsonObject)?.let { json.decodeFromJsonElement(ReviewTotals.serializer(), it) }

// ── Content ───────────────────────────────────────────────────────────────

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
