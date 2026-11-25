import Vapor

/// The store: the product list with its filters, one product, the wishlist,
/// the comparison and the order confirmation.
///
/// The product page, wishlist, compare table and save buttons are custom
/// elements (Public/shop/shop-elements.js), the same ones every BD starter
/// ships. This controller reads the data on the server and the template
/// writes it into the element as JSON; the element draws the page in the
/// browser.
enum StoreController {
    static let sorts = [
        ("featured", "Featured"),
        ("newest", "Newest"),
        ("price-asc", "Price: low to high"),
        ("price-desc", "Price: high to low"),
        ("rating-desc", "Top rated"),
    ]

    /// Reviews shown at first, and how many more each "Show more" adds.
    private static let reviewsPage = 10

    private static let filterKeys = ["q", "category", "priceMin", "priceMax", "rating"]

    /// The filters live in the URL (?q, ?category, ?priceMin, ?priceMax,
    /// ?rating, ?sort) and are links, so a filtered list can be shared and the
    /// back button steps through them.
    static func index(req: Request) async throws -> View {
        var query: [String: String] = [:]
        for key in filterKeys + ["sort"] {
            if let value = req.query[String.self, at: key]?.trimmingCharacters(in: .whitespaces), !value.isEmpty {
                query[key] = value
            }
        }
        let rating = query["rating"].flatMap(Int.init).flatMap { (1...5).contains($0) ? $0 : nil }
        let sort = query["sort"].flatMap { s in sorts.contains { $0.0 == s } ? s : nil } ?? "featured"
        let filters = StoreFilters(
            search: query["q"],
            categoryID: query["category"],
            minPriceCents: cents(query["priceMin"]),
            maxPriceCents: cents(query["priceMax"]),
            minRating: rating,
            sort: sort
        )

        let cartCount = await CartVisitor.itemCount(req)
        var listing: ProductGridResponse?
        var categories: [StoreCategory] = []
        if let bd = req.bd {
            listing = await req.bdCache.fetch(
                "storefront:grid:\(filters.cacheKey)", tags: ["bd:storefront"], fallback: Optional<ProductGridResponse>.none
            ) { try await bd.productGrid(filters) }
            categories = await req.bdCache.fetch("storefront:categories", tags: ["bd:storefront"], fallback: []) {
                try await bd.storeCategories().items
            }
        }

        /// This list with some filters changed (nil removes one).
        func href(_ changes: [String: String?]) -> String {
            var next = query
            for (key, value) in changes { next[key] = value }
            return "/store" + queryString(next.sorted { $0.key < $1.key }.map { ($0.key, $0.value) })
        }
        /// The filters a form leaves alone, carried along as hidden fields.
        func keep(_ replaced: String...) -> [HiddenField] {
            query.filter { !replaced.contains($0.key) }
                .sorted { $0.key < $1.key }
                .map { HiddenField(name: $0.key, value: $0.value) }
        }

        let counts = Dictionary(
            (listing?.categoryCounts ?? []).map { ($0.categoryId, $0.count ?? 0) },
            uniquingKeysWith: { first, _ in first }
        )
        let products = listing?.products ?? []
        let hasFilters = filterKeys.contains { query[$0] != nil }

        return try await req.view.render("store", StoreListContext(
            configured: req.application.bdConfigured,
            cartCount: cartCount,
            unavailable: listing == nil,
            search: query["q"] ?? "",
            priceMin: query["priceMin"] ?? "",
            priceMax: query["priceMax"] ?? "",
            priceMinPlaceholder: listing?.priceRange.map { "$\(Int($0.minDollars.rounded(.down)))" } ?? "Min",
            priceMaxPlaceholder: listing?.priceRange.map { "$\(Int($0.maxDollars.rounded(.up)))" } ?? "Max",
            keepForSearch: keep("q"),
            keepForPrice: keep("priceMin", "priceMax"),
            keepForSort: keep("sort"),
            allHref: href(["category": nil]),
            allActive: filters.categoryID == nil,
            categories: categories.map { category in
                let active = filters.categoryID == category.id
                return FacetLink(
                    label: category.name,
                    href: href(["category": active ? nil : category.id]),
                    productCount: counts[category.id] ?? 0,
                    active: active
                )
            },
            hasCategories: !categories.isEmpty,
            ratings: [4, 3, 2].map { stars in
                let active = filters.minRating == stars
                return RatingLink(
                    starsHTML: Stars.html(Double(stars)),
                    href: href(["rating": active ? nil : String(stars)]),
                    active: active
                )
            },
            hasFilters: hasFilters,
            countLabel: "\(products.count) \(products.count == 1 ? "product" : "products")",
            sorts: sorts.map { SortOption(value: $0.0, label: $0.1, selected: $0.0 == sort) },
            products: products.map(card),
            isEmpty: products.isEmpty
        ))
    }

    private static func card(_ product: Product) -> StoreCard {
        let reviews = product.reviewCount ?? 0
        let save: [String: JSONValue] = [
            "id": .string(product.id),
            "name": .string(product.name),
            "image": product.coverImage.map(JSONValue.string) ?? .null,
            "priceCents": product.cheapestPriceCents.map { .number(Double($0)) } ?? .null,
        ]
        let price = product.cheapestPriceCents.map {
            (product.hasMultipleVariants == true ? "From " : "") + Money.cents($0)
        } ?? "View details"
        let compare = product.isOnSale == true ? product.comparePriceCents.map { Money.cents($0) } : nil
        return StoreCard(
            href: "/store/\(product.id.pathEscaped)",
            name: product.name.isEmpty ? "Untitled" : product.name,
            image: product.coverImage ?? "",
            hasImage: product.coverImage?.isEmpty == false,
            isBestSeller: product.isBestSeller == true,
            isNew: product.isNew == true,
            isOnSale: product.isOnSale == true,
            hasReviews: reviews > 0,
            starsHTML: Stars.html(product.avgRating ?? 0),
            reviewCount: reviews,
            price: price,
            compare: compare ?? "",
            hasCompare: compare != nil,
            isLowStock: product.isLowStock == true,
            saveData: ElementData.json(JSONValue.object(save))
        )
    }

    static func show(req: Request) async throws -> Response {
        let id = req.parameters.get("id") ?? ""
        let asked = req.query[Int.self, at: "reviews"] ?? 0
        let reviewLimit = asked > reviewsPage ? min(asked, 100) : reviewsPage
        let cartCount = await CartVisitor.itemCount(req)
        let configured = req.application.bdConfigured

        var product: JSONValue?
        var unavailable = false
        if let bd = req.bd {
            do {
                product = try await bd.productData(id)
            } catch let error as BdError where error.isUnavailable {
                unavailable = true
            } catch {
                req.logger.debug("product \(id): \(error)")
            }
        }

        var detail: ProductDetail?
        if let product, let bd = req.bd {
            async let reviews = try? bd.productReviewPage(id, limit: reviewLimit)
            async let addons = try? bd.productAddons(id)
            async let related = try? bd.relatedProducts(id, limit: 6)
            let (reviewPage, addonList, relatedList) = await (reviews, addons, related)

            let total = reviewPage?["totalCount"]?.intValue ?? 0
            let shown = reviewPage?["items"]?.arrayValue?.count ?? 0
            let more = total > shown ? "/store/\(id.pathEscaped)?reviews=\(reviewLimit + reviewsPage)#reviews" : nil

            detail = ProductDetail(
                product: product,
                reviews: reviewPage,
                addons: addonList?["items"]?.arrayValue ?? [],
                related: relatedList?["items"]?.arrayValue ?? [],
                moreReviewsHref: more
            )
        }
        let name = product?["name"]?.stringValue ?? ""

        let view = try await req.view.render("product", ProductPageContext(
            configured: configured,
            cartCount: cartCount,
            title: product == nil ? "Product — Store" : "\(name) — Store",
            unavailable: unavailable,
            found: product != nil,
            notFound: configured && product == nil && !unavailable,
            detail: detail
        ))
        // Not found is a 404, so the page isn't indexed; the store bar and a
        // link back still show.
        let response = try await view.encodeResponse(for: req)
        if configured && product == nil && !unavailable { response.status = .notFound }
        return response
    }

    /// Products saved on this device with ♡ Save; `<bd-wishlist>` draws them there.
    static func wishlist(req: Request) async throws -> View {
        try await req.view.render("wishlist", WishlistContext(
            configured: req.application.bdConfigured,
            cartCount: await CartVisitor.itemCount(req)
        ))
    }

    /// Up to four products side by side. The products come from ?ids=a,b, so
    /// a comparison can be shared; opened without ids, `<bd-compare>` moves
    /// this browser's picks into the URL.
    static func compare(req: Request) async throws -> View {
        let ids = (req.query[String.self, at: "ids"] ?? "")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .prefix(4)

        var columns: [JSONValue] = []
        if let bd = req.bd {
            for id in ids {
                guard let product = try? await bd.productData(id) else { continue }
                let reviews = try? await bd.productReviewPage(id, limit: 1)
                let count = reviews?["totalCount"]?.intValue ?? 0
                columns.append(.object([
                    "product": product,
                    "rating": count > 0
                        ? .object(["avg": reviews?["avgRating"] ?? .null, "count": .number(Double(count))])
                        : .null,
                ]))
            }
        }

        return try await req.view.render("compare", CompareContext(
            configured: req.application.bdConfigured,
            cartCount: await CartVisitor.itemCount(req),
            dataJSON: ElementData.json(JSONValue.object([
                "ids": .array(ids.map(JSONValue.string)),
                "columns": .array(columns),
            ]))
        ))
    }

    /// Back from Stripe: `checkout/{sessionId}` says whether the order is paid.
    static func order(req: Request) async throws -> View {
        var status: CheckoutStatus?
        if let bd = req.bd, let sessionID = req.query[String.self, at: "session_id"]?.nilIfEmpty {
            status = try? await bd.checkoutStatus(sessionID)
        }
        let email = status?.customerEmail ?? ""
        return try await req.view.render("order", OrderContext(
            configured: req.application.bdConfigured,
            cartCount: await CartVisitor.itemCount(req),
            paid: status?.paymentStatus == "paid",
            email: email,
            hasEmail: !email.isEmpty
        ))
    }

    private static func cents(_ value: String?) -> Int? {
        guard let value, let dollars = Double(value), dollars >= 0, dollars.isFinite else { return nil }
        return Int((dollars * 100).rounded())
    }
}
