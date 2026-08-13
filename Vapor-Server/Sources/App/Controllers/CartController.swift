import Vapor

/// The visitor token lives in an httpOnly cookie on this domain; the cart
/// lives at BIAB. Nothing about the cart is in a session or a database, which
/// is why this works unchanged behind a load balancer with no sticky sessions.
enum CartController {
    private static let cookieName = "biab_cart_visitor"

    static func show(req: Request) async throws -> View {
        guard let biab = req.biab, let token = visitorToken(req) else {
            return try await req.view.render("cart", CartContext(
                configured: req.application.biabConfigured, lines: [], subtotal: "", isEmpty: true
            ))
        }

        // Per-visitor: never cached, or one customer's cart would be served to
        // the next.
        let snapshot = (try? await biab.cart(visitor: token)) ?? .empty
        return try await req.view.render("cart", context(snapshot, configured: req.application.biabConfigured))
    }

    struct AddItemForm: Content {
        let productId: String
        let quantity: Int?
    }

    static func addItem(req: Request) async throws -> Response {
        let form = try req.content.decode(AddItemForm.self)
        let (token, cookie) = ensureVisitorToken(req)

        if let biab = req.biab {
            _ = try? await biab.cartAdd(visitor: token, productID: form.productId, quantity: form.quantity ?? 1)
        }

        let response = req.redirect(to: "/cart")
        if let cookie { response.cookies[cookieName] = cookie }
        return response
    }

    static func clear(req: Request) async throws -> Response {
        if let biab = req.biab, let token = visitorToken(req) {
            _ = try? await biab.cartClear(visitor: token)
        }
        return req.redirect(to: "/cart")
    }

    /// Hand off to Stripe. The URL comes back as **`stripeUrl`**, not `url`,
    /// and the redirect is a 303 so the browser re-issues it as GET.
    static func checkout(req: Request) async throws -> Response {
        guard let biab = req.biab, let token = visitorToken(req) else {
            return req.redirect(to: "/cart")
        }

        let origin = Environment.get("BIAB_SITE_ORIGIN") ?? "http://localhost:8080"
        let urls = CheckoutURLs(
            // Stripe substitutes the real id for the placeholder.
            successUrl: "\(origin)/store?session_id={CHECKOUT_SESSION_ID}",
            cancelUrl: "\(origin)/cart"
        )

        guard let session = try? await biab.startCheckout(visitor: token, urls: urls) else {
            return req.redirect(to: "/cart")
        }

        return req.redirect(to: session.stripeUrl, redirectType: .normal)
    }

    // MARK: - Visitor token

    private static func visitorToken(_ req: Request) -> String? {
        req.cookies[cookieName]?.string.nilIfEmpty
    }

    /// Mint on first write. There is no round trip to get one — the platform
    /// keys the cart on whatever arrives in the header. (`cart/session` exists
    /// but mints a tokenized iframe-embed URL, a different feature.)
    private static func ensureVisitorToken(_ req: Request) -> (String, HTTPCookies.Value?) {
        if let existing = visitorToken(req) { return (existing, nil) }

        let token = UUID().uuidString
        let cookie = HTTPCookies.Value(
            string: token,
            expires: Date().addingTimeInterval(60 * 60 * 24 * 30),
            isSecure: req.url.scheme == "https",
            isHTTPOnly: true,
            sameSite: .lax
        )
        return (token, cookie)
    }

    private static func context(_ snapshot: CartSnapshot, configured: Bool) -> CartContext {
        CartContext(
            configured: configured,
            lines: snapshot.items.map {
                CartLine(
                    id: $0.id,
                    name: $0.name ?? "Item",
                    quantity: $0.quantity,
                    // Cart lines arrive DECIMAL, unlike product prices.
                    unitPrice: Money.amount($0.unitPrice, currency: snapshot.currency)
                )
            },
            subtotal: Money.amount(snapshot.subtotal, currency: snapshot.currency),
            isEmpty: snapshot.items.isEmpty
        )
    }
}
