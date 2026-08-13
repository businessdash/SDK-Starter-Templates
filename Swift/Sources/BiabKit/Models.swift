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

public struct CategoryCount: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let count: Int?
}

public struct PriceRange: Decodable, Sendable, Equatable {
    public let minCents: Int?
    public let maxCents: Int?
}

public struct CategoryListResponse: Decodable, Sendable {
    public let items: [CategoryCount]

    public var categories: [CategoryCount] { items }
}

// MARK: - Cart

public struct CartSnapshot: Decodable, Sendable, Equatable {
    public let items: [CartItem]
    /// **Already decimal**, unlike `Product.cheapestPriceCents`. See `Money`.
    public let subtotal: Double?
    public let currency: String?
    public let couponCode: String?

    public var isEmpty: Bool { items.isEmpty }

    /// What a screen shows before the first load, and when the app isn't
    /// configured. A struct's memberwise init is internal, so without this a
    /// consumer in another module can't express "no cart yet".
    public static let empty = CartSnapshot(
        items: [], subtotal: nil, currency: nil, couponCode: nil
    )

    public init(items: [CartItem], subtotal: Double?, currency: String?, couponCode: String?) {
        self.items = items
        self.subtotal = subtotal
        self.currency = currency
        self.couponCode = couponCode
    }
}

public struct CartItem: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let productId: String?
    public let name: String?
    public let quantity: Int
    /// **Already decimal.**
    public let unitPrice: Double?
}

public struct CartAddItemInput: Encodable, Sendable {
    public let productId: String
    public let variantId: String?
    public let quantity: Int

    public init(productId: String, variantId: String? = nil, quantity: Int = 1) {
        self.productId = productId
        self.variantId = variantId
        self.quantity = quantity
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
}

public struct BlogListResponse: Decodable, Sendable {
    public let items: [BlogPost]
    public let nextCursor: Int?

    public var posts: [BlogPost] { items }
}

public struct BlogComment: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let authorName: String?
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

/// A review-wall item. Note `text` and `reviewerName` — not `body` and
/// `authorName`, which is what most APIs would call them.
public struct Review: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let rating: Double
    public let text: String?
    public let reviewerName: String?
    public let reviewerImageUrl: String?
    public let source: String?
    public let verified: Bool?
    public let timeCreated: String?
}

public struct ReviewListResponse: Decodable, Sendable {
    public let items: [Review]

    public var reviews: [Review] { items }
}

public struct ReviewInput: Encodable, Sendable {
    public let rating: Int
    public let body: String

    public init(rating: Int, body: String) {
        self.rating = rating
        self.body = body
    }
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
