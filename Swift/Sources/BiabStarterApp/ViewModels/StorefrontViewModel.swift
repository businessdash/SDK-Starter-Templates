import BusinessDashKit
import Foundation
import Observation

/// The shop list.
///
/// Search lives here rather than in the view because it is the thing that
/// drives the request: keeping the query and the results in one place is what
/// lets `load(search:)` be the only code that knows an empty query means "the
/// whole grid".
@MainActor
@Observable
final class StorefrontViewModel: ScreenViewModel {
    var biab: BiabEnvironment?

    private(set) var state: LoadState<[Product]> = .loading
    var search = ""

    /// Load the grid for the current query.
    ///
    /// Cancellation is the caller's job: the view drives this from
    /// `.task(id: search)`, which tears down the previous load when the query
    /// changes. That is what keeps a fast typist from stacking requests and
    /// landing an out-of-order result — and it belongs to the view because
    /// SwiftUI owns the lifecycle, not this model.
    func load() async {
        guard let client else {
            state = .loaded([])
            return
        }
        state = await LoadState {
            try await client.storefront.grid(search: search).products
        }
    }
}

/// One product, and adding it to the cart.
@MainActor
@Observable
final class ProductDetailViewModel: ScreenViewModel {
    var biab: BiabEnvironment?

    let productID: String
    private(set) var state: LoadState<Product> = .loading
    private(set) var isAdding = false
    private(set) var addMessage: String?

    init(productID: String) {
        self.productID = productID
    }

    var canAddToCart: Bool { !isAdding && biab?.cart != nil }

    func load() async {
        guard let client else { return }
        state = await LoadState { try await client.storefront.product(productID) }
    }

    func add(_ product: Product) async {
        guard let cart = biab?.cart else { return }
        isAdding = true
        defer { isAdding = false }

        do {
            _ = try await cart.add(CartAddItemInput(productId: product.id))
            addMessage = "Added to cart."
        } catch let error as BiabError {
            addMessage = error.errorDescription
        } catch {
            addMessage = error.localizedDescription
        }
    }
}
