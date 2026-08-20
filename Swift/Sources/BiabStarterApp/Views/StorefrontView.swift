import BusinessDashKit
import SwiftUI

struct StorefrontView: View {
    @Environment(BiabEnvironment.self) private var biab
    @State private var model = StorefrontViewModel()

    var body: some View {
        LoadableView(state: model.state) { products in
            List(products) { product in
                NavigationLink {
                    ProductDetailView(productID: product.id)
                } label: {
                    ProductRow(product: product)
                }
            }
            .overlay {
                if products.isEmpty {
                    ContentUnavailableView(
                        "No products yet",
                        systemImage: "bag",
                        description: Text("Add some in the BIAB dashboard, or connect this app to a site.")
                    )
                }
            }
        }
        .navigationTitle("Shop")
        .searchable(text: $model.search)
        // `.task(id:)` cancels the previous load when the query changes, so a
        // fast typist doesn't stack up requests or land an out-of-order result.
        // The cancellation is SwiftUI's job, which is why the view drives it
        // and the view model does not own a debounce.
        .task(id: model.search) {
            model.bind(biab)
            await model.load()
        }
    }
}

struct ProductRow: View {
    let product: Product

    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: product.imageURL) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Color.secondary.opacity(0.1)
            }
            .frame(width: 52, height: 52)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(product.name).font(.headline)
                if let subtitle = product.description {
                    Text(subtitle).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
            }

            Spacer()

            // Integer cents — see Money.
            // A card has no currency field — the cart carries it; USD is the default.
                Text(Money.cents(product.cheapestPriceCents))
                .font(.callout.monospacedDigit())
        }
    }
}
