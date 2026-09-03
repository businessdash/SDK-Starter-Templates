import Vapor

func routes(_ app: Application) throws {
    // ── Pages ──────────────────────────────────────────────────────────────
    app.get(use: PageController.home)
    app.get("blog", use: PageController.blog)
    app.get("blog", ":slug", use: PageController.blogPost)
    app.get("reviews", use: PageController.reviews)
    app.get("subscriptions", use: PageController.subscriptions)
    app.get("todos", use: PageController.todos)

    // Programmatic SEO — one template, N variants, copy owned by the dashboard.
    app.get("services", use: PageController.services)
    app.get("services", ":service", ":area", use: PageController.serviceArea)

    // ── Store ──────────────────────────────────────────────────────────────
    app.get("store", use: StoreController.index)
    app.get("store", ":id", use: StoreController.show)

    app.get("cart", use: CartController.show)
    app.post("cart", "items", use: CartController.addItem)
    app.post("cart", "clear", use: CartController.clear)
    app.post("cart", "checkout", use: CartController.checkout)

    // ── Machine endpoints ──────────────────────────────────────────────────
    // Same-origin proxy for the <bd-form> web component: the browser gets
    // the schema and posts submissions without ever seeing the bearer key.
    app.get("api", "bd", "forms", ":slug", use: BdFormController.schema)
    app.post("api", "bd", "forms", ":slug", use: BdFormController.submit)

    // Authenticated by HMAC over the raw body, not by session.
    app.post("api", "bd", "revalidate", use: WebhookController.handle)

    // ── SEO / AEO ──────────────────────────────────────────────────────────
    app.get("sitemap.xml", use: SeoController.sitemap)
    app.get("robots.txt", use: SeoController.robots)
    app.get("llms.txt", use: SeoController.llmsTxt)
}
