import Vapor

/// The business's reviews: the rating over all of them with a bar per star,
/// a platform filter, each review with its photos and a link to it on Google
/// or Yelp, more on demand, and writing one.
///
///     GET  /reviews?source=yelp&shown=20   the page; the filter and "Show more" are links
///     POST /reviews/write                  JSON from <bd-review-writer> (Public/shop/reviews-elements.js)
///
/// The rules are `Reviews`, the same as every BD starter's.
enum ReviewsController {
    /// The most a "Show more" link asks for.
    private static let mostShown = 200

    static func page(req: Request) async throws -> View {
        guard let bd = req.bd else { return try await req.view.render("reviews", ReviewsContext.notConnected) }
        let source = Reviews.sourceParam(req.query[String.self, at: "source"])
        var shown = min(mostShown, max(Reviews.pageSize, req.query[Int.self, at: "shown"] ?? Reviews.pageSize))
        shown -= shown % Reviews.pageSize
        let wanted = shown

        let empty = ReviewListResponse(items: [], totalCount: 0, nextOffset: nil)
        async let page = req.bdCache.fetch("reviews:\(source ?? "all"):\(wanted)", tags: ["bd:reviews"], fallback: empty) {
            try await firstReviews(bd, shown: wanted, source: source)
        }
        async let bundle = req.bdCache.fetch("marketing:home", tags: ["bd:marketing"], fallback: JSONValue.null) {
            try await bd.pageBundle()
        }
        // The platforms for the filter, from the newest 50.
        async let newest = req.bdCache.fetch("reviews:sources", tags: ["bd:reviews"], fallback: [Review]()) {
            try await bd.reviews(limit: 50).items
        }
        async let session = signedIn(req, bd)

        let (first, totals, probe, me) = await (page, bundle, newest, session)
        let summary = Reviews.summarize(totals["reviews"], fallbackTotal: first.totalCount ?? 0)
        let sources = Reviews.sourcesIn(probe.isEmpty ? first.items : probe)
        let more = first.nextOffset != nil && shown < mostShown
        return try await req.view.render("reviews", ReviewsContext(
            summary: summary,
            signedIn: me != nil,
            sources: sources,
            source: source,
            reviews: first.items,
            moreHref: more ? moreHref(source: source, shown: shown + Reviews.pageSize) : nil
        ))
    }

    /// `{ rating, title?, body }` from <bd-review-writer>, for the signed-in customer.
    static func write(req: Request) async throws -> Response {
        if let refusal = PageJSON.refusal(req) { return refusal }
        guard let bd = req.bd else {
            return PageJSON.reply(.serviceUnavailable, ["ok": .bool(false), "error": .string("Reviews aren't connected yet.")])
        }
        guard let session = await signedIn(req, bd) else {
            return PageJSON.reply(.unauthorized, ["ok": .bool(false), "error": .string("Sign in to write a review.")])
        }
        switch Reviews.check((try? req.content.decode(JSONValue.self)) ?? .null) {
        case .refused(let message):
            return PageJSON.reply(.badRequest, ["ok": .bool(false), "error": .string(message)])
        case .ok(let review):
            let portal = PortalResource(client: bd, sessionToken: session.token, organizationId: session.me.string("organizationId"))
            guard (try? await portal.submitReview(review)) != nil else {
                return PageJSON.reply(.badGateway, ["ok": .bool(false), "error": .string("Couldn't send your review. Try again.")])
            }
            return PageJSON.reply(.ok, ["ok": .bool(true)])
        }
    }

    /// The first `shown` reviews, newest first, a page of up to 50 at a time.
    private static func firstReviews(_ bd: BdClient, shown: Int, source: String?) async throws -> ReviewListResponse {
        var items: [Review] = []
        var next: Int? = 0
        var total = 0
        while let offset = next, items.count < shown {
            let page = try await bd.reviews(limit: min(50, shown - items.count), offset: offset, source: source)
            items += page.items
            total = page.totalCount ?? items.count
            next = page.nextOffset
            if page.items.isEmpty { break }
        }
        return ReviewListResponse(items: items, totalCount: total, nextOffset: next)
    }

    private static func moreHref(source: String?, shown: Int) -> String {
        let query = source.map { "source=\($0)&" } ?? ""
        return "/reviews?\(query)shown=\(shown)#review-\(shown - Reviews.pageSize)"
    }

    /// The session cookie and who it is, when `auth/me` says it still belongs to a customer.
    private static func signedIn(_ req: Request, _ bd: BdClient) async -> (token: String, me: JSONValue)? {
        guard
            let token = req.cookies[AccountController.sessionCookie]?.string.nilIfEmpty,
            let me = try? await bd.get("auth/me", as: JSONValue.self, headers: [("x-bd-session", token)]),
            me["user"] != nil
        else { return nil }
        return (token, me)
    }
}
