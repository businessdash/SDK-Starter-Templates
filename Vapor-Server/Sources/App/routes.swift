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

    // ── Customer account ───────────────────────────────────────────────────
    // /my-account shows the sign-in screen when signed out, rendered here
    // (SignInController): password, emailed codes, Google / Apple / GitHub /
    // Discord links — WorkOS underneath, through BD's customer routes.
    app.get("my-account", use: AccountController.page)
    app.post("my-account", "sign-in", use: SignInController.submit)
    app.post("my-account", "sign-in", "check", use: SignInController.check)
    app.on(.GET, "api", "bd-auth", "customer", "**", use: AccountController.customer)
    app.on(.POST, "api", "bd-auth", "customer", "**", body: .collect(maxSize: "64kb"), use: AccountController.customer)
    app.get("api", "bd-auth", "sign-out", use: AccountController.signOut)
    app.post("api", "bd-auth", "sign-out", use: AccountController.signOut)
    app.get("api", "bd-auth", "delete-account", use: AccountController.deleteAccount)
    app.post("api", "bd-auth", "delete-account", use: AccountController.deleteAccount)

    // ── Forms and quizzes, rendered here by the BdForms engine ─────────────
    // Any form from your dashboard; the home page's contact section is one.
    app.get("forms", ":slug", use: FormRoutes.page)
    app.on(.POST, "forms", ":slug", body: .collect(maxSize: "32mb"), use: FormRoutes.post)
    // A practice quiz or the sample at /quiz (BD_QUIZ), any practice quiz at
    // /quiz/<slug>, an invitation at /quiz-invite/<token> — the link BD's
    // invite emails carry when this site is the quiz's invite domain — and
    // the running clock each quiz page re-reads.
    app.get("quiz", use: QuizRoutes.page)
    app.get("quiz", ":slug", use: QuizRoutes.page)
    app.on(.POST, "quiz", ":slug", body: .collect(maxSize: "1mb"), use: QuizRoutes.post)
    app.get("quiz-invite", ":token", use: QuizRoutes.page)
    app.on(.POST, "quiz-invite", ":token", body: .collect(maxSize: "1mb"), use: QuizRoutes.post)
    app.get("quiz-timer", ":run", use: QuizRoutes.timer)

    // ── Machine endpoints ──────────────────────────────────────────────────
    // Authenticated by HMAC over the raw body, not by session.
    app.post("api", "bd", "revalidate", use: WebhookController.handle)

    // ── SEO / AEO ──────────────────────────────────────────────────────────
    app.get("sitemap.xml", use: SeoController.sitemap)
    app.get("robots.txt", use: SeoController.robots)
    app.get("llms.txt", use: SeoController.llmsTxt)
}
