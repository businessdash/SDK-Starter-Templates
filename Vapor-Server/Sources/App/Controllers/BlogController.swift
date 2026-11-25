import Vapor

/// The blog: the post list with its category and tag filters, one post, and
/// the like and comment endpoints for signed-in customers.
///
/// A post's HTML is rebuilt from an allowlist (`PostHtml`) before it reaches
/// the page. The like button and comments are custom elements
/// (Public/shop/blog-elements.js); signed out, they lead to sign-in and back.
enum BlogController {
    private static let page = 12

    /// One page of posts, pinned first on the first page. A tag is matched
    /// here, over the newest 50 posts, because the API filters by category
    /// only.
    static func index(req: Request) async throws -> View {
        let category = req.query[String.self, at: "category"]?.nilIfEmpty
        let tag = req.query[String.self, at: "tag"]?.nilIfEmpty
        let cursor = req.query[String.self, at: "cursor"].flatMap { Int($0) }.map(String.init)

        var list = BlogListResponse(items: [], nextCursor: nil)
        var categories: [BlogCategory] = []
        var tags: [String] = []
        if let bd = req.bd {
            let limit = tag == nil ? page : 50
            list = await req.bdCache.fetch(
                "blog:page:\(limit):\(cursor ?? ""):\(category ?? "")", tags: ["bd:blog"], fallback: list
            ) { try await bd.posts(limit: limit, cursor: cursor, categoryID: category) }
            categories = await req.bdCache.fetch("blog:categories", tags: ["bd:blog"], fallback: []) {
                try await bd.blogCategories().items
            }
            tags = await req.bdCache.fetch("blog:tags", tags: ["bd:blog"], fallback: []) {
                try await bd.blogTags().items
            }
        }

        var posts = list.posts.filter { tag == nil || ($0.tags ?? []).contains(tag!) }
        if cursor == nil {
            // Pinned first; the rest keep their order.
            posts = posts.filter { $0.isPinned == true } + posts.filter { $0.isPinned != true }
        }
        let active = categories.first { $0.id == category }

        /// This list with one filter changed and the paging reset.
        func href(_ key: String, _ value: String?) -> String {
            var next = ["category": category, "tag": tag]
            next[key] = value
            return "/blog" + queryString([("category", next["category"] ?? nil), ("tag", next["tag"] ?? nil)])
        }

        let nextCursor: String? = tag == nil ? list.nextCursor.flatMap { value in
            switch value {
            case .number(let n): return String(Int(n))
            case .string(let s): return s.nilIfEmpty
            default: return nil
            }
        } : nil

        return try await req.view.render("blog", BlogListContext(
            configured: req.application.bdConfigured,
            title: active.map { "\($0.name) — Blog" } ?? "Blog",
            heading: active?.name ?? "From the blog",
            description: active?.description ?? "",
            hasDescription: active?.description?.isEmpty == false,
            hasFilterNav: !categories.isEmpty || !tags.isEmpty,
            categories: [FilterLink(label: "All", href: href("category", nil), current: category == nil)]
                + categories.map { FilterLink(label: $0.name, href: href("category", $0.id), current: category == $0.id) },
            hasCategories: !categories.isEmpty,
            tags: tags.map { FilterLink(label: "#\($0)", href: href("tag", tag == $0 ? nil : $0), current: tag == $0) },
            hasTags: !tags.isEmpty,
            posts: posts.enumerated().map { index, post in
                PostCard(
                    href: "/blog/\(post.slug.pathEscaped)",
                    title: post.title,
                    image: post.imageUrl ?? "",
                    hasImage: post.imageUrl?.isEmpty == false,
                    pinned: post.isPinned == true,
                    date: PostHtml.date(post.publishedAt),
                    minutes: PostHtml.readingMinutes(post.content ?? post.excerpt),
                    excerpt: post.excerpt ?? "",
                    hasExcerpt: post.excerpt?.isEmpty == false,
                    author: post.authorName ?? "",
                    hasAuthor: post.authorName?.isEmpty == false,
                    lead: index == 0 && cursor == nil
                )
            },
            isEmpty: posts.isEmpty,
            filtered: tag != nil || category != nil,
            olderHref: "/blog" + queryString([("category", category), ("cursor", nextCursor)]),
            hasOlder: nextCursor != nil
        ))
    }

    static func show(req: Request) async throws -> Response {
        let slug = req.parameters.get("slug") ?? ""
        let configured = req.application.bdConfigured

        // The API wraps the post: `{ post, access }`. `access` is how a
        // paywalled post is signalled — the body comes back truncated rather
        // than absent, so a page that ignores it renders a teaser as if it
        // were the whole article.
        var detail: BlogPostDetail?
        if let bd = req.bd {
            detail = await req.bdCache.fetch(
                "blog:post:\(slug)", tags: ["bd:blog", "bd:blog:\(slug)"],
                fallback: Optional<BlogPostDetail>.none
            ) { try await bd.post(slug: slug) }
        }

        guard let bd = req.bd, let detail else {
            // A 404, so the page isn't indexed; a link back still shows.
            let response = try await req.view.render("post", PostPageContext.notFound(configured: configured))
                .encodeResponse(for: req)
            if configured { response.status = .notFound }
            return response
        }

        let post = detail.post
        let session = await signedInSession(req)
        let likes = (try? await bd.likeStatus(slug: slug, session: session))
            ?? PostLikes(liked: false, likesCount: post.likes ?? 0)
        let comments = (try? await bd.comments(slug: slug))?["items"] ?? .array([])
        let signIn = "/my-account?next=" + "/blog/\(slug.pathEscaped)".queryEscaped
        let cta = post.ctaHref?.nilIfEmpty != nil && post.ctaLabel?.nilIfEmpty != nil

        let context = PostPageContext(
            configured: configured,
            found: true,
            title: "\(post.title) — Blog",
            heading: post.title,
            author: post.authorName ?? "",
            hasAuthor: post.authorName?.isEmpty == false,
            avatar: post.authorAvatarUrl ?? "",
            hasAvatar: post.authorAvatarUrl?.isEmpty == false,
            date: PostHtml.date(post.publishedAt),
            minutes: PostHtml.readingMinutes(post.content),
            image: post.imageUrl ?? "",
            hasImage: post.imageUrl?.isEmpty == false,
            paywalled: detail.isPaywalled,
            html: PostHtml.safe(post.content),
            hasCTA: cta,
            ctaHref: ctaHref(post.ctaHref),
            ctaLabel: post.ctaLabel ?? "",
            ctaDescription: post.ctaDescription ?? "",
            hasCTADescription: post.ctaDescription?.isEmpty == false,
            tags: (post.tags ?? []).map { TagLink(label: "#\($0)", href: "/blog" + queryString([("tag", $0)])) },
            hasTags: post.tags?.isEmpty == false,
            signInHref: signIn,
            likeURL: "/blog/\(slug.pathEscaped)/like",
            commentURL: "/blog/\(slug.pathEscaped)/comment",
            likesJSON: ElementData.json(JSONValue.object([
                "likes": .object(["liked": .bool(likes.liked), "likesCount": .number(Double(likes.likesCount))]),
                "signedIn": .bool(session != nil),
            ])),
            commentsJSON: ElementData.json(JSONValue.object([
                "comments": comments,
                "signedIn": .bool(session != nil),
            ]))
        )
        return try await req.view.render("post", context).encodeResponse(for: req)
    }

    /// Like or unlike, for the signed-in customer: `{liked, likesCount}` or `{error}`.
    static func like(req: Request) async throws -> Response {
        if let refusal = PageJSON.refusal(req) { return refusal }
        let slug = req.parameters.get("slug") ?? ""
        guard let bd = req.bd else {
            return PageJSON.reply(.serviceUnavailable, ["error": .string("The blog isn't connected yet.")])
        }
        guard let session = sessionToken(req) else {
            return PageJSON.reply(.unauthorized, ["error": .string("Sign in to like posts.")])
        }
        guard let result = try? await bd.toggleLike(slug: slug, session: session) else {
            return PageJSON.reply(.badGateway, ["error": .string("Couldn't save your like. Try again.")])
        }
        return PageJSON.reply(.ok, ["liked": .bool(result.liked), "likesCount": .number(Double(result.likesCount))])
    }

    struct CommentJSON: Content {
        let content: String?
    }

    /// `{content}` in; out, whether it shows now or waits for approval, and
    /// the comments as they are now.
    static func comment(req: Request) async throws -> Response {
        if let refusal = PageJSON.refusal(req) { return refusal }
        let slug = req.parameters.get("slug") ?? ""
        guard let bd = req.bd else {
            return PageJSON.reply(.serviceUnavailable, ["ok": .bool(false), "error": .string("The blog isn't connected yet.")])
        }
        guard let session = sessionToken(req) else {
            return PageJSON.reply(.unauthorized, ["ok": .bool(false), "error": .string("Sign in to comment.")])
        }
        let content = ((try? req.content.decode(CommentJSON.self))?.content ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if content.isEmpty {
            return PageJSON.reply(.badRequest, ["ok": .bool(false), "error": .string("Write something first.")])
        }
        if content.count > 5000 {
            return PageJSON.reply(.badRequest, ["ok": .bool(false), "error": .string("Comments are up to 5,000 characters.")])
        }
        guard let posted = try? await bd.postComment(slug: slug, content: content, session: session) else {
            return PageJSON.reply(.badGateway, ["ok": .bool(false), "error": .string("Couldn't post your comment. Try again.")])
        }
        let comments = (try? await bd.comments(slug: slug))?["items"] ?? .array([])
        return PageJSON.reply(.ok, [
            "ok": .bool(true),
            "approved": .bool(posted["moderation", "isApproved"]?.boolValue == true),
            "comments": comments,
        ])
    }

    // MARK: - Helpers

    private static func sessionToken(_ req: Request) -> String? {
        req.cookies[AccountController.sessionCookie]?.string.nilIfEmpty
    }

    /// The session cookie, when `auth/me` says it still belongs to a customer.
    private static func signedInSession(_ req: Request) async -> String? {
        guard
            let bd = req.bd,
            let token = sessionToken(req),
            let me = try? await bd.get("auth/me", as: JSONValue.self, headers: [("x-bd-session", token)]),
            me["user"] != nil
        else { return nil }
        return token
    }

    /// Only web, mail, same-site and in-page links; anything else goes nowhere.
    private static func ctaHref(_ href: String?) -> String {
        let href = (href ?? "").trimmingCharacters(in: .whitespaces)
        let lower = href.lowercased()
        let allowed = lower.hasPrefix("http:") || lower.hasPrefix("https:") || lower.hasPrefix("mailto:")
            || href.hasPrefix("/") || href.hasPrefix("#")
        return allowed ? href : "#"
    }
}
