import Vapor

/// The visitor token lives in an httpOnly cookie on this domain; the cart
/// lives at BD. Nothing about the cart is in a session or a database, which
/// is why this works unchanged behind a load balancer with no sticky sessions.
enum CartController {
    private static let cookieName = CartVisitor.cookieName

    static func show(req: Request) async throws -> View {
        guard let bd = req.bd, let token = visitorToken(req) else {
            return try await req.view.render("cart", CartContext(
                configured: req.application.bdConfigured, lines: [], subtotal: "", isEmpty: true, cartCount: 0
            ))
        }

        // Per-visitor: never cached, or one customer's cart would be served to
        // the next.
        let snapshot = (try? await bd.cart(visitor: token)) ?? .empty
        return try await req.view.render("cart", context(snapshot, configured: req.application.bdConfigured))
    }

    struct AddItemForm: Content {
        let productId: String
        let quantity: Int?
    }

    static func addItem(req: Request) async throws -> Response {
        let form = try req.content.decode(AddItemForm.self)
        let (token, cookie) = ensureVisitorToken(req)

        if let bd = req.bd {
            _ = try? await bd.cartAdd(visitor: token, productID: form.productId, quantity: form.quantity ?? 1)
        }

        let response = req.redirect(to: "/cart")
        if let cookie { response.cookies[cookieName] = cookie }
        return response
    }

    struct AddItemJSON: Content {
        let productId: String?
        let quantity: Int?
        let variantId: String?
        let options: [String: JSONValue]?
    }

    /// Add to cart for the product page's `<bd-product>`: JSON in
    /// (`productId`, `quantity`, `variantId`, `options`), `{ok, itemCount}`
    /// or `{ok: false, error}` out.
    static func addJSON(req: Request) async throws -> Response {
        if let refusal = PageJSON.refusal(req) { return refusal }
        guard let bd = req.bd else {
            return PageJSON.reply(.serviceUnavailable, ["ok": .bool(false), "error": .string("The store isn't connected yet.")])
        }
        guard let input = try? req.content.decode(AddItemJSON.self), let productID = input.productId?.nilIfEmpty else {
            return PageJSON.reply(.badRequest, ["ok": .bool(false), "error": .string("Choose a product.")])
        }
        let options = (input.options ?? [:]).compactMapValues(\.stringValue)

        let (token, cookie) = CartVisitor.ensure(req)
        let response: Response
        do {
            let cart = try await bd.cartAdd(visitor: token, CartAddItemInput(
                productId: productID,
                quantity: min(99, max(1, input.quantity ?? 1)),
                variantId: input.variantId?.nilIfEmpty,
                options: options.isEmpty ? nil : options
            ))
            response = PageJSON.reply(.ok, ["ok": .bool(true), "itemCount": .number(Double(cart.itemCount ?? 0))])
        } catch {
            req.logger.debug("cart add: \(error)")
            response = PageJSON.reply(.badGateway, ["ok": .bool(false), "error": .string("Couldn't add that to your cart. Try again.")])
        }
        if let cookie { response.cookies[cookieName] = cookie }
        return response
    }

    static func clear(req: Request) async throws -> Response {
        if let bd = req.bd, let token = visitorToken(req) {
            _ = try? await bd.cartClear(visitor: token)
        }
        return req.redirect(to: "/cart")
    }

    /// Hand off to Stripe. The URL comes back as **`stripeUrl`**, not `url`,
    /// and the redirect is a 303 so the browser re-issues it as GET.
    static func checkout(req: Request) async throws -> Response {
        guard let bd = req.bd, let token = visitorToken(req) else {
            return req.redirect(to: "/cart")
        }

        let origin = Environment.get("BD_SITE_ORIGIN") ?? "http://localhost:8080"
        let urls = CheckoutURLs(
            // Stripe substitutes the real id for the placeholder.
            successUrl: "\(origin)/store/order?session_id={CHECKOUT_SESSION_ID}",
            cancelUrl: "\(origin)/cart"
        )

        guard let session = try? await bd.startCheckout(visitor: token, urls: urls) else {
            return req.redirect(to: "/cart")
        }

        return req.redirect(to: session.stripeUrl, redirectType: .normal)
    }

    // MARK: - Visitor token (see `CartVisitor`)

    private static func visitorToken(_ req: Request) -> String? { CartVisitor.token(req) }

    private static func ensureVisitorToken(_ req: Request) -> (String, HTTPCookies.Value?) { CartVisitor.ensure(req) }

    private static func context(_ snapshot: CartSnapshot, configured: Bool) -> CartContext {
        CartContext(
            configured: configured,
            lines: snapshot.items.map {
                CartLine(
                    id: $0.id,
                    name: [$0.productName ?? "Item", $0.variantTitle].compactMap { $0?.nilIfEmpty }.joined(separator: " · "),
                    quantity: $0.quantity,
                    // Cart lines arrive DECIMAL, unlike product prices.
                    unitPrice: Money.amount($0.unitPrice, currency: snapshot.currency)
                )
            },
            subtotal: Money.amount(snapshot.subtotal, currency: snapshot.currency),
            isEmpty: snapshot.items.isEmpty,
            cartCount: snapshot.itemCount ?? snapshot.items.reduce(0) { $0 + $1.quantity }
        )
    }
}
