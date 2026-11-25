import Foundation

// Nearly every field here is optional on purpose. The platform returns a
// superset that grows over release to release, and an app that hard-fails
// decoding because a new nullable column appeared is an app that breaks on
// somebody else's deploy. Optional + a sensible default beats a strict struct.

// MARK: - Storefront

/// A product **card** — what the storefront grid returns.
///
/// The field names are the platform's, not the obvious ones: the price is
/// `cheapestPriceCents` (a product can have variants, so there is no single
/// price), the image is `coverImage`, and there is no `currency` on a card at
/// all — the cart carries it.
public struct Product: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let description: String?
    /// **Integer cents.** The cheapest variant's price. See `Money`.
    public let cheapestPriceCents: Int?
    /// **Integer cents.** The struck-through "was" price, when on sale.
    public let comparePriceCents: Int?
    public let coverImage: String?
    public let avgRating: Double?
    public let reviewCount: Int?
    public let isOnSale: Bool?
    // The grid's card flags (`meta=1`).
    public let hasMultipleVariants: Bool?
    public let isNew: Bool?
    public let isBestSeller: Bool?
    public let isLowStock: Bool?

    public var imageURL: URL? { coverImage.flatMap(URL.init(string:)) }
}

/// Every list response on the platform is keyed `items`, not the plural of
/// the thing. Decoded under the wire name and exposed as `products` so call
/// sites read well without hiding what came back.
public struct ProductListResponse: Decodable, Sendable {
    public let items: [Product]
    public let nextCursor: Int?

    public var products: [Product] { items }
}

public struct ProductGridResponse: Decodable, Sendable {
    public let items: [Product]
    public let categoryCounts: [CategoryCount]?
    public let priceRange: PriceRange?
    public let nextCursor: Int?

    public var products: [Product] { items }
}

/// How many products of a category the list has: `categoryId`, not `id` and
/// `name` — the names come from `storefront/categories`.
public struct CategoryCount: Decodable, Sendable, Equatable {
    public let categoryId: String
    public let count: Int?
}

/// The catalogue's cheapest and dearest price, in **dollars** (not cents).
public struct PriceRange: Decodable, Sendable, Equatable {
    public let minDollars: Double
    public let maxDollars: Double
}

public struct StoreCategory: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String
}

public struct CategoryListResponse: Decodable, Sendable {
    public let items: [StoreCategory]

    public var categories: [StoreCategory] { items }
}

/// A product review: `title` and `content` (older rows: `body`), unlike the
/// review wall's `text`. One page of them comes with the product's average.
public struct ProductReview: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let rating: Double
    public let title: String?
    public let content: String?
    public let body: String?
    public let reviewerName: String?
    public let createdAt: String?

    public var text: String? { content?.nilIfEmpty ?? body?.nilIfEmpty }
}

public struct ProductReviewPage: Decodable, Sendable, Equatable {
    public let items: [ProductReview]
    public let avgRating: Double
    public let totalCount: Int
}

/// "Complete your …": a product sold alongside this one.
public struct StoreAddon: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let addonProductId: String
    public let addonName: String
    public let groupLabel: String?
    /// **Integer cents.**
    public let priceCents: Int?
    public let imageUrl: String?
    public let variants: [JSONValue]?

    /// The variant the Add button puts in the cart: the add-on's first. Its
    /// id is `variantId`; `id` is read too, as the web starters do.
    public var firstVariantID: String? {
        variants?.first?["variantId"]?.stringValue ?? variants?.first?["id"]?.stringValue
    }
}

public struct AddonListResponse: Decodable, Sendable {
    public let items: [StoreAddon]
}

/// "You may also like". Not a card: `coverImageUrl`, and a price in
/// **dollars** (`minPriceDollars`).
public struct RelatedProduct: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let coverImageUrl: String?
    public let minPriceDollars: Double?
}

public struct RelatedProductListResponse: Decodable, Sendable {
    public let items: [RelatedProduct]
}

// MARK: - Cart

public struct CartSnapshot: Decodable, Sendable, Equatable {
    public let items: [CartItem]
    /// **Already decimal**, unlike `Product.cheapestPriceCents`. See `Money`.
    public let subtotal: Double?
    public let currency: String?
    public let couponCode: String?
    /// Units across every line, for the cart badge.
    public let itemCount: Int?

    public var isEmpty: Bool { items.isEmpty }

    /// Units in the cart, from `itemCount` or added up from the lines.
    public var units: Int { itemCount ?? items.reduce(0) { $0 + $1.quantity } }

    /// What a screen shows before the first load, and when the app isn't
    /// configured. A struct's memberwise init is internal, so without this a
    /// consumer in another module can't express "no cart yet".
    public static let empty = CartSnapshot(
        items: [], subtotal: nil, currency: nil, couponCode: nil
    )

    public init(items: [CartItem], subtotal: Double?, currency: String?, couponCode: String?, itemCount: Int? = nil) {
        self.items = items
        self.subtotal = subtotal
        self.currency = currency
        self.couponCode = couponCode
        self.itemCount = itemCount
    }
}

/// A cart line names its product `productName` and the chosen variant (size,
/// colour) `variantTitle` — there is no `name`.
public struct CartItem: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let productId: String?
    public let productName: String?
    public let variantTitle: String?
    public let quantity: Int
    /// **Already decimal.**
    public let unitPrice: Double?

    /// "Everyday Trainer · Size 42".
    public var title: String {
        [productName?.nilIfEmpty ?? "Item", variantTitle?.nilIfEmpty].compactMap(\.self).joined(separator: " · ")
    }
}

public struct CartAddItemInput: Encodable, Sendable {
    public let productId: String
    public let variantId: String?
    public let quantity: Int
    /// The option picks, by group title: `["Size": "42"]`.
    public let options: [String: String]?

    public init(productId: String, variantId: String? = nil, quantity: Int = 1, options: [String: String]? = nil) {
        self.productId = productId
        self.variantId = variantId
        self.quantity = quantity
        self.options = options
    }
}

public struct CartQuantityInput: Encodable, Sendable {
    public let quantity: Int
    public init(quantity: Int) { self.quantity = quantity }
}

public struct CartCouponInput: Encodable, Sendable {
    public let code: String
    public init(code: String) { self.code = code }
}

// MARK: - Checkout

public struct CheckoutURLs: Encodable, Sendable {
    public let successUrl: String
    public let cancelUrl: String

    public init(successURL: String, cancelURL: String) {
        self.successUrl = successURL
        self.cancelUrl = cancelURL
    }
}

public struct CheckoutSession: Decodable, Sendable {
    public let sessionId: String
    /// Note the name: **`stripeUrl`**, not `url`.
    public let stripeUrl: String
    public let totalAmountCents: Int?
    public let currency: String?

    public var stripeURL: URL? { URL(string: stripeUrl) }
}

/// `checkout/{sessionId}`, read when Stripe sends the customer back.
public struct CheckoutStatus: Decodable, Sendable, Equatable {
    public let paymentStatus: String?
    public let customerEmail: String?

    public var isPaid: Bool { paymentStatus == "paid" }
}

// MARK: - Blog

/// `blog/posts/{slug}` wraps the post: `{ post, access }`. `access` is
/// "granted" or "paywall" — a paywalled post comes back TRUNCATED rather than
/// absent, so a screen that ignores the flag renders a teaser as the article.
public struct BlogPostDetail: Decodable, Sendable {
    public let post: BlogPost
    public let access: String

    public var isPaywalled: Bool { access == "paywall" }
}

public struct BlogPost: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let slug: String
    public let title: String
    public let excerpt: String?
    /// Authored HTML from the dashboard — the field is `content`, not
    /// `contentHtml`.
    public let content: String?
    public let imageUrl: String?
    public let publishedAt: String?
    /// `public` | `followers` | `paid`.
    public let accessLevel: String?
    public let isPinned: Bool?
    public let authorName: String?
    public let authorAvatarUrl: String?
    public let tags: [String]?
    public let likes: Int?
    /// The post's call to action: a button under the body.
    public let ctaLabel: String?
    public let ctaHref: String?
    public let ctaDescription: String?
}

public struct BlogCategory: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let description: String?
}

public struct BlogCategoryListResponse: Decodable, Sendable {
    public let items: [BlogCategory]
}

public struct BlogTagListResponse: Decodable, Sendable {
    public let items: [String]
}

/// `{ liked, likesCount }` for the signed-in customer.
public struct PostLikes: Decodable, Sendable, Equatable {
    public let liked: Bool
    public let likesCount: Int

    public init(liked: Bool, likesCount: Int) {
        self.liked = liked
        self.likesCount = likesCount
    }
}

public struct BlogCommentInput: Encodable, Sendable {
    public let content: String
}

/// A posted comment: `moderation.isApproved` false means it waits for review.
public struct BlogCommentPosted: Decodable, Sendable {
    public struct Moderation: Decodable, Sendable {
        public let isApproved: Bool
    }
    public let moderation: Moderation
}

public struct BlogListResponse: Decodable, Sendable {
    public let items: [BlogPost]
    public let nextCursor: Int?

    public var posts: [BlogPost] { items }
}

public struct BlogComment: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let authorName: String?
    public let authorAvatarUrl: String?
    /// A comment's text is `content` — even though `authorName` IS the right
    /// name here. The platform is not uniform about this; check per surface.
    public let content: String
    public let createdAt: String?
}

public struct BlogCommentListResponse: Decodable, Sendable {
    public let items: [BlogComment]

    public var comments: [BlogComment] { items }
}

// MARK: - Reviews

/// A business review from the review wall: Google, Yelp, Housecall Pro, or
/// one added in the dashboard (`other`). Note `text` and `reviewerName` — not
/// `body` and `authorName`, which is what most APIs would call them.
public struct Review: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let rating: Double
    public let text: String?
    public let reviewerName: String?
    public let reviewerImageUrl: String?
    /// `google`, `yelp`, `housecall_pro` or `other`; `ReviewSource.label`
    /// names it.
    public let source: String?
    public let verified: Bool?
    public let timeCreated: String?
    /// The review on its own site. Open only http(s) links.
    public let reviewUrl: String?
    /// Photos the reviewer attached.
    public let photos: [String]?

    public init(
        id: String, rating: Double, text: String?, reviewerName: String?, reviewerImageUrl: String? = nil,
        source: String?, verified: Bool? = nil, timeCreated: String?, reviewUrl: String? = nil, photos: [String]? = nil
    ) {
        self.id = id
        self.rating = rating
        self.text = text
        self.reviewerName = reviewerName
        self.reviewerImageUrl = reviewerImageUrl
        self.source = source
        self.verified = verified
        self.timeCreated = timeCreated
        self.reviewUrl = reviewUrl
        self.photos = photos
    }
}

public struct ReviewListResponse: Decodable, Sendable {
    public let items: [Review]
    /// Reviews matching the source filter, for "N reviews".
    public let totalCount: Int?
    /// Pass back as `offset` for the next page; nil once there are no more.
    public let nextOffset: Int?

    public var reviews: [Review] { items }
}

/// The platforms a business review comes from, by name. `other` is a review
/// added in the dashboard or imported from a CSV.
public enum ReviewSource {
    public static func label(_ source: String?) -> String {
        switch source {
        case "google": "Google"
        case "yelp": "Yelp"
        case "housecall_pro": "Housecall Pro"
        default: "Other"
        }
    }

    /// The platform's name where one is worth showing on a review.
    public static func platform(_ source: String?) -> String? {
        source == "google" || source == "yelp" || source == "housecall_pro" ? label(source) : nil
    }
}

/// The business's rating over all its reviews, from the marketing bundle:
/// the average, the count, and how many gave each star.
public struct ReviewSummary: Decodable, Sendable, Equatable {
    public struct StarCount: Decodable, Sendable, Equatable {
        public let rating: Int
        public let count: Int

        public init(rating: Int, count: Int) {
            self.rating = rating
            self.count = count
        }
    }

    /// The bundle's own shape for its first page of reviews.
    public struct Item: Decodable, Sendable, Equatable {
        public let reviewee: String
        public let rating: Double
        public let image: String?
        public let description: String
        public let date: String
        public let photos: [String]?
        public let platform: String
    }

    public let rating: Double?
    public let totalCount: Int?
    public let counts: [StarCount]?
    public let items: [Item]

    public init(rating: Double?, totalCount: Int?, counts: [StarCount]?, items: [Item] = []) {
        self.rating = rating
        self.totalCount = totalCount
        self.counts = counts
        self.items = items
    }

    /// 5 stars down to 1, each with its count and its share of all reviews
    /// (0...1). Missing stars count 0.
    public var histogram: [(stars: Int, count: Int, share: Double)] {
        let byStars = Dictionary((counts ?? []).map { ($0.rating, $0.count) }, uniquingKeysWith: +)
        let total = max(1, byStars.values.reduce(0, +))
        return (1...5).reversed().map { stars in
            let count = byStars[stars] ?? 0
            return (stars, count, Double(count) / Double(total))
        }
    }
}

struct ReviewSummaryEnvelope: Decodable, Sendable {
    let reviews: ReviewSummary?
}

/// A review a signed-in customer writes. It waits for the business to
/// approve it before it shows on the wall.
public struct ReviewInput: Encodable, Sendable {
    /// 1 to 5.
    public let rating: Int
    public let title: String?
    /// Up to 5,000 characters.
    public let body: String
    /// Ties the review to one of the customer's jobs.
    public let jobId: String?

    public init(rating: Int, title: String? = nil, body: String, jobId: String? = nil) {
        self.rating = rating
        self.title = title
        self.body = body
        self.jobId = jobId
    }
}

public struct ReviewSubmitted: Decodable, Sendable {
    public let id: String?
    /// `pending` until the business approves it.
    public let status: String?
}

// MARK: - Subscriptions

public struct SubscriptionPlan: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let description: String?
    public let imageUrl: String?
    /// **Integer cents** — and named `amountCents`, not `priceCents`.
    public let amountCents: Int?
    /// `day` | `week` | `month` | `year`.
    public let interval: String?
}

public struct SubscriptionListResponse: Decodable, Sendable {
    public let items: [SubscriptionPlan]

    public var subscriptions: [SubscriptionPlan] { items }
}

// MARK: - Customer portal

public struct CustomerWorkBundle: Decodable, Sendable {
    public let jobs: [CustomerJob]?
    public let quotes: [CustomerQuote]?
    public let invoices: [CustomerInvoice]?
}

public struct CustomerJob: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String?
    public let status: String?
    public let startDate: String?
    public let dueDate: String?
}

/// ⚠️ Portal money is **DECIMAL**, not cents.
///
/// The platform's convention is in the name: a `*Cents` suffix means integer
/// cents; a bare `*Amount` means decimal. Render these with `Money.amount`,
/// not `Money.cents`.
public struct CustomerQuote: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let quoteNumber: String?
    public let status: String?
    /// **Decimal.**
    public let totalAmount: Double?
    public let validUntil: String?
}

public struct CustomerInvoice: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let invoiceNumber: String?
    public let status: String?
    /// **Decimal**, not cents — see `CustomerQuote`.
    public let totalAmount: Double?
    public let balanceDue: Double?
    public let dueDate: String?
    public let publicPayUrl: String?
}

/// `auth/customer/delete-account`'s answer. `signInKept` when the person's
/// sign-in stays because another business or a team still uses it.
public struct AccountDeleted: Decodable, Sendable, Equatable {
    public let deleted: Bool
    public let signInKept: Bool
}

public struct TenantSession: Decodable, Sendable, Equatable {
    public let user: TenantUser
    public let organizationId: String
    public let role: String?
}

public struct TenantUser: Decodable, Sendable, Equatable, Identifiable {
    public let id: String
    public let email: String?
    public let firstName: String?
    public let lastName: String?

    public var displayName: String {
        [firstName, lastName].compactMap { $0 }.joined(separator: " ")
            .trimmingCharacters(in: .whitespaces)
            .nilIfEmpty ?? email ?? "Customer"
    }
}

public struct TenantAuthStart: Decodable, Sendable {
    public let url: String
    public var authURL: URL? { URL(string: url) }
}

public struct TenantAuthSession: Decodable, Sendable {
    public let sessionToken: String
    public let expiresAt: Date?
}

// MARK: - Forms

public struct FormSchema: Decodable, Sendable {
    public let slug: String
    public let title: String?
    public let description: String?
    public let fields: [FormField]
}

public struct FormField: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let label: String
    public let type: String
    public let placeholder: String?
    public let required: Bool?
    public let options: [FormFieldOption]?

    public var isRequired: Bool { required ?? false }
}

public struct FormFieldOption: Decodable, Sendable, Equatable {
    public let value: String
    public let label: String
}

public struct FormSubmitInput: Encodable, Sendable {
    public let data: [String: String]
    public let submitterEmail: String?
    public let submitterName: String?
    public let source: String?

    public init(
        data: [String: String],
        submitterEmail: String? = nil,
        submitterName: String? = nil,
        source: String? = "swift-app"
    ) {
        self.data = data
        self.submitterEmail = submitterEmail
        self.submitterName = submitterName
        self.source = source
    }
}

public struct FormSubmitResult: Decodable, Sendable {
    public let ok: Bool?
    public let reason: String?

    public var succeeded: Bool { ok ?? false }
}

// MARK: - Custom database

public struct DataModelRecord: Decodable, Sendable, Identifiable {
    public let id: String
    public let fields: [String: JSONValue]

    public func string(_ key: String) -> String? { fields[key]?.stringValue }
    public func bool(_ key: String) -> Bool? { fields[key]?.boolValue }

    /// A relation arrives as either a link object carrying `id`, or a bare id
    /// string. Both shapes appear depending on how the object was declared.
    public func relationID(_ key: String) -> String? {
        switch fields[key] {
        case .object(let link): return link["id"]?.stringValue
        case .string(let id): return id
        default: return nil
        }
    }
}

public struct DataModelRecordsResponse: Decodable, Sendable {
    public let records: [DataModelRecord]
    public let nextCursor: String?
}

// MARK: - Chat

public struct ChatMessage: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let role: String
    /// The field is `content`, not `body`.
    public let content: String
    public let createdAt: String?
    public let authorUserId: String?
}

public struct ChatMessagesResponse: Decodable, Sendable {
    public let messages: [ChatMessage]
    public let cursor: String?
}

public struct ChatSendInput: Encodable, Sendable {
    public let sessionId: String
    public let visitorToken: String
    /// The field is `content`, and `role` defaults to `visitor` server-side.
    public let content: String
    public let role: String

    public init(sessionID: String, visitorToken: String, content: String, role: String = "visitor") {
        self.sessionId = sessionID
        self.visitorToken = visitorToken
        self.content = content
        self.role = role
    }
}

/// Minting a Front Desk session. The returned `sessionId` is what
/// `ChatFeed` polls and posts against — a visitor token alone is not a
/// session.
public struct ChatSessionInput: Encodable, Sendable {
    public let visitorToken: String
    public init(visitorToken: String) { self.visitorToken = visitorToken }
}

public struct ChatSession: Decodable, Sendable {
    public let sessionId: String
    public let status: String
    public let visitorToken: String
}

// MARK: - Helpers

extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
