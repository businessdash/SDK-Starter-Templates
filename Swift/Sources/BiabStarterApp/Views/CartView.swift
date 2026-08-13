import BiabKit
import SwiftUI

struct CartView: View {
    @Environment(BiabEnvironment.self) private var biab
    @Environment(\.openURL) private var openURL

    @State private var state: LoadState<CartSnapshot> = .loading
    @State private var isCheckingOut = false

    var body: some View {
        LoadableView(state: state) { snapshot in
            List {
                if snapshot.isEmpty {
                    ContentUnavailableView("Your cart is empty", systemImage: "cart")
                } else {
                    Section {
                        ForEach(snapshot.items) { item in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(item.name ?? "Item")
                                    // Cart lines arrive DECIMAL, unlike
                                    // product prices. Two helpers, on purpose.
                                    Text(Money.amount(item.unitPrice, currency: snapshot.currency))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Stepper("\(item.quantity)", value: quantityBinding(for: item), in: 0...99)
                                    .labelsHidden()
                                Text("\(item.quantity)").monospacedDigit()
                            }
                        }
                    }

                    Section {
                        LabeledContent("Subtotal", value: Money.amount(snapshot.subtotal, currency: snapshot.currency))

                        Button {
                            Task { await checkout() }
                        } label: {
                            if isCheckingOut { ProgressView() } else { Text("Checkout") }
                        }
                        .disabled(isCheckingOut)
                    }
                }
            }
        }
        .navigationTitle("Cart")
        .task { await load() }
        .refreshable { await load() }
    }

    private func quantityBinding(for item: CartItem) -> Binding<Int> {
        Binding(
            get: { item.quantity },
            set: { newValue in Task { await setQuantity(item: item, quantity: newValue) } }
        )
    }

    private func load() async {
        guard let cart = biab.cart else {
            state = .loaded(.empty)
            return
        }
        state = await LoadState { try await cart.snapshot() }
    }

    private func setQuantity(item: CartItem, quantity: Int) async {
        guard let cart = biab.cart else { return }
        state = await LoadState {
            quantity == 0
                ? try await cart.remove(itemID: item.id)
                : try await cart.setQuantity(itemID: item.id, quantity: quantity)
        }
    }

    /// Checkout hands off to Stripe in a browser. No card data touches this
    /// process, which is what keeps the app out of PCI scope.
    private func checkout() async {
        guard let cart = biab.cart else { return }
        isCheckingOut = true
        defer { isCheckingOut = false }

        let urls = CheckoutURLs(
            // Stripe substitutes the real id for the placeholder.
            successURL: "biabstarter://checkout/success?session_id={CHECKOUT_SESSION_ID}",
            cancelURL: "biabstarter://checkout/cancel"
        )

        // Note the field name: `stripeUrl`, not `url`.
        if let session = try? await cart.startCheckout(urls), let url = session.stripeURL {
            openURL(url)
        }
    }
}
