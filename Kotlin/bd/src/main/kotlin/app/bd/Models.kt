package app.bd

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

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
    /** **Integer cents.** The cheapest variant's price. See [Money]. */
    val cheapestPriceCents: Int? = null,
    val comparePriceCents: Int? = null,
    val coverImage: String? = null,
    val avgRating: Double? = null,
    val reviewCount: Int? = null,
    val isOnSale: Boolean? = null,
)

/**
 * Every list response on the platform is keyed `items`, not the plural of the
 * thing. Decoded under the wire name; `products` is a readable alias.
 */
@Serializable
public data class ProductListResponse(
    val items: List<Product> = emptyList(),
) {
    val products: List<Product> get() = items
}

@Serializable
public data class ProductGridResponse(
    val items: List<Product> = emptyList(),
    val categoryCounts: List<CategoryCount> = emptyList(),
) {
    val products: List<Product> get() = items
}

@Serializable
public data class CategoryCount(
    val id: String,
    val name: String = "",
    val count: Int? = null,
)

@Serializable
public data class CartItem(
    val id: String,
    val quantity: Int = 1,
    val name: String? = null,
    /** **Already decimal**, unlike [Product.priceCents]. */
    val unitPrice: Double? = null,
)

@Serializable
public data class CartSnapshot(
    val items: List<CartItem> = emptyList(),
    /** **Already decimal.** */
    val subtotal: Double? = null,
    val currency: String? = null,
    val couponCode: String? = null,
) {
    public val isEmpty: Boolean get() = items.isEmpty()

    public companion object {
        public val EMPTY: CartSnapshot = CartSnapshot()
    }
}

@Serializable
public data class CartAddItemInput(
    val productId: String,
    val quantity: Int = 1,
)

@Serializable
public data class CartQuantityInput(val quantity: Int)

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
)

@Serializable
public data class BlogListResponse(
    val items: List<BlogPost> = emptyList(),
) {
    val posts: List<BlogPost> get() = items
}

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
    val isPaywalled: Boolean get() = access == "paywall"
}

/** Note `text` and `reviewerName` — not `body` and `authorName`. */
@Serializable
public data class Review(
    val id: String,
    val rating: Double = 0.0,
    val text: String? = null,
    val reviewerName: String? = null,
    val reviewerImageUrl: String? = null,
    val verified: Boolean? = null,
)

@Serializable
public data class ReviewListResponse(
    val items: List<Review> = emptyList(),
) {
    val reviews: List<Review> get() = items
}

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

/** The access gate's body shape. Internal — callers see [BdException]. */
@Serializable
internal data class AccessGateBody(
    val available: Boolean,
    val reason: String = "plan_required",
    val message: String = "Unavailable.",
    @SerialName("upgradeUrl") val upgradeUrl: String? = null,
)

@Serializable
internal data class ErrorBody(val message: String? = null)
