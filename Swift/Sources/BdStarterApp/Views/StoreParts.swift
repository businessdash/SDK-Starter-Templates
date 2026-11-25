import BusinessDashKit
import SwiftUI

// The store list's and the cart's parts. `StorefrontView` and `CartView` lay
// them out; each takes plain values and callbacks, so you can move, restyle,
// drop or replace any of them. The product card, save buttons and compare
// bar are in ShopParts.swift.

/// The sorts the store offers, as (value, label).
public enum StoreSort {
    public static let options: [(value: String, label: String)] = [
        ("featured", "Featured"),
        ("newest", "Newest"),
        ("price-asc", "Price: low to high"),
        ("price-desc", "Price: high to low"),
        ("rating-desc", "Top rated"),
    ]
}

/// All products, then a chip per category with its count; choosing the
/// chosen one again clears it.
public struct CategoryChips: View {
    public let categories: [StoreCategory]
    /// Products per category id.
    public let counts: [String: Int]
    public let selected: String?
    public let onSelect: (String?) -> Void

    public init(categories: [StoreCategory], counts: [String: Int], selected: String?, onSelect: @escaping (String?) -> Void) {
        self.categories = categories
        self.counts = counts
        self.selected = selected
        self.onSelect = onSelect
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("All products", count: nil, active: selected == nil) { onSelect(nil) }
                ForEach(categories) { category in
                    let active = selected == category.id
                    chip(category.name, count: counts[category.id] ?? 0, active: active) {
                        onSelect(active ? nil : category.id)
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
}

/// "12 products", Filters (with how many are set) and the sort.
public struct StoreResultsBar: View {
    public let count: Int
    /// Filters set in the sheet (price, rating).
    public let filterCount: Int
    @Binding public var sort: String
    public let onFilters: () -> Void

    public init(count: Int, filterCount: Int, sort: Binding<String>, onFilters: @escaping () -> Void) {
        self.count = count
        self.filterCount = filterCount
        _sort = sort
        self.onFilters = onFilters
    }

    public var body: some View {
        HStack {
            Text("\(count) \(count == 1 ? "product" : "products")")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Button(action: onFilters) {
                Label(filterCount == 0 ? "Filters" : "Filters (\(filterCount))", systemImage: "line.3.horizontal.decrease.circle")
            }
            SortMenu(sort: $sort)
        }
    }
}

/// The sort, as a menu.
public struct SortMenu: View {
    @Binding public var sort: String

    public init(sort: Binding<String>) {
        _sort = sort
    }

    public var body: some View {
        Menu {
            Picker("Sort", selection: $sort) {
                ForEach(StoreSort.options, id: \.value) { option in
                    Text(option.label).tag(option.value)
                }
            }
        } label: {
            Label("Sort", systemImage: "arrow.up.arrow.down")
        }
    }
}

/// Price and rating. The fields are copied in and applied together, so the
/// list doesn't reload on every keystroke of a price.
public struct StoreFiltersSheet: View {
    @Environment(\.dismiss) private var dismiss
    /// The catalogue's prices, in dollars, for the fields' placeholders.
    public let priceRange: PriceRange?
    public let onApply: (_ priceMin: String, _ priceMax: String, _ minRating: Int?) -> Void
    public let onClear: () -> Void

    @State private var priceMin: String
    @State private var priceMax: String
    @State private var minRating: Int?

    public init(
        priceMin: String,
        priceMax: String,
        minRating: Int?,
        priceRange: PriceRange?,
        onApply: @escaping (_ priceMin: String, _ priceMax: String, _ minRating: Int?) -> Void,
        onClear: @escaping () -> Void
    ) {
        _priceMin = State(initialValue: priceMin)
        _priceMax = State(initialValue: priceMax)
        _minRating = State(initialValue: minRating)
        self.priceRange = priceRange
        self.onApply = onApply
        self.onClear = onClear
    }

    public var body: some View {
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
                        onClear()
                        dismiss()
                    }
                }
            }
            .navigationTitle("Filters")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        onApply(priceMin, priceMax, minRating)
                        dismiss()
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    /// "$18" from the catalogue's range; the range is in dollars.
    private func placeholder(_ key: KeyPath<PriceRange, Double>, rounding: FloatingPointRoundingRule, fallback: String) -> String {
        guard let priceRange else { return fallback }
        return "$\(Int(priceRange[keyPath: key].rounded(rounding)))"
    }
}

/// A line in the cart: the product and option, the price each, and a stepper
/// for how many (0 removes it).
public struct CartLine: View {
    public let item: CartItem
    public let currency: String?
    @Binding public var quantity: Int

    public init(item: CartItem, currency: String?, quantity: Binding<Int>) {
        self.item = item
        self.currency = currency
        _quantity = quantity
    }

    public var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(item.title)
                // Cart lines arrive DECIMAL, unlike product prices. Two
                // helpers, on purpose.
                Text("\(Money.amount(item.unitPrice, currency: currency)) each")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Stepper("\(item.quantity)", value: $quantity, in: 0...99)
                .labelsHidden()
            Text("\(item.quantity)").monospacedDigit()
        }
    }
}

/// The subtotal and Checkout.
public struct CartSummary: View {
    public let subtotal: Double?
    public let currency: String?
    public let isCheckingOut: Bool
    public let onCheckout: () -> Void

    public init(subtotal: Double?, currency: String?, isCheckingOut: Bool, onCheckout: @escaping () -> Void) {
        self.subtotal = subtotal
        self.currency = currency
        self.isCheckingOut = isCheckingOut
        self.onCheckout = onCheckout
    }

    public var body: some View {
        LabeledContent("Subtotal", value: Money.amount(subtotal, currency: currency))

        Button(action: onCheckout) {
            if isCheckingOut { ProgressView() } else { Text("Checkout") }
        }
        .disabled(isCheckingOut)
    }
}
