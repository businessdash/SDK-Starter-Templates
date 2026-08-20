import Foundation

// The read/write surface, grouped the way the other starters group it. Each
// namespace is a lightweight view over the same `BiabClient` value, so they
// are free to create and safe to pass across actors.

// MARK: - Storefront

public struct StorefrontResource: Sendable {
    let client: BiabClient

    public func list(limit: Int? = nil, categoryID: String? = nil) async throws -> ProductListResponse {
        try await client.get(
            "storefront/products",
            query: ["limit": limit.map(String.init), "categoryId": categoryID]
        )
    }

    /// The full shop grid: enriched cards plus `categoryCounts` and the
    /// catalog-wide `priceRange` for a filter UI.
    ///
    /// `sort` is one of featured | newest | price-asc | price-desc | rating-desc.
    public func grid(
        search: String? = nil,
        categoryID: String? = nil,
        sort: String? = nil,
        limit: Int = 24
    ) async throws -> ProductGridResponse {
        try await client.get(
            "storefront/products",
            query: [
                "meta": "1",
                "search": search?.nilIfEmpty,
                "categoryId": categoryID,
                "sort": sort,
                "limit": String(limit)
            ]
        )
    }

    public func categories() async throws -> CategoryListResponse {
        try await client.get("storefront/categories")
    }

    public func product(_ id: String) async throws -> Product {
        try await client.get("storefront/products/\(BiabClient.escape(id))")
    }

    public func related(_ id: String, limit: Int = 4) async throws -> ProductListResponse {
        try await client.get(
            "storefront/products/\(BiabClient.escape(id))/related",
            query: ["limit": String(limit)]
        )
    }

    public func reviews(_ id: String, limit: Int = 5) async throws -> ReviewListResponse {
        try await client.get(
            "storefront/products/\(BiabClient.escape(id))/reviews",
            query: ["limit": String(limit)]
        )
    }
}

// MARK: - Cart

/// Server-side cart. All state lives at BIAB; the app only holds the visitor
/// token.
///
/// That token is an opaque id the **app generates** — there is no round trip
/// to mint one, and `cart/session` is a different feature (it mints a
/// tokenized iframe-embed URL). The platform keys the cart on whatever arrives
/// in `X-BIAB-Cart-Visitor`.
public struct CartResource: Sendable {
    let client: BiabClient
    let visitorToken: String

    private var headers: [String: String] { ["X-BIAB-Cart-Visitor": visitorToken] }

    public func snapshot() async throws -> CartSnapshot {
        try await client.get("cart", headers: headers)
    }

    public func add(_ input: CartAddItemInput) async throws -> CartSnapshot {
        try await client.post("cart/items", body: input, headers: headers)
    }

    public func setQuantity(itemID: String, quantity: Int) async throws -> CartSnapshot {
        try await client.patch(
            "cart/items/\(BiabClient.escape(itemID))",
            body: CartQuantityInput(quantity: quantity),
            headers: headers
        )
    }

    public func remove(itemID: String) async throws -> CartSnapshot {
        try await client.delete("cart/items/\(BiabClient.escape(itemID))", headers: headers)
    }

    public func applyCoupon(_ code: String) async throws -> CartSnapshot {
        try await client.post("cart/coupon", body: CartCouponInput(code: code), headers: headers)
    }

    public func removeCoupon() async throws -> CartSnapshot {
        try await client.delete("cart/coupon", headers: headers)
    }

    public func clear() async throws -> CartSnapshot {
        try await client.post("cart/clear", headers: headers)
    }

    /// Hand off to Stripe. Open ``CheckoutSession/stripeURL`` in a web view —
    /// no card data ever touches this process, which is what keeps a native
    /// app out of PCI scope.
    public func startCheckout(_ urls: CheckoutURLs) async throws -> CheckoutSession {
        try await client.post("checkout/start", body: urls, headers: headers)
    }
}

// MARK: - Blog

public struct BlogResource: Sendable {
    let client: BiabClient

    public func posts(limit: Int = 20) async throws -> BlogListResponse {
        try await client.get("blog/posts", query: ["limit": String(limit)])
    }

    public func post(slug: String) async throws -> BlogPostDetail {
        try await client.get("blog/posts/\(BiabClient.escape(slug))")
    }

    public func comments(slug: String, limit: Int = 50) async throws -> BlogCommentListResponse {
        try await client.get(
            "blog/posts/\(BiabClient.escape(slug))/comments",
            query: ["limit": String(limit)]
        )
    }
}

// MARK: - Reviews

public struct ReviewsResource: Sendable {
    let client: BiabClient

    public func list(limit: Int = 10, offset: Int = 0) async throws -> ReviewListResponse {
        try await client.get("reviews", query: ["limit": String(limit), "offset": String(offset)])
    }
}

// MARK: - Subscriptions

public struct SubscriptionsResource: Sendable {
    let client: BiabClient

    public func list() async throws -> SubscriptionListResponse {
        try await client.get("subscriptions")
    }

    public func startCheckout(id: String, urls: CheckoutURLs) async throws -> CheckoutSession {
        try await client.post("subscriptions/\(BiabClient.escape(id))/checkout", body: urls)
    }
}

// MARK: - Marketing

public struct MarketingResource: Sendable {
    let client: BiabClient

    /// Schema-driven, so the return type is ``JSONValue`` rather than a struct:
    /// the shape is whatever `biab.config.ts` declared and the dashboard
    /// filled in. Read it with the key-path subscript and always supply a
    /// local fallback.
    public func pageBundle(_ pageKey: String = "home", locale: String? = nil) async throws -> JSONValue {
        try await client.get(
            client.sitePath("marketing/bundle"),
            query: ["pageKey": pageKey, "locale": locale]
        )
    }

    public func branding() async throws -> JSONValue {
        try await client.get(client.sitePath("branding"))
    }
}

// MARK: - Parallel pages

public struct ParallelPagesResource: Sendable {
    let client: BiabClient

    public func variants(_ key: String) async throws -> JSONValue {
        try await client.get(client.sitePath("parallel-pages/\(BiabClient.escape(key))/variants"))
    }

    public func render(_ key: String, params: [String: String]) async throws -> JSONValue {
        try await client.get(
            client.sitePath("parallel-pages/\(BiabClient.escape(key))/render"),
            query: params.mapValues { Optional($0) }
        )
    }
}

// MARK: - Forms

/// Org-defined forms.
///
/// This is the one surface a native app genuinely reimplements: `<biab-form>`
/// is a DOM web component with no native counterpart, so the app fetches the
/// schema and renders it with its own SwiftUI field views. `BiabFormView` in
/// `BiabStarterApp` is a working minimal renderer.
///
/// ``submit(slug:input:)`` is also the documented CREATE path for a custom
/// collection — point a form's output at the collection and post here. There
/// is deliberately no direct row-insert API, which keeps validation on the
/// platform.
public struct FormsResource: Sendable {
    let client: BiabClient

    public func schema(slug: String) async throws -> FormSchema {
        try await client.get("forms/\(BiabClient.escape(slug))")
    }

    @discardableResult
    public func submit(slug: String, input: FormSubmitInput) async throws -> FormSubmitResult {
        try await client.post("forms/\(BiabClient.escape(slug))", body: input)
    }
}

// MARK: - Custom database

/// The org's custom database — the tables declared in
/// `biab.data-model.config.ts`.
///
/// Reads need `metadata:read_records` on the key, and a publishable token only
/// ever sees objects marked `public` (the per-object visibility gate lives on
/// the platform, not here).
///
/// `object` is the object's `universalIdentifier`, NOT its display name: the
/// name can be renamed in the dashboard without breaking this code.
public struct DataModelResource: Sendable {
    let client: BiabClient

    public func records(
        object: String,
        limit: Int? = nil,
        cursor: String? = nil
    ) async throws -> DataModelRecordsResponse {
        try await client.get(
            client.sitePath("data-model/records"),
            query: ["object": object, "limit": limit.map(String.init), "cursor": cursor]
        )
    }

    /// Page through everything.
    ///
    /// Bounded at 50 pages so a malformed cursor can't spin forever, and
    /// cancellation-aware so backing out of a screen stops the paging.
    public func allRecords(object: String, pageSize: Int = 200) async throws -> [DataModelRecord] {
        var all: [DataModelRecord] = []
        var cursor: String?

        for _ in 0..<50 {
            try Task.checkCancellation()
            let page = try await records(object: object, limit: pageSize, cursor: cursor)
            all.append(contentsOf: page.records)
            guard let next = page.nextCursor else { break }
            cursor = next
        }

        return all
    }
}

// MARK: - Customer portal

/// Everything scoped to the signed-in customer's session token.
///
/// Note the header: portal routes take **`X-BIAB-Session-Token`**, while
/// `auth/me` takes a lowercase **`x-biab-session`**. They are not
/// interchangeable — sending the wrong one reads as "not signed in" rather
/// than as an error, which is a slow bug to find.
public struct PortalResource: Sendable {
    let client: BiabClient
    let sessionToken: String
    let organizationID: String?

    private var headers: [String: String] {
        var out = ["X-BIAB-Session-Token": sessionToken]
        if let organizationID { out["X-BIAB-Customer-Portal-Org"] = organizationID }
        return out
    }

    public func context() async throws -> JSONValue {
        try await client.get("customer-portal/context", headers: headers)
    }

    public func work() async throws -> CustomerWorkBundle {
        try await client.get("customer-portal/work", headers: headers)
    }

    @discardableResult
    public func submitReview(_ input: ReviewInput) async throws -> JSONValue {
        try await client.post("customer-portal/reviews", body: input, headers: headers)
    }

    @discardableResult
    public func acceptQuote(id: String) async throws -> JSONValue {
        try await client.post(
            "customer-portal/quotes/\(BiabClient.escape(id))/accept",
            headers: headers
        )
    }

    @discardableResult
    public func rejectQuote(id: String) async throws -> JSONValue {
        try await client.post(
            "customer-portal/quotes/\(BiabClient.escape(id))/reject",
            headers: headers
        )
    }
}

// MARK: - Namespaces

extension BiabClient {
    public var storefront: StorefrontResource { StorefrontResource(client: self) }
    public var blog: BlogResource { BlogResource(client: self) }
    public var reviews: ReviewsResource { ReviewsResource(client: self) }
    public var subscriptions: SubscriptionsResource { SubscriptionsResource(client: self) }
    public var marketing: MarketingResource { MarketingResource(client: self) }
    public var parallelPages: ParallelPagesResource { ParallelPagesResource(client: self) }
    public var forms: FormsResource { FormsResource(client: self) }
    public var dataModel: DataModelResource { DataModelResource(client: self) }

    public func cart(visitorToken: String) -> CartResource {
        CartResource(client: self, visitorToken: visitorToken)
    }

    public func portal(sessionToken: String, organizationID: String? = nil) -> PortalResource {
        PortalResource(client: self, sessionToken: sessionToken, organizationID: organizationID)
    }
}

// MARK: - Subscription

/// The customer's subscription with this org, its controls, and the content it
/// entitles them to.
///
/// One subscription per org — `user_subscriptions` is unique on (user, org) —
/// so nothing here takes an id.
extension PortalResource {
    /// Subscription state plus the org's live offerings.
    ///
    /// Render entitlement from `hasAccess`, never from `status`: a lifetime
    /// purchase has no period to expire, and a cancelled subscription keeps
    /// access until the period already paid for ends. `hasAccess` is computed
    /// server-side by the same function the content gates use, so the portal
    /// and the gate cannot disagree.
    public func subscription() async throws -> JSONValue {
        try await client.get("customer-portal/subscription", headers: headers)
    }

    /// Cancel at the end of the paid period.
    ///
    /// This ends the RENEWAL, not the access. The customer has paid for the
    /// period they are in and keeps everything until `accessUntil` — say
    /// "active until <that>", because that is what is true.
    public func cancelSubscription() async throws -> JSONValue {
        try await client.post(
            "customer-portal/subscription/cancel",
            body: ["resume": false],
            headers: headers
        )
    }

    /// Clear a pending cancellation. Nothing has been lost yet, so changing
    /// your mind should cost one call rather than a re-purchase.
    public func resumeSubscription() async throws -> JSONValue {
        try await client.post(
            "customer-portal/subscription/cancel",
            body: ["resume": true],
            headers: headers
        )
    }

    /// What the subscription entitles them to — the answer to "what am I
    /// actually getting for this?", asked right before someone cancels.
    ///
    /// When `entitled` is false these are LOCKED previews, not an empty
    /// entitlement: titles and excerpts, no bodies. Show them beside the offer.
    public func subscriberContent(limit: Int? = nil) async throws -> JSONValue {
        try await client.get(
            "customer-portal/subscription/content",
            query: ["limit": limit.map(String.init)],
            headers: headers
        )
    }
}
