import BiabKit
import SwiftUI

struct CartView: View {
    @Environment(BiabEnvironment.self) private var biab
    @Environment(\.openURL) private var openURL

    @State private var model = CartViewModel()

    var body: some View {
        LoadableView(state: model.state) { snapshot in
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
                            if model.isCheckingOut { ProgressView() } else { Text("Checkout") }
                        }
                        .disabled(model.isCheckingOut)
                    }
                }
            }
        }
        .navigationTitle("Cart")
        .task {
            model.bind(biab)
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
