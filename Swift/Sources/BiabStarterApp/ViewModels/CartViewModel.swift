import BusinessDashKit
import Foundation
import Observation

/// The cart, and the hand-off to Stripe.
@MainActor
@Observable
final class CartViewModel: ScreenViewModel {
    var biab: BiabEnvironment?

    private(set) var state: LoadState<CartSnapshot> = .loading
    private(set) var isCheckingOut = false

    func load() async {
        guard let cart = biab?.cart else {
            // No visitor token yet is an empty cart, not a failure — the
            // customer simply has not started one.
            state = .loaded(.empty)
            return
        }
        state = await LoadState { try await cart.snapshot() }
    }

    /// Quantity 0 removes the line, which is what a stepper hitting its floor
    /// means to a customer. Making them find a separate delete control for the
    /// same intent is the kind of friction people abandon carts over.
    func setQuantity(item: CartItem, quantity: Int) async {
        guard let cart = biab?.cart else { return }
        state = await LoadState {
            quantity == 0
                ? try await cart.remove(itemID: item.id)
                : try await cart.setQuantity(itemID: item.id, quantity: quantity)
        }
    }

    /// Mint a Stripe Checkout session and hand back its URL.
    ///
    /// Returns the URL rather than opening it: opening a browser is a view
    /// concern (`@Environment(\.openURL)`), and a view model that reaches for
    /// it cannot be tested without a UI.
    ///
    /// Checkout happens in the browser on purpose — no card data touches this
    /// process, which is what keeps the app out of PCI scope.
    func startCheckout() async -> URL? {
        guard let cart = biab?.cart else { return nil }
        isCheckingOut = true
        defer { isCheckingOut = false }

        let urls = CheckoutURLs(
            // Stripe substitutes the real id for the placeholder.
            successURL: "biabstarter://checkout/success?session_id={CHECKOUT_SESSION_ID}",
            cancelURL: "biabstarter://checkout/cancel"
        )
        // Note the field name: `stripeUrl`, not `url`.
        return try? await cart.startCheckout(urls).stripeURL
    }
}

/// The blog list.
@MainActor
@Observable
final class BlogViewModel: ScreenViewModel {
    var biab: BiabEnvironment?

    private(set) var state: LoadState<[BlogPost]> = .loading

    func load() async {
        guard let client else {
            state = .loaded([])
            return
        }
        state = await LoadState { try await client.blog.posts().posts }
    }
}
