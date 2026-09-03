import Vapor

enum PageController {
    static func home(req: Request) async throws -> View {
        guard let bd = req.bd else {
            return try await req.view.render("home", HomeContext.fallback)
        }

        let bundle = await req.bdCache.fetch(
            "marketing:home", tags: ["bd:marketing"], fallback: JSONValue.null
        ) { try await bd.pageBundle() }

        let products = await req.bdCache.fetch(
            "storefront:featured", tags: ["bd:storefront"], fallback: [Product]()
        ) { try await bd.products(limit: 6).products }

        return try await req.view.render("home", HomeContext(
            configured: req.application.bdConfigured,
            headline: bundle.string("sections", "hero", "headline") ?? HomeContext.fallback.headline,
            subhead: bundle.string("sections", "hero", "subhead") ?? HomeContext.fallback.subhead,
            aboutTitle: bundle.string("sections", "about", "title") ?? HomeContext.fallback.aboutTitle,
            aboutBody: bundle.string("sections", "about", "body") ?? HomeContext.fallback.aboutBody,
            products: products.map(ProductCard.init)
        ))
    }

    static func blog(req: Request) async throws -> View {
        let posts: [BlogPost] = await withBd(req, fallback: []) { bd in
            await req.bdCache.fetch("blog:list", tags: ["bd:blog"], fallback: []) {
                try await bd.posts().posts
            }
        }
        return try await req.view.render("blog", ListContext(configured: req.application.bdConfigured, posts: posts))
    }

    static func blogPost(req: Request) async throws -> View {
        let slug = req.parameters.get("slug") ?? ""
        guard let bd = req.bd else { throw Abort(.notFound) }

        // The API wraps the post: `{ post, access }`. `access` is how a
        // paywalled post is signalled — the body comes back truncated rather
        // than absent, so a page that ignores it renders a teaser as if it
        // were the whole article.
        let detail = await req.bdCache.fetch(
            "blog:post:\(slug)", tags: ["bd:blog", "bd:blog:\(slug)"],
            fallback: Optional<BlogPostDetail>.none
        ) { try await bd.post(slug: slug) }

        guard let detail else { throw Abort(.notFound) }

        return try await req.view.render("post", PostContext(
            configured: req.application.bdConfigured,
            post: detail.post,
            isPaywalled: detail.isPaywalled
        ))
    }

    static func reviews(req: Request) async throws -> View {
        let reviews: [Review] = await withBd(req, fallback: []) { bd in
            await req.bdCache.fetch("reviews", tags: ["bd:reviews"], fallback: []) {
                try await bd.reviews().reviews
            }
        }
        return try await req.view.render("reviews", ReviewsContext(
            configured: req.application.bdConfigured, reviews: reviews
        ))
    }

    static func subscriptions(req: Request) async throws -> View {
        let plans: [SubscriptionPlan] = await withBd(req, fallback: []) { bd in
            await req.bdCache.fetch("subscriptions", tags: ["bd:subscriptions"], fallback: []) {
                try await bd.subscriptions().subscriptions
            }
        }
        return try await req.view.render("subscriptions", PlansContext(
            configured: req.application.bdConfigured,
            plans: plans.map { PlanCard(id: $0.id, name: $0.name, price: Money.cents($0.amountCents)) }
        ))
    }

    /// The relational custom-database demo. Reads come from the data-model
    /// API; creates go through the generated form (there is no direct
    /// row-insert API for consumers, which keeps validation on the platform).
    static func todos(req: Request) async throws -> View {
        let todos: [DataModelRecord] = await withBd(req, fallback: []) { bd in
            await req.bdCache.fetch("data-model:todos", tags: ["bd:data-model"], fallback: []) {
                try await bd.allRecords(object: "todos")
            }
        }

        return try await req.view.render("todos", TodosContext(
            configured: req.application.bdConfigured,
            todos: todos.map { TodoRow(title: $0.string("title") ?? "", notes: $0.string("notes") ?? "", done: $0.bool("done") ?? false) }
        ))
    }

    static func services(req: Request) async throws -> View {
        let variants: JSONValue = await withBd(req, fallback: .null) { bd in
            await req.bdCache.fetch("parallel:variants", tags: ["bd:parallel-pages"], fallback: .null) {
                try await bd.parallelVariants("service-area")
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
            configured: req.application.bdConfigured, variants: rows
        ))
    }

    static func serviceArea(req: Request) async throws -> View {
        guard
            let bd = req.bd,
            let service = req.parameters.get("service"),
            let area = req.parameters.get("area")
        else { throw Abort(.notFound) }

        let page = await req.bdCache.fetch(
            "parallel:\(service):\(area)", tags: ["bd:parallel-pages"], fallback: JSONValue.null
        ) { try await bd.renderParallelPage("service-area", params: ["service": service, "area": area]) }

        guard case .object = page else { throw Abort(.notFound) }

        return try await req.view.render("service-area", ServiceAreaContext(
            configured: req.application.bdConfigured,
            heading: page.string("heading") ?? "\(service.capitalized) in \(area.capitalized)",
            html: page.string("html") ?? page.string("body") ?? ""
        ))
    }

    /// Runs `work` when BD is configured, otherwise returns `fallback`.
    /// Keeps every handler above free of the same three-line guard.
    private static func withBd<T: Sendable>(
        _ req: Request,
        fallback: T,
        _ work: (BdClient) async -> T
    ) async -> T {
        guard let bd = req.bd else { return fallback }
        return await work(bd)
    }
}
