import Vapor

// Nearly every field is optional on purpose: the platform returns a superset
// that grows release to release, and a site that hard-fails because a new
// nullable column appeared is a site that breaks on somebody else's deploy.

/// A product **card** — what the storefront grid returns. The field names are
/// the platform's, not the obvious ones: the price is `cheapestPriceCents` (a
/// product can have variants, so there is no single price), the image is
/// `coverImage`, and a card carries no `currency` — the cart does.
struct Product: Content {
    let id: String
    let name: String
    let description: String?
    /// **Integer cents.** The cheapest variant's price. See `Money`.
    let cheapestPriceCents: Int?
    let comparePriceCents: Int?
    let coverImage: String?
    let avgRating: Double?
    let reviewCount: Int?
    // The grid's card flags (`meta=1`).
    let hasMultipleVariants: Bool?
    let isOnSale: Bool?
    let isNew: Bool?
    let isBestSeller: Bool?
    let isLowStock: Bool?
}

/// Every list response on the platform is keyed `items`, not the plural of
/// the thing. Decoded under the wire name, exposed under a readable one.
struct ProductListResponse: Content {
    let items: [Product]
    var products: [Product] { items }
}

struct ProductGridResponse: Content {
    let items: [Product]
    let categoryCounts: [CategoryCount]?
    let priceRange: PriceRange?
    var products: [Product] { items }
}

/// Per category, how many products the list has: `categoryId`, not `id`.
struct CategoryCount: Content {
    let categoryId: String
    let count: Int?
}

/// The catalogue's cheapest and dearest price, in **dollars** (not cents).
struct PriceRange: Content {
    let minDollars: Double
    let maxDollars: Double
}

struct StoreCategory: Content {
    let id: String
    let name: String
}

struct StoreCategoryListResponse: Content {
    let items: [StoreCategory]
}

struct CartSnapshot: Content {
    let items: [CartItem]
    /// **Already decimal**, unlike `Product.priceCents`.
    let subtotal: Double?
    let currency: String?
    let couponCode: String?
    /// Units across every line, for the cart count in the store bar.
    let itemCount: Int?

    static let empty = CartSnapshot(items: [], subtotal: nil, currency: nil, couponCode: nil, itemCount: 0)
}

/// A cart line names its product `productName`, and the chosen variant
/// (size, colour) `variantTitle` — there is no `name`.
struct CartItem: Content {
    let id: String
    let productName: String?
    let variantTitle: String?
    let quantity: Int
    /// **Already decimal.**
    let unitPrice: Double?
}

struct CartAddItemInput: Content {
    let productId: String
    let quantity: Int
    /// The variant the shopper chose, and their option picks (`{"Size": "42"}`).
    var variantId: String? = nil
    var options: [String: String]? = nil
}

/// `checkout/{sessionId}`, read when Stripe sends the shopper back.
struct CheckoutStatus: Content {
    let paymentStatus: String?
    let customerEmail: String?
}

struct CartQuantityInput: Content {
    let quantity: Int
}

struct CheckoutURLs: Content {
    let successUrl: String
    let cancelUrl: String
}

struct CheckoutSession: Content {
    /// Note the name: **`stripeUrl`**, not `url`.
    let stripeUrl: String
}

struct BlogPost: Content {
    let id: String
    let slug: String
    let title: String
    let excerpt: String?
    /// Authored HTML — the field is `content`, not `contentHtml`. Never put it
    /// on a page as is: `PostHtml.safe(_:)` rebuilds it first.
    let content: String?
    let imageUrl: String?
    /// `public` | `followers` | `paid`.
    let accessLevel: String?
    let publishedAt: String?
    let authorName: String?
    let authorAvatarUrl: String?
    let isPinned: Bool?
    let tags: [String]?
    let likes: Int?
    /// The post's call to action: a button under the body.
    let ctaHref: String?
    let ctaLabel: String?
    let ctaDescription: String?
}

struct BlogListResponse: Content {
    let items: [BlogPost]
    /// The next page's cursor: a number on the wire, sent back as it came.
    let nextCursor: JSONValue?
    var posts: [BlogPost] { items }
}

struct BlogCategory: Content {
    let id: String
    let name: String
    let description: String?
}

struct BlogCategoryListResponse: Content {
    let items: [BlogCategory]
}

struct BlogTagListResponse: Content {
    let items: [String]
}

/// `{ liked, likesCount }` — for the signed-in customer, or `liked: false`.
struct PostLikes: Content {
    let liked: Bool
    let likesCount: Int
}

/// `blog/posts/{slug}` wraps the post: `{ post, access }`. `access` is
/// "granted" or "paywall" — a paywalled post comes back TRUNCATED rather than
/// absent, so a page that ignores the flag renders a teaser as the article.
struct BlogPostDetail: Content {
    let post: BlogPost
    let access: String

    var isPaywalled: Bool { access == "paywall" }
}

/// A review of the business. Note `text` and `reviewerName` — not `body`
/// and `authorName`. `source` is google, yelp, housecall_pro, or other (added
/// in the dashboard).
struct Review: Content {
    let id: String
    let source: String?
    let rating: Double
    let text: String?
    let reviewUrl: String?
    let reviewerName: String?
    let reviewerImageUrl: String?
    let photos: [String]?
    let timeCreated: String?
    let verified: Bool?
}

/// One page of reviews, newest first; `nextOffset` is nil on the last page.
struct ReviewListResponse: Content {
    let items: [Review]
    let totalCount: Int?
    let nextOffset: Int?
}

struct SubscriptionPlan: Content {
    let id: String
    let name: String
    /// **Integer cents** — named `amountCents`, not `priceCents`.
    let amountCents: Int?
    let interval: String?
}

struct SubscriptionListResponse: Content {
    let items: [SubscriptionPlan]
    var subscriptions: [SubscriptionPlan] { items }
}

struct DataModelRecord: Content {
    let id: String
    let fields: [String: JSONValue]

    func string(_ key: String) -> String? { fields[key]?.stringValue }
    func bool(_ key: String) -> Bool? { fields[key]?.boolValue }

    /// A relation arrives as either a link object carrying `id`, or a bare id.
    func relationID(_ key: String) -> String? {
        switch fields[key] {
        case .object(let link): return link["id"]?.stringValue
        case .string(let id): return id
        default: return nil
        }
    }
}

struct DataModelRecordsResponse: Content {
    let records: [DataModelRecord]
    let nextCursor: String?
}
