import BusinessDashKit
import SwiftUI

/// The cart: a `CartLine` per item, then the `CartSummary` with Checkout
/// (StoreParts.swift).
public struct CartView: View {
    @Environment(BdEnvironment.self) private var bd
    @Environment(\.openURL) private var openURL

    @State private var model = CartViewModel()

    public init() {}

    public var body: some View {
        LoadableView(state: model.state) { snapshot in
            List {
                if snapshot.isEmpty {
                    ContentUnavailableView("Your cart is empty", systemImage: "cart")
                } else {
                    Section {
                        ForEach(snapshot.items) { item in
                            CartLine(item: item, currency: snapshot.currency, quantity: quantityBinding(for: item))
                        }
                    }

                    Section {
                        CartSummary(
                            subtotal: snapshot.subtotal,
                            currency: snapshot.currency,
                            isCheckingOut: model.isCheckingOut
                        ) {
                            Task { await checkout() }
                        }
                    }
                }
            }
        }
        .navigationTitle("Cart")
        .task {
            model.bind(bd)
            await model.load()
        }
        .refreshable { await model.load() }
    }

    /// A stepper needs two-way binding, and the write is async. The model owns
    /// the mutation; this only adapts the shape SwiftUI wants.
    private func quantityBinding(for item: CartItem) -> Binding<Int> {
        Binding(
            get: { item.quantity },
            set: { newValue in
                Task { await model.setQuantity(item: item, quantity: newValue) }
            }
        )
    }

    /// Opening a browser is a view concern, so the model hands back a URL and
    /// this opens it. Checkout runs in the browser on purpose — no card data
    /// touches this process, which is what keeps the app out of PCI scope.
    private func checkout() async {
        if let url = await model.startCheckout() { openURL(url) }
    }
}
