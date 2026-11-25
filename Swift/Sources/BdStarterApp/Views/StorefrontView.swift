import BusinessDashKit
import SwiftUI

/// The store: search, category chips, the filter sheet (price, rating), a
/// sort, and the product grid. Each card saves to the wishlist or the compare
/// picks, and the compare bar along the bottom leads to the table.
///
/// It's laid out from parts: `ReviewStrip`, `CategoryChips`,
/// `StoreResultsBar`, `ProductCardView`, `SaveButtons`, `CompareBar` and
/// `StoreFiltersSheet` (StoreParts.swift, ShopParts.swift).
public struct StorefrontView: View {
    @Environment(BdEnvironment.self) private var bd
    @State private var model = StorefrontViewModel()
    @State private var showingFilters = false

    public init() {}

    public var body: some View {
        LoadableView(state: model.state) { listing in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let summary = model.reviewSummary {
                        ReviewStrip(summary: summary)
                    }
                    if !model.categories.isEmpty {
                        CategoryChips(
                            categories: model.categories,
                            counts: listing.counts,
                            selected: model.filters.categoryID
                        ) { model.filters.categoryID = $0 }
                    }
                    StoreResultsBar(
                        count: listing.products.count,
                        filterCount: filterCount,
                        sort: $model.filters.sort
                    ) { showingFilters = true }
                    if listing.products.isEmpty {
                        ContentUnavailableView(
                            model.filters.narrowed ? "No matches" : "No products yet",
                            systemImage: "bag",
                            description: Text(model.filters.narrowed
                                ? "No products match these filters. Try clearing a filter or broadening your search."
                                : "Add and publish products in the BD dashboard and they'll appear here.")
                        )
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 158), spacing: 14)], spacing: 18) {
                            ForEach(listing.products) { product in
                                NavigationLink {
                                    ProductDetailView(productID: product.id)
                                } label: {
                                    ProductCardView(product: product)
                                }
                                .buttonStyle(.plain)
                                .overlay(alignment: .topTrailing) {
                                    SaveButtons(product: SavedProduct(product), compact: true).padding(6)
                                }
                            }
                        }
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Shop")
        .searchable(text: $model.filters.search, prompt: "Search products")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                NavigationLink {
                    WishlistView()
                } label: {
                    Label("Wishlist (\(bd.saved.wishlist.items.count))", systemImage: "heart")
                }
            }
        }
        .safeAreaInset(edge: .bottom) { CompareBar() }
        .sheet(isPresented: $showingFilters) {
            StoreFiltersSheet(
                priceMin: model.filters.priceMin,
                priceMax: model.filters.priceMax,
                minRating: model.filters.minRating,
                priceRange: model.priceRange
            ) { priceMin, priceMax, minRating in
                model.filters.priceMin = priceMin
                model.filters.priceMax = priceMax
                model.filters.minRating = minRating
            } onClear: {
                model.clearFilters()
            }
        }
        // Any filter change cancels the load in flight and starts the next.
        .task(id: model.filters) {
            model.bind(bd)
            await model.load()
        }
    }

    /// Filters set in the sheet: price and rating.
    private var filterCount: Int {
        (model.filters.priceMin.isEmpty && model.filters.priceMax.isEmpty ? 0 : 1) + (model.filters.minRating == nil ? 0 : 1)
    }
}
