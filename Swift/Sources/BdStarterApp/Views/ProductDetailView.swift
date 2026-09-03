import BusinessDashKit
import SwiftUI

struct ProductDetailView: View {
    let productID: String

    @Environment(BdEnvironment.self) private var bd
    @State private var model: ProductDetailViewModel

    init(productID: String) {
        self.productID = productID
        // The id is known at construction, so it belongs in the model's init
        // rather than being handed over on every `.task`.
        _model = State(initialValue: ProductDetailViewModel(productID: productID))
    }

    var body: some View {
        LoadableView(state: model.state) { product in
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
                        Task { await model.add(product) }
                    } label: {
                        if model.isAdding { ProgressView() } else { Text("Add to cart") }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!model.canAddToCart)

                    if let addMessage = model.addMessage {
                        Text(addMessage).font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Product")
        .task {
            model.bind(bd)
            await model.load()
        }
    }
}
