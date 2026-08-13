import Vapor

enum PageController {
    static func home(req: Request) async throws -> View {
        guard let biab = req.biab else {
            return try await req.view.render("home", HomeContext.fallback)
        }

        let bundle = await req.biabCache.fetch(
            "marketing:home", tags: ["biab:marketing"], fallback: JSONValue.null
        ) { try await biab.pageBundle() }

        let products = await req.biabCache.fetch(
            "storefront:featured", tags: ["biab:storefront"], fallback: [Product]()
        ) { try await biab.products(limit: 6).products }

        return try await req.view.render("home", HomeContext(
            configured: req.application.biabConfigured,
            headline: bundle.string("sections", "hero", "headline") ?? HomeContext.fallback.headline,
            subhead: bundle.string("sections", "hero", "subhead") ?? HomeContext.fallback.subhead,
            aboutTitle: bundle.string("sections", "about", "title") ?? HomeContext.fallback.aboutTitle,
            aboutBody: bundle.string("sections", "about", "body") ?? HomeContext.fallback.aboutBody,
            products: products.map(ProductCard.init)
        ))
    }

    static func blog(req: Request) async throws -> View {
        let posts: [BlogPost] = await withBiab(req, fallback: []) { biab in
            await req.biabCache.fetch("blog:list", tags: ["biab:blog"], fallback: []) {
                try await biab.posts().posts
            }
        }
        return try await req.view.render("blog", ListContext(configured: req.application.biabConfigured, posts: posts))
    }

    static func blogPost(req: Request) async throws -> View {
        let slug = req.parameters.get("slug") ?? ""
        guard let biab = req.biab else { throw Abort(.notFound) }

        // The API wraps the post: `{ post, access }`. `access` is how a
        // paywalled post is signalled — the body comes back truncated rather
        // than absent, so a page that ignores it renders a teaser as if it
        // were the whole article.
        let detail = await req.biabCache.fetch(
            "blog:post:\(slug)", tags: ["biab:blog", "biab:blog:\(slug)"],
            fallback: Optional<BlogPostDetail>.none
        ) { try await biab.post(slug: slug) }

        guard let detail else { throw Abort(.notFound) }

        return try await req.view.render("post", PostContext(
            configured: req.application.biabConfigured,
            post: detail.post,
            isPaywalled: detail.isPaywalled
        ))
    }

    static func reviews(req: Request) async throws -> View {
        let reviews: [Review] = await withBiab(req, fallback: []) { biab in
            await req.biabCache.fetch("reviews", tags: ["biab:reviews"], fallback: []) {
                try await biab.reviews().reviews
            }
        }
        return try await req.view.render("reviews", ReviewsContext(
            configured: req.application.biabConfigured, reviews: reviews
        ))
    }

    static func subscriptions(req: Request) async throws -> View {
        let plans: [SubscriptionPlan] = await withBiab(req, fallback: []) { biab in
            await req.biabCache.fetch("subscriptions", tags: ["biab:subscriptions"], fallback: []) {
                try await biab.subscriptions().subscriptions
            }
        }
        return try await req.view.render("subscriptions", PlansContext(
            configured: req.application.biabConfigured,
            plans: plans.map { PlanCard(id: $0.id, name: $0.name, price: Money.cents($0.amountCents)) }
        ))
    }

    /// The relational custom-database demo. Reads come from the data-model
    /// API; creates go through the generated form (there is no direct
    /// row-insert API for consumers, which keeps validation on the platform).
    static func todos(req: Request) async throws -> View {
        let todos: [DataModelRecord] = await withBiab(req, fallback: []) { biab in
            await req.biabCache.fetch("data-model:todos", tags: ["biab:data-model"], fallback: []) {
                try await biab.allRecords(object: "todos")
            }
        }

        return try await req.view.render("todos", TodosContext(
            configured: req.application.biabConfigured,
            todos: todos.map { TodoRow(title: $0.string("title") ?? "", notes: $0.string("notes") ?? "", done: $0.bool("done") ?? false) }
        ))
    }

    static func services(req: Request) async throws -> View {
        let variants: JSONValue = await withBiab(req, fallback: .null) { biab in
            await req.biabCache.fetch("parallel:variants", tags: ["biab:parallel-pages"], fallback: .null) {
                try await biab.parallelVariants("service-area")
            }
        }

        let rows = (variants["variants"]?.arrayValue ?? []).compactMap { variant -> ServiceRow? in
            guard
                let service = variant.string("service") ?? variant.string("params", "service"),
                let area = variant.string("area") ?? variant.string("params", "area")
            else { return nil }
            return ServiceRow(service: service, area: area, label: variant.string("label") ?? "\(service) in \(area)")
        }

        return try await req.view.render("services", ServicesContext(
            configured: req.application.biabConfigured, variants: rows
        ))
    }

    static func serviceArea(req: Request) async throws -> View {
        guard
            let biab = req.biab,
            let service = req.parameters.get("service"),
            let area = req.parameters.get("area")
        else { throw Abort(.notFound) }

        let page = await req.biabCache.fetch(
            "parallel:\(service):\(area)", tags: ["biab:parallel-pages"], fallback: JSONValue.null
        ) { try await biab.renderParallelPage("service-area", params: ["service": service, "area": area]) }

        guard case .object = page else { throw Abort(.notFound) }

        return try await req.view.render("service-area", ServiceAreaContext(
            configured: req.application.biabConfigured,
            heading: page.string("heading") ?? "\(service.capitalized) in \(area.capitalized)",
            html: page.string("html") ?? page.string("body") ?? ""
        ))
    }

    /// Runs `work` when BIAB is configured, otherwise returns `fallback`.
    /// Keeps every handler above free of the same three-line guard.
    private static func withBiab<T: Sendable>(
        _ req: Request,
        fallback: T,
        _ work: (BiabClient) async -> T
    ) async -> T {
        guard let biab = req.biab else { return fallback }
        return await work(biab)
    }
}
