import Foundation

// The read/write surface, grouped the way the other starters group it. Each
// namespace is a lightweight view over the same `BdClient` value, so they
// are free to create and safe to pass across actors.

// MARK: - Storefront

public struct StorefrontResource: Sendable {
    let client: BdClient

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
        try await client.get("storefront/products/\(BdClient.escape(id))")
    }

    public func related(_ id: String, limit: Int = 4) async throws -> ProductListResponse {
        try await client.get(
            "storefront/products/\(BdClient.escape(id))/related",
            query: ["limit": String(limit)]
        )
    }

    public func reviews(_ id: String, limit: Int = 5) async throws -> ReviewListResponse {
        try await client.get(
            "storefront/products/\(BdClient.escape(id))/reviews",
            query: ["limit": String(limit)]
        )
    }
}

// MARK: - Cart

/// Server-side cart. All state lives at BD; the app only holds the visitor
/// token.
///
/// That token is an opaque id the **app generates** — there is no round trip
/// to mint one, and `cart/session` is a different feature (it mints a
/// tokenized iframe-embed URL). The platform keys the cart on whatever arrives
/// in `X-BD-Cart-Visitor`.
public struct CartResource: Sendable {
    let client: BdClient
    let visitorToken: String

    private var headers: [String: String] { ["X-BD-Cart-Visitor": visitorToken] }

    public func snapshot() async throws -> CartSnapshot {
        try await client.get("cart", headers: headers)
    }

    public func add(_ input: CartAddItemInput) async throws -> CartSnapshot {
        try await client.post("cart/items", body: input, headers: headers)
    }

    public func setQuantity(itemID: String, quantity: Int) async throws -> CartSnapshot {
        try await client.patch(
            "cart/items/\(BdClient.escape(itemID))",
            body: CartQuantityInput(quantity: quantity),
            headers: headers
        )
    }

    public func remove(itemID: String) async throws -> CartSnapshot {
        try await client.delete("cart/items/\(BdClient.escape(itemID))", headers: headers)
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
    let client: BdClient

    public func posts(limit: Int = 20) async throws -> BlogListResponse {
        try await client.get("blog/posts", query: ["limit": String(limit)])
    }

    public func post(slug: String) async throws -> BlogPostDetail {
        try await client.get("blog/posts/\(BdClient.escape(slug))")
    }

    public func comments(slug: String, limit: Int = 50) async throws -> BlogCommentListResponse {
        try await client.get(
            "blog/posts/\(BdClient.escape(slug))/comments",
            query: ["limit": String(limit)]
        )
    }
}

// MARK: - Reviews

public struct ReviewsResource: Sendable {
    let client: BdClient

    public func list(limit: Int = 10, offset: Int = 0) async throws -> ReviewListResponse {
        try await client.get("reviews", query: ["limit": String(limit), "offset": String(offset)])
    }
}

// MARK: - Subscriptions

public struct SubscriptionsResource: Sendable {
    let client: BdClient

    public func list() async throws -> SubscriptionListResponse {
        try await client.get("subscriptions")
    }

    public func startCheckout(id: String, urls: CheckoutURLs) async throws -> CheckoutSession {
        try await client.post("subscriptions/\(BdClient.escape(id))/checkout", body: urls)
    }
}

// MARK: - Marketing

public struct MarketingResource: Sendable {
    let client: BdClient

    /// Schema-driven, so the return type is ``JSONValue`` rather than a struct:
    /// the shape is whatever `bd.config.ts` declared and the dashboard
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
    let client: BdClient

    public func variants(_ key: String) async throws -> JSONValue {
        try await client.get(client.sitePath("parallel-pages/\(BdClient.escape(key))/variants"))
    }

    public func render(_ key: String, params: [String: String]) async throws -> JSONValue {
        try await client.get(
            client.sitePath("parallel-pages/\(BdClient.escape(key))/render"),
            query: params.mapValues { Optional($0) }
        )
    }
}

// MARK: - Forms

/// Org-defined forms.
///
/// This is the one surface a native app genuinely reimplements: `<bd-form>`
/// is a DOM web component with no native counterpart, so the app fetches the
/// schema and renders it with its own SwiftUI field views. `BdFormView` in
/// `BdStarterApp` is a working minimal renderer.
///
/// ``submit(slug:input:)`` is also the documented CREATE path for a custom
/// collection — point a form's output at the collection and post here. There
/// is deliberately no direct row-insert API, which keeps validation on the
/// platform.
public struct FormsResource: Sendable {
    let client: BdClient

    public func schema(slug: String) async throws -> FormSchema {
        try await client.get("forms/\(BdClient.escape(slug))")
    }

    @discardableResult
    public func submit(slug: String, input: FormSubmitInput) async throws -> FormSubmitResult {
        try await client.post("forms/\(BdClient.escape(slug))", body: input)
    }
}

// MARK: - Custom database

/// The org's custom database — the tables declared in
/// `bd.data-model.config.ts`.
///
/// Reads need `metadata:read_records` on the key, and a publishable token only
/// ever sees objects marked `public` (the per-object visibility gate lives on
/// the platform, not here).
///
/// `object` is the object's `universalIdentifier`, NOT its display name: the
/// name can be renamed in the dashboard without breaking this code.
public struct DataModelResource: Sendable {
    let client: BdClient

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
/// Note the header: portal routes take **`X-BD-Session-Token`**, while
/// `auth/me` takes a lowercase **`x-bd-session`**. They are not
/// interchangeable — sending the wrong one reads as "not signed in" rather
/// than as an error, which is a slow bug to find.
public struct PortalResource: Sendable {
    let client: BdClient
    let sessionToken: String
    let organizationID: String?

    private var headers: [String: String] {
        var out = ["X-BD-Session-Token": sessionToken]
        if let organizationID { out["X-BD-Customer-Portal-Org"] = organizationID }
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
            "customer-portal/quotes/\(BdClient.escape(id))/accept",
            headers: headers
        )
    }

    @discardableResult
    public func rejectQuote(id: String) async throws -> JSONValue {
        try await client.post(
            "customer-portal/quotes/\(BdClient.escape(id))/reject",
            headers: headers
        )
    }
}

// MARK: - Namespaces

extension BdClient {
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
    /// Hand a customer-portal invite link out again.
    ///
    /// ROTATES the token — the previous link stops working. That is the point rather
    /// than a side effect: if the reason for resending was "it went to the wrong
    /// address", rotating IS the fix, and reusing the token would leave the wrong
    /// recipient holding a working invitation.
    ///
    /// Rate limited to one send a minute per invitation, answering 429 with a retry
    /// hint — resend mails an address the caller chose, so an unbounded one is a
    /// mail-bombing tool. Refuses a revoked invitation (resending would quietly
    /// un-revoke it) and a fully-redeemed one.
    public func resendCustomerInvite(
        _ inviteId: String,
        expiresInDays: Int? = nil
    ) async throws -> JSONValue {
        var body: [String: Int] = [:]
        if let expiresInDays { body["expiresInDays"] = expiresInDays }
        return try await client.post(
            "customer-invites/\(BdClient.escape(inviteId))/resend",
            body: body,
            headers: headers
        )
    }

    /// Dispatch status for a job the customer owns.
    ///
    /// Read `dispatchStatus` (job-level) for "is anyone on the way" and
    /// `assignments[].dispatchStatus` for per-technician detail. They differ on
    /// purpose: the job is `completed` only once the LAST assignee finishes, so
    /// aggregating client-side tells a customer the work is done while someone
    /// is still on site.
    ///
    /// Nothing about the dispatch cascade is exposed — who was offered the job,
    /// who declined, how many were asked. That is staff-internal.
    func dispatchStatus(_ jobId: String) async throws -> JSONValue {
        try await client.get(
            "customer-portal/jobs/\(BdClient.escape(jobId))/eta",
            headers: headers
        )
    }

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
