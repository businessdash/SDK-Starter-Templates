import BiabKit
import SwiftUI

struct ProductDetailView: View {
    let productID: String

    @Environment(BiabEnvironment.self) private var biab
    @State private var state: LoadState<Product> = .loading
    @State private var isAdding = false
    @State private var addMessage: String?

    var body: some View {
        LoadableView(state: state) { product in
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    AsyncImage(url: product.imageURL) { image in
                        image.resizable().aspectRatio(contentMode: .fit)
                    } placeholder: {
                        Color.secondary.opacity(0.1).frame(height: 200)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    Text(product.name).font(.title2.bold())
                    Text(Money.cents(product.cheapestPriceCents))
                        .font(.title3.monospacedDigit())

                    if let description = product.description {
                        Text(description)
                    }

                    Button {
                        Task { await add(product) }
                    } label: {
                        if isAdding { ProgressView() } else { Text("Add to cart") }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isAdding || biab.cart == nil)

                    if let addMessage {
                        Text(addMessage).font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Product")
        .task { await load() }
    }

    private func load() async {
        guard let client = biab.client else { return }
        state = await LoadState { try await client.storefront.product(productID) }
    }

    private func add(_ product: Product) async {
        guard let cart = biab.cart else { return }
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
