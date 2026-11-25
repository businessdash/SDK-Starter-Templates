import BusinessDashKit
import SwiftUI

/// One product: photos for the chosen option, option and size buttons, the
/// price for what's chosen, quantity, add to cart, save, compare and share;
/// then details, add-ons, reviews, related products and what was viewed
/// before.
///
/// It's laid out from the parts in ProductParts.swift (`ProductGallery`,
/// `ProductTitle`, `ProductPriceLabel`, `VariantPicker`, `OptionPicker`,
/// `StockNote`, `QuantityStepper`, `AddToCartButton`, `CartNotice`,
/// `SaveButtons`, `ProductPolicies`, `ProductDetails`, `ProductAddons`,
/// `ProductReviews`, `ProductRail`). Rearrange them here, or lay out a page
/// of your own from them.
public struct ProductDetailView: View {
    public let productID: String

    @Environment(BdEnvironment.self) private var bd
    @State private var model: ProductDetailViewModel

    public init(productID: String) {
        self.productID = productID
        // The id is known at construction, so it belongs in the model's init
        // rather than being handed over on every `.task`.
        _model = State(initialValue: ProductDetailViewModel(productID: productID))
    }

    public var body: some View {
        LoadableView(state: model.state) { view in
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 16) {
                        ProductGallery(urls: view.gallery(for: model.variantID))
                        header(view)
                        choices(view)
                        buy(view)
                    }
                    ProductDetails(view)
                    ProductAddons(
                        addons: model.addons,
                        added: model.addedAddons,
                        adding: model.addingAddon,
                        enabled: bd.cart != nil
                    ) { addon in
                        Task { await model.add(addon) }
                    }
                    ProductReviews(reviews: model.reviews, hasMore: model.hasMoreReviews) {
                        Task { await model.moreReviews() }
                    }
                    ProductRail(title: "You may also like", products: model.related)
                    ProductRail(title: "Recently viewed", products: model.recent)
                }
                .padding()
            }
            .navigationTitle(view.name)
            // The page shows the name large already.
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                if let site = bd.configuration?.siteURL {
                    ToolbarItem(placement: .primaryAction) {
                        ShareLink(item: site.appending(path: "store/\(view.id)")) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                    }
                }
            }
        }
        .task {
            model.bind(bd)
            await model.load()
        }
    }

    // MARK: Top of the page

    private func header(_ view: ProductView) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ProductTitle(
                category: view.categoryName,
                name: view.name,
                rating: model.reviews?.avgRating ?? 0,
                reviewCount: model.reviews?.totalCount ?? 0
            )
            ProductPriceLabel(price: view.price(variantID: model.variantID, chosen: model.chosen), quantity: model.quantity)
        }
    }

    @ViewBuilder private func choices(_ view: ProductView) -> some View {
        let groups = view.optionGroups(for: model.variantID)
        VariantPicker(variants: view.variants, selected: model.variantID, showPrices: groups.isEmpty) { id in
            model.select(variant: id)
        }
        ForEach(groups) { group in
            OptionPicker(group: group, chosen: model.chosen[group.id]) { value in
                model.choose(value, in: group)
            }
        }
    }

    @ViewBuilder private func buy(_ view: ProductView) -> some View {
        @Bindable var model = model
        let price = view.price(variantID: model.variantID, chosen: model.chosen)
        VStack(alignment: .leading, spacing: 12) {
            StockNote(stock: price.stock)
            HStack(spacing: 12) {
                QuantityStepper(quantity: $model.quantity, stock: price.stock)
                AddToCartButton(price: price, isAdding: model.isAdding, enabled: bd.cart != nil) {
                    Task { await model.add(view) }
                }
            }
            if let message = model.message {
                CartNotice(text: message.text, ok: message.ok) { bd.tab = .cart }
            }
            SaveButtons(product: model.summary(view))
            ProductPolicies { bd.tab = .chat }
        }
    }
}
