import BusinessDashKit
import SwiftUI

/// The store: search, category chips, the filter sheet (price, rating), a
/// sort, and the product grid. Each card saves to the wishlist or the compare
/// picks, and the compare bar along the bottom leads to the table.
struct StorefrontView: View {
    @Environment(BdEnvironment.self) private var bd
    @State private var model = StorefrontViewModel()
    @State private var showingFilters = false

    var body: some View {
        LoadableView(state: model.state) { listing in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let summary = model.reviewSummary {
                        ReviewStrip(summary: summary)
                    }
                    if !model.categories.isEmpty {
                        categoryChips(listing)
                    }
                    resultsBar(listing)
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
            FiltersSheet(model: model)
        }
        // Any filter change cancels the load in flight and starts the next.
        .task(id: model.filters) {
            model.bind(bd)
            await model.load()
        }
    }

    private func categoryChips(_ listing: StorefrontViewModel.Listing) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("All products", count: nil, active: model.filters.categoryID == nil) {
                    model.filters.categoryID = nil
                }
                ForEach(model.categories) { category in
                    let active = model.filters.categoryID == category.id
                    chip(category.name, count: listing.counts[category.id] ?? 0, active: active) {
                        model.filters.categoryID = active ? nil : category.id
                    }
                }
            }
        }
    }

    private func chip(_ title: String, count: Int?, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(title)
                if let count { Text("\(count)").foregroundStyle(.secondary) }
            }
            .font(.subheadline)
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
        .tint(active ? .accentColor : .secondary)
    }

    private func resultsBar(_ listing: StorefrontViewModel.Listing) -> some View {
        HStack {
            Text("\(listing.products.count) \(listing.products.count == 1 ? "product" : "products")")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Button {
                showingFilters = true
            } label: {
                Label(filterCount == 0 ? "Filters" : "Filters (\(filterCount))", systemImage: "line.3.horizontal.decrease.circle")
            }
            Menu {
                Picker("Sort", selection: $model.filters.sort) {
                    ForEach(StorefrontViewModel.sorts, id: \.value) { sort in
                        Text(sort.label).tag(sort.value)
                    }
                }
            } label: {
                Label("Sort", systemImage: "arrow.up.arrow.down")
            }
        }
    }

    /// Filters set in the sheet: price and rating.
    private var filterCount: Int {
        (model.filters.priceMin.isEmpty && model.filters.priceMax.isEmpty ? 0 : 1) + (model.filters.minRating == nil ? 0 : 1)
    }
}

/// Price and rating. The fields are copied in and applied together, so the
/// list doesn't reload on every keystroke of a price.
private struct FiltersSheet: View {
    @Environment(\.dismiss) private var dismiss
    let model: StorefrontViewModel

    @State private var priceMin = ""
    @State private var priceMax = ""
    @State private var minRating: Int?

    var body: some View {
        NavigationStack {
            Form {
                Section("Price") {
                    HStack {
                        TextField(placeholder(\.minDollars, rounding: .down, fallback: "Min"), text: $priceMin)
                            .accessibilityLabel("Lowest price")
                        Text("–").foregroundStyle(.secondary)
                        TextField(placeholder(\.maxDollars, rounding: .up, fallback: "Max"), text: $priceMax)
                            .accessibilityLabel("Highest price")
                    }
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                }
                Section("Rating") {
                    Picker("Rating", selection: $minRating) {
                        Text("Any").tag(Int?.none)
                        ForEach([4, 3, 2], id: \.self) { stars in
                            Text("\(stars) stars & up").tag(Int?.some(stars))
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
                Section {
                    Button("Clear all filters", role: .destructive) {
                        model.clearFilters()
                        dismiss()
                    }
                }
            }
            .navigationTitle("Filters")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        model.filters.priceMin = priceMin
                        model.filters.priceMax = priceMax
                        model.filters.minRating = minRating
                        dismiss()
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .onAppear {
            priceMin = model.filters.priceMin
            priceMax = model.filters.priceMax
            minRating = model.filters.minRating
        }
    }

    /// "$18" from the catalogue's range; the range is in dollars.
    private func placeholder(_ key: KeyPath<PriceRange, Double>, rounding: FloatingPointRoundingRule, fallback: String) -> String {
        guard case .loaded(let listing) = model.state, let range = listing.priceRange else { return fallback }
        return "$\(Int(range[keyPath: key].rounded(rounding)))"
    }
}
