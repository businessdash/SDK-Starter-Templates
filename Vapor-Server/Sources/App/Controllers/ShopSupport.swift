import Vapor

// What the store and blog pages share: the cart cookie, an element's data as
// JSON, the stars for a rating, and the checks on the elements' JSON POSTs.

/// The visitor's cart token: an httpOnly cookie on this domain, minted on the
/// first add. The cart itself lives at BD, keyed on whatever arrives in
/// `X-BD-Cart-Visitor`, so nothing about it is in a session or a database —
/// which is why this works unchanged behind a load balancer with no sticky
/// sessions.
enum CartVisitor {
    static let cookieName = "bd_cart_visitor"

    static func token(_ req: Request) -> String? {
        req.cookies[cookieName]?.string.nilIfEmpty
    }

    /// The token, minting one on first write, and the cookie to set (nil when
    /// one already existed). There is no round trip to get one — the platform
    /// keys the cart on whatever arrives in the header. (`cart/session` exists
    /// but mints a tokenized iframe-embed URL, a different feature.)
    static func ensure(_ req: Request) -> (String, HTTPCookies.Value?) {
        if let existing = token(req) { return (existing, nil) }

        let token = UUID().uuidString
        let cookie = HTTPCookies.Value(
            string: token,
            expires: Date().addingTimeInterval(60 * 60 * 24 * 30),
            isSecure: AccountController.isHTTPS(req),
            isHTTPOnly: true,
            sameSite: .lax
        )
        return (token, cookie)
    }

    /// The items in this visitor's cart, for the store bar; 0 without a cart.
    /// Per visitor, so never cached.
    static func itemCount(_ req: Request) async -> Int {
        guard let bd = req.bd, let token = token(req) else { return 0 }
        return (try? await bd.cart(visitor: token).itemCount) ?? 0
    }
}

/// Server data for a shop or blog element, as JSON to put in a
/// `<script type="application/json">` inside it (with `#unsafeHTML`).
/// `<`, `>` and `&` can only appear inside JSON strings, so writing them as
/// `\u` escapes changes nothing for the reader and means the JSON can't close
/// the tag early.
enum ElementData {
    static func json(_ value: some Encodable) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        guard let data = try? encoder.encode(value), let text = String(data: data, encoding: .utf8) else { return "null" }
        return text
            .replacingOccurrences(of: "<", with: "\\u003c")
            .replacingOccurrences(of: ">", with: "\\u003e")
            .replacingOccurrences(of: "&", with: "\\u0026")
    }
}

/// Stars for a rating, the same markup the shop elements draw. Numbers only,
/// so the HTML is safe to print with `#unsafeHTML`.
enum Stars {
    static func html(_ rating: Double) -> String {
        let stars = (1...5).map { i -> String in
            let value = Double(i)
            let modifier = rating >= value ? " stars__star--on" : rating >= value - 0.5 ? " stars__star--half" : ""
            return "<span class=\"stars__star\(modifier)\">★</span>"
        }
        return "<span aria-label=\"\(String(format: "%.1f", rating)) out of 5\" class=\"stars\" role=\"img\">\(stars.joined())</span>"
    }
}

/// The shop and blog elements' POSTs (add to cart, like, comment).
///
/// Vapor has no CSRF middleware, and these endpoints act with the visitor's
/// cookies, so two checks stand in for one: the body must be JSON (a form on
/// another site can't send that without a CORS preflight, which this app
/// never answers), and a browser's `Origin`, when sent, must be this site
/// (its `Host`, or the `X-Forwarded-Host` a proxy passes on). A cross-site
/// page can set neither header. The cookies are SameSite=Lax as well, so a
/// cross-site POST carries none.
enum PageJSON {
    static func refusal(_ req: Request) -> Response? {
        guard req.headers.contentType == .json else {
            return reply(.unsupportedMediaType, ["ok": .bool(false), "error": .string("Send JSON.")])
        }
        if let origin = req.headers.first(name: .origin) {
            let originHost = URLComponents(string: origin).map { c in
                c.port.map { "\(c.host ?? ""):\($0)" } ?? (c.host ?? "")
            }?.lowercased()
            let hosts = [req.headers.first(name: .host), req.headers.first(name: "X-Forwarded-Host")]
                .compactMap { $0?.lowercased() }
            if originHost == nil || !hosts.contains(originHost!) {
                return reply(.forbidden, ["ok": .bool(false), "error": .string("Send this from the site's own pages.")])
            }
        }
        return nil
    }

    static func reply(_ status: HTTPStatus, _ body: [String: JSONValue]) -> Response {
        let response = Response(status: status)
        response.headers.cacheControl = .init(noStore: true)
        try? response.content.encode(JSONValue.object(body), as: .json)
        return response
    }
}
