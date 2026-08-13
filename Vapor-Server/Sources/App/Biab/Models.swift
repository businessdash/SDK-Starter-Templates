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
    var products: [Product] { items }
}

struct CategoryCount: Content {
    let id: String
    let name: String
    let count: Int?
}

struct CartSnapshot: Content {
    let items: [CartItem]
    /// **Already decimal**, unlike `Product.priceCents`.
    let subtotal: Double?
    let currency: String?
    let couponCode: String?

    static let empty = CartSnapshot(items: [], subtotal: nil, currency: nil, couponCode: nil)
}

struct CartItem: Content {
    let id: String
    let name: String?
    let quantity: Int
    /// **Already decimal.**
    let unitPrice: Double?
}

struct CartAddItemInput: Content {
    let productId: String
    let quantity: Int
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
    /// Authored HTML — the field is `content`, not `contentHtml`.
    let content: String?
    let imageUrl: String?
    /// `public` | `followers` | `paid`.
    let accessLevel: String?
}

struct BlogListResponse: Content {
    let items: [BlogPost]
    var posts: [BlogPost] { items }
}

/// `blog/posts/{slug}` wraps the post: `{ post, access }`. `access` is
/// "granted" or "paywall" — a paywalled post comes back TRUNCATED rather than
/// absent, so a page that ignores the flag renders a teaser as the article.
struct BlogPostDetail: Content {
    let post: BlogPost
    let access: String

    var isPaywalled: Bool { access == "paywall" }
}

/// Note `text` and `reviewerName` — not `body` and `authorName`.
struct Review: Content {
    let id: String
    let rating: Double
    let text: String?
    let reviewerName: String?
    let verified: Bool?
}

struct ReviewListResponse: Content {
    let items: [Review]
    var reviews: [Review] { items }
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

struct FormSubmitInput: Content {
    let data: [String: String]
    let submitterEmail: String?
    let source: String?
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
