import Vapor

// The read/write surface, grouped the way the other starters group it.

extension BiabClient {
    // MARK: Storefront

    func products(limit: Int? = nil) async throws -> ProductListResponse {
        try await get("storefront/products", query: ["limit": limit.map(String.init)])
    }

    func productGrid(search: String?, sort: String?) async throws -> ProductGridResponse {
        try await get("storefront/products", query: [
            "meta": "1",
            "search": search?.nilIfEmpty,
            "sort": sort?.nilIfEmpty,
            "limit": "24"
        ])
    }

    func product(_ id: String) async throws -> Product {
        try await get("storefront/products/\(id.pathEscaped)")
    }

    func productReviews(_ id: String) async throws -> ReviewListResponse {
        try await get("storefront/products/\(id.pathEscaped)/reviews", query: ["limit": "5"])
    }

    // MARK: Cart + checkout

    private func cartHeaders(_ visitor: String) -> [(String, String)] {
        [("X-BIAB-Cart-Visitor", visitor)]
    }

    func cart(visitor: String) async throws -> CartSnapshot {
        try await get("cart", headers: cartHeaders(visitor))
    }

    func cartAdd(visitor: String, productID: String, quantity: Int) async throws -> CartSnapshot {
        try await post(
            "cart/items",
            body: CartAddItemInput(productId: productID, quantity: quantity),
            headers: cartHeaders(visitor)
        )
    }

    func cartClear(visitor: String) async throws -> CartSnapshot {
        try await post("cart/clear", body: EmptyBody(), headers: cartHeaders(visitor))
    }

    func startCheckout(visitor: String, urls: CheckoutURLs) async throws -> CheckoutSession {
        try await post("checkout/start", body: urls, headers: cartHeaders(visitor))
    }

    // MARK: Content

    func posts(limit: Int = 20) async throws -> BlogListResponse {
        try await get("blog/posts", query: ["limit": String(limit)])
    }

    func post(slug: String) async throws -> BlogPostDetail {
        try await get("blog/posts/\(slug.pathEscaped)")
    }

    func reviews(limit: Int = 10, offset: Int = 0) async throws -> ReviewListResponse {
        try await get("reviews", query: ["limit": String(limit), "offset": String(offset)])
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

    // MARK: Forms + custom database

    func formSchema(slug: String) async throws -> JSONValue {
        try await get("forms/\(slug.pathEscaped)")
    }

    func submitForm(slug: String, input: FormSubmitInput) async throws -> JSONValue {
        try await post("forms/\(slug.pathEscaped)", body: input)
    }

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
