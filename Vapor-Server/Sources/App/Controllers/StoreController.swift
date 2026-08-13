import Vapor

enum StoreController {
    static func index(req: Request) async throws -> View {
        let search = try? req.query.get(String.self, at: "search")
        let sort = try? req.query.get(String.self, at: "sort")

        guard let biab = req.biab else {
            return try await req.view.render("store", StoreContext(
                configured: false, products: [], search: search ?? ""
            ))
        }

        let key = "storefront:grid:\(search ?? "")|\(sort ?? "")"
        let products = await req.biabCache.fetch(key, tags: ["biab:storefront"], fallback: [Product]()) {
            try await biab.productGrid(search: search, sort: sort).products
        }

        return try await req.view.render("store", StoreContext(
            configured: req.application.biabConfigured,
            products: products.map(ProductCard.init),
            search: search ?? ""
        ))
    }

    static func show(req: Request) async throws -> View {
        guard let biab = req.biab, let id = req.parameters.get("id") else { throw Abort(.notFound) }

        let product = await req.biabCache.fetch(
            "storefront:product:\(id)", tags: ["biab:storefront"], fallback: Optional<Product>.none
        ) { try await biab.product(id) }

        guard let product else { throw Abort(.notFound) }

        let reviews = await req.biabCache.fetch(
            "storefront:reviews:\(id)", tags: ["biab:storefront"], fallback: [Review]()
        ) { try await biab.productReviews(id).reviews }

        return try await req.view.render("product", ProductContext(
            configured: req.application.biabConfigured,
            id: product.id,
            name: product.name,
            description: product.description ?? "",
            price: Money.cents(product.cheapestPriceCents),
            reviews: reviews
        ))
    }
}
