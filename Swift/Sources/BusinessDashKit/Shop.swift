import Foundation

// The product page's rules: which photos show for a variant, which option
// groups (Size, Colour…) apply, what "from $40" means, and what goes in the
// cart line. The same rules as `shop.ts` in the web starters, so a product
// behaves the same in the app and on the site.
//
// Money: product cards carry integer CENTS (`cheapestPriceCents`); variants,
// options and cart lines carry DOLLARS. Each value below says which.

public struct ProductVariant: Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String
    /// Dollars.
    public let price: Double?
    /// nil: not tracked.
    public let stock: Int?
    public let available: Bool
}

public struct OptionValue: Sendable, Identifiable, Equatable {
    public let id: String
    public let titleID: String
    public let value: String
    /// Dollars, added to the option total.
    public let price: Double
    public let stock: Int?
    public let available: Bool
}

public struct OptionGroup: Sendable, Identifiable, Equatable {
    public let id: String
    public let title: String
    public let values: [OptionValue]
}

public struct SpecGroup: Sendable, Equatable {
    public struct Row: Sendable, Equatable {
        public let label: String
        public let value: String
    }
    public let name: String
    public let rows: [Row]
}

/// The price shown for a variant and the options chosen so far.
public struct ProductPrice: Sendable, Equatable {
    /// Dollars; nil when there is nothing to buy.
    public let amount: Double?
    /// True while options are still being chosen: the lowest it can be.
    public let from: Bool
    public let stock: Int?
    /// Every option group has a choice and the choice can be bought.
    public let ready: Bool
}

/// A `storefront/products/{id}` response, read leniently: every field is
/// checked before use, so a column added or left empty doesn't break the page.
public struct ProductView: Sendable, Equatable {
    public let id: String
    public let name: String
    public let description: String
    public let categoryID: String?
    public let categoryName: String?
    public let images: [String]
    public let variants: [ProductVariant]
    public let features: [String]
    public let specs: [SpecGroup]

    struct VariantImage: Sendable, Equatable {
        let variantID: String
        let url: String
        let order: Double
    }
    struct OptionTitle: Sendable, Equatable {
        let id: String
        let title: String
        let variantID: String?
    }
    let variantImages: [VariantImage]
    let optionTitles: [OptionTitle]
    let optionValues: [OptionValue]

    public init(_ raw: JSONValue) {
        func text(_ value: JSONValue?) -> String {
            (value?.stringValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        func number(_ value: JSONValue?) -> Double? {
            guard let n = value?.doubleValue, n.isFinite else { return nil }
            return n
        }
        func records(_ value: JSONValue?) -> [JSONValue] {
            (value?.arrayValue ?? []).filter { $0.objectValue != nil }
        }
        /// `isLive: false` or no stock left is not available; missing means live.
        func available(_ item: JSONValue) -> Bool {
            item["isLive"]?.boolValue != false && number(item["stock"]) != 0
        }

        let productImages = records(raw["productImages"])
            .map { (url: text($0["url"]), order: number($0["order"]) ?? 0) }
            .filter { !$0.url.isEmpty }
            .sorted { $0.order < $1.order }
            .map(\.url)
        let images = (raw["images"]?.arrayValue ?? []).map { text($0) }.filter { !$0.isEmpty }

        id = text(raw["id"])
        name = text(raw["name"]).isEmpty ? "Untitled" : text(raw["name"])
        description = text(raw["description"])
        categoryID = text(raw["categoryId"]).isEmpty ? nil : text(raw["categoryId"])
        categoryName = text(raw["category", "name"]).isEmpty ? nil : text(raw["category", "name"])
        self.images = images.isEmpty ? productImages : images
        variants = records(raw["variants"]).map { variant in
            ProductVariant(
                id: text(variant["id"]),
                name: text(variant["name"]).isEmpty ? "Default" : text(variant["name"]),
                price: number(variant["price"]),
                stock: number(variant["stock"]).map { Int($0) },
                available: available(variant)
            )
        }
        variantImages = records(raw["variantImages"])
            .map { VariantImage(variantID: text($0["variantId"]), url: text($0["url"]), order: number($0["order"]) ?? 0) }
            .filter { !$0.url.isEmpty }
        optionTitles = records(raw["crossVariantTitles"]).map { title in
            OptionTitle(
                id: text(title["id"]),
                title: text(title["title"]),
                variantID: text(title["variantId"]).isEmpty ? nil : text(title["variantId"])
            )
        }
        optionValues = records(raw["crossVariants"]).map { option in
            OptionValue(
                id: text(option["id"]),
                titleID: text(option["crossVariantTitleId"]),
                value: text(option["value"]),
                price: number(option["price"]) ?? 0,
                stock: number(option["stock"]).map { Int($0) },
                available: available(option)
            )
        }

        // The specifications column: `{ features, groups: [{ name, rows }] }`.
        let specifications = raw["specifications"]
        features = (specifications?["features"]?.arrayValue ?? []).map { text($0) }.filter { !$0.isEmpty }
        specs = records(specifications?["groups"])
            .map { group in
                SpecGroup(
                    name: text(group["name"]),
                    rows: records(group["rows"])
                        .map { SpecGroup.Row(label: text($0["label"]), value: text($0["value"])) }
                        .filter { !$0.label.isEmpty && !$0.value.isEmpty }
                )
            }
            .filter { !$0.name.isEmpty && !$0.rows.isEmpty }
    }

    /// The variant a page opens on: the first one that can be bought.
    public var defaultVariant: ProductVariant? {
        variants.first(where: \.available) ?? variants.first
    }

    /// The photos for a variant: its own when it has any, else the product's.
    public func gallery(for variantID: String) -> [String] {
        let own = variantImages
            .filter { $0.variantID == variantID }
            .sorted { $0.order < $1.order }
            .map(\.url)
        return own.isEmpty ? images : own
    }

    private static let sizeOrder = ["XXS", "2XS", "XS", "S", "SM", "M", "MD", "L", "LG", "XL", "2XL", "XXL", "3XL", "4XL"]

    /// The option groups that apply to a variant. Sizes go smallest first.
    public func optionGroups(for variantID: String) -> [OptionGroup] {
        optionTitles
            .filter { $0.variantID == nil || $0.variantID == variantID }
            .map { title in
                var values = optionValues.filter { $0.titleID == title.id }
                let lower = title.title.lowercased()
                if lower == "size" || lower == "sizes" {
                    func rank(_ value: String) -> Int {
                        Self.sizeOrder.firstIndex(of: value.uppercased()) ?? Self.sizeOrder.count
                    }
                    // Stable, as Array.sort is in JavaScript.
                    values = values.enumerated()
                        .sorted { (rank($0.element.value), $0.offset) < (rank($1.element.value), $1.offset) }
                        .map(\.element)
                }
                return OptionGroup(id: title.id, title: title.title, values: values)
            }
            .filter { !$0.values.isEmpty }
    }

    /// The price for a variant and the picks so far (`chosen` maps an option
    /// group's id to an option value's id).
    public func price(variantID: String, chosen: [String: String]) -> ProductPrice {
        guard let variant = variants.first(where: { $0.id == variantID }), variant.available else {
            return ProductPrice(amount: nil, from: false, stock: 0, ready: false)
        }
        let groups = optionGroups(for: variantID)
        if groups.isEmpty {
            return ProductPrice(amount: variant.price, from: false, stock: variant.stock, ready: true)
        }
        let picks = groups.map { group in group.values.first { $0.id == chosen[group.id] } }
        if picks.contains(where: { $0 == nil }) {
            let lowest = groups.map { group in
                group.values.filter(\.available).map(\.price).min() ?? 0
            }
            return ProductPrice(amount: lowest.reduce(0, +), from: true, stock: nil, ready: false)
        }
        let chosenValues = picks.compactMap(\.self)
        if chosenValues.contains(where: { !$0.available }) {
            return ProductPrice(amount: nil, from: false, stock: 0, ready: false)
        }
        return ProductPrice(
            amount: chosenValues.reduce(0) { $0 + $1.price },
            from: false,
            stock: chosenValues.compactMap(\.stock).min(),
            ready: true
        )
    }

    /// The picks as the cart line's `options` (`["Size": "M"]`), or nil.
    public func chosenOptions(variantID: String, chosen: [String: String]) -> [String: String]? {
        var out: [String: String] = [:]
        for group in optionGroups(for: variantID) {
            if let value = group.values.first(where: { $0.id == chosen[group.id] }) {
                out[group.title] = value.value
            }
        }
        return out.isEmpty ? nil : out
    }
}
