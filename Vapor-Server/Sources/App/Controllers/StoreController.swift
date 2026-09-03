import Vapor

enum StoreController {
    static func index(req: Request) async throws -> View {
        let search = try? req.query.get(String.self, at: "search")
        let sort = try? req.query.get(String.self, at: "sort")

        guard let bd = req.bd else {
            return try await req.view.render("store", StoreContext(
                configured: false, products: [], search: search ?? ""
            ))
        }

        let key = "storefront:grid:\(search ?? "")|\(sort ?? "")"
        let products = await req.bdCache.fetch(key, tags: ["bd:storefront"], fallback: [Product]()) {
            try await bd.productGrid(search: search, sort: sort).products
        }

        return try await req.view.render("store", StoreContext(
            configured: req.application.bdConfigured,
            products: products.map(ProductCard.init),
            search: search ?? ""
        ))
    }

    static func show(req: Request) async throws -> View {
        guard let bd = req.bd, let id = req.parameters.get("id") else { throw Abort(.notFound) }

        let product = await req.bdCache.fetch(
            "storefront:product:\(id)", tags: ["bd:storefront"], fallback: Optional<Product>.none
        ) { try await bd.product(id) }

        guard let product else { throw Abort(.notFound) }

        let reviews = await req.bdCache.fetch(
            "storefront:reviews:\(id)", tags: ["bd:storefront"], fallback: [Review]()
        ) { try await bd.productReviews(id).reviews }

        return try await req.view.render("product", ProductContext(
            configured: req.application.bdConfigured,
            id: product.id,
            name: product.name,
            description: product.description ?? "",
            price: Money.cents(product.cheapestPriceCents),
            reviews: reviews
        ))
    }
}
