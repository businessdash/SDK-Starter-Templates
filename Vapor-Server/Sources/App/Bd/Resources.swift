import Vapor

// The read/write surface, grouped the way the other starters group it.

extension BdClient {
    // MARK: Storefront

    func products(limit: Int? = nil) async throws -> ProductListResponse {
        try await get("storefront/products", query: ["limit": limit.map(String.init)])
    }

    /// The full shop list: cards with their flags, plus `categoryCounts` and
    /// the catalogue's `priceRange` for the filters. `sort` is featured |
    /// newest | price-asc | price-desc | rating-desc.
    func productGrid(_ filters: StoreFilters, limit: Int = 48) async throws -> ProductGridResponse {
        try await get("storefront/products", query: [
            "meta": "1",
            "search": filters.search,
            "categoryId": filters.categoryID,
            "minPriceCents": filters.minPriceCents.map(String.init),
            "maxPriceCents": filters.maxPriceCents.map(String.init),
            "minRating": filters.minRating.map(String.init),
            "sort": filters.sort,
            "limit": String(limit)
        ])
    }

    func storeCategories() async throws -> StoreCategoryListResponse {
        try await get("storefront/categories")
    }

    func product(_ id: String) async throws -> Product {
        try await get("storefront/products/\(id.pathEscaped)")
    }

    // The product page's data, as BD sends it. It goes to the shop elements
    // untouched (see `JSONValue`), so it isn't decoded into types here.

    func productData(_ id: String) async throws -> JSONValue {
        try await get("storefront/products/\(id.pathEscaped)")
    }

    /// `{ items, totalCount, avgRating }`.
    func productReviewPage(_ id: String, limit: Int) async throws -> JSONValue {
        try await get("storefront/products/\(id.pathEscaped)/reviews", query: ["limit": String(limit)])
    }

    func productAddons(_ id: String) async throws -> JSONValue {
        try await get("storefront/products/\(id.pathEscaped)/addons")
    }

    func relatedProducts(_ id: String, limit: Int) async throws -> JSONValue {
        try await get("storefront/products/\(id.pathEscaped)/related", query: ["limit": String(limit)])
    }

    // MARK: Cart + checkout

    private func cartHeaders(_ visitor: String) -> [(String, String)] {
        [("X-BD-Cart-Visitor", visitor)]
    }

    func cart(visitor: String) async throws -> CartSnapshot {
        try await get("cart", headers: cartHeaders(visitor))
    }

    func cartAdd(visitor: String, productID: String, quantity: Int) async throws -> CartSnapshot {
        try await cartAdd(visitor: visitor, CartAddItemInput(productId: productID, quantity: quantity))
    }

    func cartAdd(visitor: String, _ input: CartAddItemInput) async throws -> CartSnapshot {
        try await post("cart/items", body: input, headers: cartHeaders(visitor))
    }

    func cartClear(visitor: String) async throws -> CartSnapshot {
        try await post("cart/clear", body: EmptyBody(), headers: cartHeaders(visitor))
    }

    func startCheckout(visitor: String, urls: CheckoutURLs) async throws -> CheckoutSession {
        try await post("checkout/start", body: urls, headers: cartHeaders(visitor))
    }

    func checkoutStatus(_ sessionID: String) async throws -> CheckoutStatus {
        try await get("checkout/\(sessionID.pathEscaped)")
    }

    // MARK: Content

    func posts(limit: Int = 20, cursor: String? = nil, categoryID: String? = nil) async throws -> BlogListResponse {
        try await get("blog/posts", query: ["limit": String(limit), "cursor": cursor, "categoryId": categoryID])
    }

    func post(slug: String) async throws -> BlogPostDetail {
        try await get("blog/posts/\(slug.pathEscaped)")
    }

    func blogCategories() async throws -> BlogCategoryListResponse {
        try await get("blog/categories")
    }

    func blogTags() async throws -> BlogTagListResponse {
        try await get("blog/tags")
    }

    /// A post's comments, for `<bd-post-comments>` (it owns their shape).
    func comments(slug: String, limit: Int = 50) async throws -> JSONValue {
        try await get("blog/posts/\(slug.pathEscaped)/comments", query: ["limit": String(limit)])
    }

    // Liking and commenting are done as the signed-in customer: their
    // `bd_session` cookie goes out as **`X-BD-Session-Token`** (not the
    // lowercase `x-bd-session` that `auth/me` takes).

    func likeStatus(slug: String, session: String?) async throws -> PostLikes {
        try await get(
            "blog/posts/\(slug.pathEscaped)/like",
            headers: session.map { [("X-BD-Session-Token", $0)] } ?? []
        )
    }

    func toggleLike(slug: String, session: String) async throws -> PostLikes {
        try await post("blog/posts/\(slug.pathEscaped)/like", body: EmptyBody(), headers: [("X-BD-Session-Token", session)])
    }

    /// The reply carries the comment and the moderation verdict:
    /// `moderation.isApproved` false means it waits for review.
    func postComment(slug: String, content: String, session: String) async throws -> JSONValue {
        try await post(
            "blog/posts/\(slug.pathEscaped)/comments",
            body: CommentInput(content: content),
            headers: [("X-BD-Session-Token", session)]
        )
    }

    /// One page of the business's reviews, newest first. `source` narrows to
    /// one platform (google, yelp, housecall_pro, other). The average and the
    /// stars breakdown ride the marketing bundle's `reviews`.
    func reviews(limit: Int = 10, offset: Int = 0, source: String? = nil) async throws -> ReviewListResponse {
        try await get("reviews", query: ["limit": String(limit), "offset": String(offset), "source": source])
    }

    func subscriptions() async throws -> SubscriptionListResponse {
        try await get("subscriptions")
    }

    func pageBundle(_ pageKey: String = "home") async throws -> JSONValue {
        try await get(sitePath("marketing/bundle"), query: ["pageKey": pageKey])
    }

    func parallelVariants(_ key: String) async throws -> JSONValue {
        try await get(sitePath("parallel-pages/\(key.pathEscaped)/variants"))
    }

    func renderParallelPage(_ key: String, params: [String: String]) async throws -> JSONValue {
        try await get(
            sitePath("parallel-pages/\(key.pathEscaped)/render"),
            query: params.mapValues { Optional($0) }
        )
    }

    // MARK: Custom database
    // (Forms are Sources/App/Forms: the BdForms engine talks to BD itself.)

    func records(object: String, limit: Int = 200, cursor: String? = nil) async throws -> DataModelRecordsResponse {
        try await get(sitePath("data-model/records"), query: [
            "object": object,
            "limit": String(limit),
            "cursor": cursor
        ])
    }

    /// Page through everything, bounded so a malformed cursor can't spin.
    func allRecords(object: String) async throws -> [DataModelRecord] {
        var all: [DataModelRecord] = []
        var cursor: String?

        for _ in 0..<50 {
            let page = try await records(object: object, cursor: cursor)
            all.append(contentsOf: page.records)
            guard let next = page.nextCursor else { break }
            cursor = next
        }

        return all
    }
}

struct EmptyBody: Content {}

struct CommentInput: Content {
    let content: String
}

/// The store list's filters, already checked (see `StoreController.index`).
struct StoreFilters: Hashable, Sendable {
    var search: String?
    var categoryID: String?
    var minPriceCents: Int?
    var maxPriceCents: Int?
    var minRating: Int?
    var sort = "featured"

    /// Every filter, spelled out, for the cache.
    var cacheKey: String {
        [search, categoryID, minPriceCents.map(String.init), maxPriceCents.map(String.init), minRating.map(String.init), sort]
            .map { ($0 ?? "").queryEscaped }
            .joined(separator: "|")
    }
}
