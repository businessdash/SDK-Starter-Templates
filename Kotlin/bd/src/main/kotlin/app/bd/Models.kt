package app.bd

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Nearly every field is nullable with a default on purpose. The platform
// returns a superset that grows release to release, and an app that hard-fails
// decoding because a new nullable column appeared is an app that breaks on
// somebody else's deploy. `ignoreUnknownKeys` covers the other direction.

/**
 * A product **card** — what the storefront grid returns.
 *
 * The field names are the platform's, not the obvious ones: the price is
 * `cheapestPriceCents` (a product can have variants, so there is no single
 * price), the image is `coverImage`, and a card carries no `currency` — the
 * cart does.
 */
@Serializable
public data class Product(
    val id: String,
    val name: String = "",
    val description: String? = null,
    val categoryId: String? = null,
    /** **Integer cents.** The cheapest variant's price. See [Money]. */
    val cheapestPriceCents: Int? = null,
    val comparePriceCents: Int? = null,
    val coverImage: String? = null,
    val avgRating: Double? = null,
    val reviewCount: Int? = null,
    val isOnSale: Boolean? = null,
    val isNew: Boolean? = null,
    val isBestSeller: Boolean? = null,
    val isLowStock: Boolean? = null,
    /** More than one style: the card's price reads "from". */
    val hasMultipleVariants: Boolean? = null,
)

/**
 * Every list response on the platform is keyed `items`, not the plural of the
 * thing. Decoded under the wire name; `products` is a readable alias.
 */
@Serializable
public data class ProductListResponse(
    val items: List<Product> = emptyList(),
) {
    public val products: List<Product> get() = items
}

/**
 * The full shop grid (`meta=1`): the cards, how many products each category
 * holds for the current search, and the price range in **dollars**.
 */
@Serializable
public data class ProductListing(
    val items: List<Product> = emptyList(),
    @SerialName("categoryCounts") val categoryCountRows: List<CategoryCount> = emptyList(),
    val priceRange: PriceRange? = null,
) {
    public val products: List<Product> get() = items

    /** Products per category id. */
    public val categoryCounts: Map<String, Int>
        get() = categoryCountRows.mapNotNull { row -> row.categoryId?.let { it to row.count } }.toMap()
}

/** Note `categoryId`: a count names its category by id only. */
@Serializable
public data class CategoryCount(
    val categoryId: String? = null,
    val count: Int = 0,
)

/** **Dollars**, unlike a card's cents. */
@Serializable
public data class PriceRange(
    val minDollars: Double? = null,
    val maxDollars: Double? = null,
)

@Serializable
public data class ProductCategory(
    val id: String,
    val name: String = "",
    val slug: String? = null,
)

@Serializable
public data class ProductCategoryList(
    val items: List<ProductCategory> = emptyList(),
)

/** A "you might also like" card. Note the **dollars** and `coverImageUrl`. */
@Serializable
public data class RelatedProduct(
    val id: String,
    val name: String = "",
    val coverImageUrl: String? = null,
    val minPriceDollars: Double? = null,
)

@Serializable
public data class RelatedProductList(
    val items: List<RelatedProduct> = emptyList(),
)

/**
 * A review of one product, written in the shop. Not a [Review]: a product
 * review has a `title` and a `body` (older rows say `content`).
 */
@Serializable
public data class ProductReview(
    val id: String,
    val rating: Int = 0,
    val title: String? = null,
    @SerialName("body") val bodyText: String? = null,
    val content: String? = null,
    val reviewerName: String? = null,
    val createdAt: String? = null,
) {
    public val body: String? get() = bodyText ?: content
}

@Serializable
public data class ProductReviewPage(
    val items: List<ProductReview> = emptyList(),
    val avgRating: Double? = null,
    val totalCount: Int = 0,
    val nextCursor: Int? = null,
)

/**
 * Something sold alongside a product ("Add socks"). It goes in the cart as
 * its own product, in its first style: the variant rows' id is `variantId`.
 */
@Serializable
public data class ProductAddon(
    val id: String,
    val addonProductId: String,
    @SerialName("addonName") val name: String = "",
    val groupLabel: String? = null,
    /** **Integer cents.** */
    val priceCents: Int? = null,
    val originalPriceCents: Int? = null,
    val imageUrl: String? = null,
    val variants: List<JsonObject> = emptyList(),
) {
    /** The style it goes in as (`variantId`, or `id` as the web starters also read). */
    public val firstVariantId: String?
        get() {
            val first = variants.firstOrNull() ?: return null
            val id = (first["variantId"] as? JsonPrimitive)?.takeIf { it.isString }?.content
                ?: (first["id"] as? JsonPrimitive)?.takeIf { it.isString }?.content
            return id?.takeIf { it.isNotEmpty() }
        }
}

@Serializable
public data class ProductAddonList(
    val items: List<ProductAddon> = emptyList(),
)

@Serializable
public data class CartItem(
    val id: String,
    val quantity: Int = 1,
    val productId: String? = null,
    val variantId: String? = null,
    val productName: String? = null,
    /** The style and options, e.g. "Onyx · Size 42". */
    val variantTitle: String? = null,
    val productImage: String? = null,
    /** **Already decimal**, unlike [Product.cheapestPriceCents]. */
    val unitPrice: Double? = null,
    /** **Already decimal.** */
    val subtotal: Double? = null,
    @SerialName("name") val plainName: String? = null,
) {
    /** The API says `productName`; `name` is read too, as the web starters do. */
    public val name: String? get() = productName ?: plainName
}

@Serializable
public data class CartSnapshot(
    val items: List<CartItem> = emptyList(),
    /** **Already decimal.** */
    val subtotal: Double? = null,
    val currency: String? = null,
    val couponCode: String? = null,
    val itemCount: Int? = null,
) {
    public val isEmpty: Boolean get() = items.isEmpty()

    /** Units in the cart, for a badge. */
    public val units: Int get() = itemCount ?: items.sumOf { it.quantity }

    public companion object {
        public val EMPTY: CartSnapshot = CartSnapshot()
    }
}

@Serializable
public data class CartAddItemInput(
    val productId: String,
    // No default, so it is always sent.
    val quantity: Int,
    val variantId: String? = null,
    /** The chosen options by group title: `{"Size": "M"}`. */
    val options: Map<String, String>? = null,
)

@Serializable
public data class CartQuantityInput(val quantity: Int)

@Serializable
public data class CouponInput(val code: String)

@Serializable
public data class CheckoutUrls(
    val successUrl: String,
    val cancelUrl: String,
)

@Serializable
public data class CheckoutSession(
    /** Note the name: **`stripeUrl`**, not `url`. */
    val stripeUrl: String,
    val sessionId: String? = null,
    val totalAmountCents: Int? = null,
)

/** Where a Stripe checkout stands, read after Stripe sends the customer back. */
@Serializable
public data class CheckoutStatus(
    val paymentStatus: String? = null,
    val customerEmail: String? = null,
) {
    public val isPaid: Boolean get() = paymentStatus == "paid"
}

@Serializable
public data class BlogPost(
    val id: String,
    val slug: String = "",
    val title: String = "",
    val excerpt: String? = null,
    /** Authored HTML — the field is `content`, not `contentHtml`. */
    val content: String? = null,
    val imageUrl: String? = null,
    /** `public` | `followers` | `paid`. */
    val accessLevel: String? = null,
    val categoryId: String? = null,
    val publishedAt: String? = null,
    val isPinned: Boolean = false,
    val authorName: String? = null,
    val authorAvatarUrl: String? = null,
    val tags: List<String> = emptyList(),
    val likes: Int = 0,
    /** A call to action under the post: a label, an address and a line about it. */
    val ctaLabel: String? = null,
    val ctaHref: String? = null,
    val ctaDescription: String? = null,
)

/** A page of posts, newest first; pass [nextCursor] back for the next page. */
@Serializable
public data class BlogPage(
    val items: List<BlogPost> = emptyList(),
    val nextCursor: Int? = null,
) {
    public val posts: List<BlogPost> get() = items
}

@Serializable
public data class BlogCategory(
    val id: String,
    val name: String = "",
    val slug: String? = null,
    val description: String? = null,
)

@Serializable
public data class BlogCategoryList(
    val items: List<BlogCategory> = emptyList(),
)

@Serializable
public data class BlogTagList(
    val items: List<String> = emptyList(),
)

/**
 * `blog/posts/{slug}` wraps the post: `{ post, access }`. `access` is
 * "granted" or "paywall" — a paywalled post comes back TRUNCATED rather than
 * absent, so a screen that ignores the flag renders a teaser as the article.
 */
@Serializable
public data class BlogPostDetail(
    val post: BlogPost,
    val access: String = "granted",
) {
    public val isPaywalled: Boolean get() = access == "paywall"
}

@Serializable
public data class BlogComment(
    val id: String,
    val content: String = "",
    val authorName: String? = null,
    val createdAt: String? = null,
)

@Serializable
public data class BlogCommentList(
    val items: List<BlogComment> = emptyList(),
)

@Serializable
public data class CommentInput(val content: String)

/** Note `likesCount`. */
@Serializable
public data class PostLikes(
    val liked: Boolean = false,
    @SerialName("likesCount") val count: Int = 0,
)

/** A comment is held for the business to approve unless `isApproved`. */
@Serializable
public data class CommentPosted(
    val moderation: CommentModeration? = null,
) {
    public val isApproved: Boolean get() = moderation?.isApproved == true
}

@Serializable
public data class CommentModeration(
    val isApproved: Boolean = false,
)

/**
 * A review of the business, from Google, Yelp, Housecall Pro or written in
 * the app. Note `text` and `reviewerName` — not `body` and `authorName`.
 */
@Serializable
public data class Review(
    val id: String,
    val rating: Double = 0.0,
    val text: String? = null,
    val reviewerName: String? = null,
    val reviewerImageUrl: String? = null,
    /** `google` | `yelp` | `housecall_pro` | `other`. */
    val source: String? = null,
    val verified: Boolean? = null,
    /** The review on its platform. Check it with [Reviews.link] before opening it. */
    val reviewUrl: String? = null,
    val photos: List<String> = emptyList(),
    val timeCreated: String? = null,
)

/** A page of reviews; pass [nextOffset] back for the next page. */
@Serializable
public data class ReviewPage(
    val items: List<Review> = emptyList(),
    val nextOffset: Int? = null,
    val totalCount: Int = 0,
) {
    public val reviews: List<Review> get() = items
}

/** The `reviews` block of the page bundle: the average and a count per star. */
@Serializable
public data class ReviewTotals(
    val rating: Double? = null,
    val totalCount: Int? = null,
    val counts: List<StarCount> = emptyList(),
)

@Serializable
public data class StarCount(
    val rating: Int = 0,
    val count: Int = 0,
)

@Serializable
public data class SubscriptionPlan(
    val id: String,
    val name: String = "",
    /** **Integer cents** — named `amountCents`, not `priceCents`. */
    val amountCents: Int? = null,
    val interval: String? = null,
)

@Serializable
public data class SubscriptionListResponse(
    val items: List<SubscriptionPlan> = emptyList(),
) {
    val subscriptions: List<SubscriptionPlan> get() = items
}

@Serializable
public data class FormFieldOption(
    val value: String = "",
    val label: String = "",
)

@Serializable
public data class FormField(
    val id: String,
    val label: String = "",
    val type: String = "text",
    val placeholder: String? = null,
    val required: Boolean = false,
    val options: List<FormFieldOption> = emptyList(),
)

@Serializable
public data class FormSchema(
    val slug: String = "",
    val title: String? = null,
    val fields: List<FormField> = emptyList(),
)

@Serializable
public data class FormSubmitInput(
    val data: Map<String, String>,
    val submitterEmail: String? = null,
    val source: String? = "kotlin-app",
)

@Serializable
public data class FormSubmitResult(
    val ok: Boolean = false,
    val reason: String? = null,
)

@Serializable
public data class ChatMessage(
    val id: String,
    val role: String = "bot",
    /** The field is `content`, not `body`. */
    val content: String = "",
    val createdAt: String? = null,
    val authorUserId: String? = null,
)

@Serializable
public data class ChatMessagesResponse(
    val messages: List<ChatMessage> = emptyList(),
    val cursor: String? = null,
)

/** The chat-send response. Only its presence matters — the next poll
 *  carries the message itself. */
@Serializable
public data class ChatSendResult(
    val ok: Boolean = true,
)

@Serializable
public data class ChatSendInput(
    val sessionId: String,
    val visitorToken: String,
    /** The field is `content`; `role` defaults to `visitor` server-side. */
    val content: String,
    val role: String = "visitor",
)

/**
 * Minting a Front Desk session. A visitor token is NOT a session id — polling
 * with one watches a conversation that doesn't exist and returns nothing,
 * forever, without erroring.
 */
@Serializable
public data class ChatSessionInput(val visitorToken: String)

@Serializable
public data class ChatSessionResponse(
    val sessionId: String,
    val status: String = "",
    val visitorToken: String = "",
)

/**
 * The access gate's body shape. Internal — callers see [BdException].
 * `@PublishedApi` because the inline `BdClient.decode` reads it.
 */
@Serializable
@PublishedApi
internal data class AccessGateBody(
    val available: Boolean,
    val reason: String = "plan_required",
    val message: String = "Unavailable.",
    @SerialName("upgradeUrl") val upgradeUrl: String? = null,
)

@Serializable
@PublishedApi
internal data class ErrorBody(val message: String? = null)
