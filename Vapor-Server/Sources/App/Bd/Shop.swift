import Foundation

/// The product page's rules, the same as `shop.ts` in the other BD starters
/// (Public/shop/shop.js here, which the browser uses): shaping a product for
/// its page, which photos show for an option, what "from $40" means, and the
/// product as the saved lists keep it.
///
/// The page is drawn on the server as it opens (the first variant that can be
/// bought, nothing else chosen); `<bd-gallery>` and `<bd-product-form>` take
/// over from there in the browser.
///
/// Money: variants and options carry DOLLARS; product cards and saved
/// products carry integer CENTS.
enum Shop {
    struct Variant: Codable, Equatable {
        let id: String
        let name: String
        let price: Double?
        let stock: Double?
        let available: Bool
    }

    struct VariantImage: Codable, Equatable {
        let variantId: String
        let url: String
        let order: Double
    }

    struct OptionTitle: Codable, Equatable {
        let id: String
        let title: String
        let variantId: String?
    }

    struct OptionValue: Codable, Equatable {
        let id: String
        let titleId: String
        let value: String
        let price: Double
        let stock: Double?
        let available: Bool
    }

    /// One option group (Size, Colour…). `variantId` is the variant it belongs
    /// to (nil: every variant); `allOptionGroups` fills it in.
    struct OptionGroup: Codable, Equatable {
        let id: String
        let title: String
        let values: [OptionValue]
        var variantId: String?
    }

    struct SpecRow: Codable, Equatable {
        let label: String
        let value: String
    }

    struct SpecGroup: Codable, Equatable {
        let name: String
        let rows: [SpecRow]
    }

    struct ProductView: Codable, Equatable {
        let id: String
        let name: String
        let description: String
        let categoryId: String?
        let categoryName: String?
        let images: [String]
        let variants: [Variant]
        let variantImages: [VariantImage]
        let optionTitles: [OptionTitle]
        let optionValues: [OptionValue]
        let features: [String]
        let specs: [SpecGroup]
    }

    struct PhotoSet: Codable, Equatable {
        let variantId: String
        let photos: [String]
    }

    struct Price: Codable, Equatable {
        /// Dollars; nil when there is nothing to buy.
        let amount: Double?
        /// True while options are still being chosen: the lowest it can be.
        let from: Bool
        let stock: Double?
        /// Every option group has a choice and the choice can be bought.
        let ready: Bool
    }

    /// The product as the saved lists keep it. It goes to the browser as is,
    /// so every key is written, null when there's no value.
    struct SavedProduct: Codable, Equatable {
        let id: String
        let name: String
        let image: String?
        let priceCents: Int?

        func encode(to encoder: any Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(id, forKey: .id)
            try c.encode(name, forKey: .name)
            try c.encode(image, forKey: .image)
            try c.encode(priceCents, forKey: .priceCents)
        }
    }

    /// Shape a `storefront.getProduct` response for the product page.
    static func productView(_ product: JSONValue) -> ProductView {
        let category = product["category"].flatMap { value -> JSONValue? in
            if case .object = value { return value }
            return nil
        }
        let productImages = stableSorted(
            records(product["productImages"])
                .map { (url: text($0["url"]), order: num($0["order"]) ?? 0) }
                .filter { !$0.url.isEmpty },
            by: { $0.order < $1.order }
        ).map(\.url)
        let images = product["images"]?.arrayValue.map { $0.map(text).filter { !$0.isEmpty } } ?? []
        let (features, specs) = readSpecs(product["specifications"])

        return ProductView(
            id: text(product["id"]),
            name: text(product["name"]).nilIfEmpty ?? "Untitled",
            description: text(product["description"]),
            categoryId: text(product["categoryId"]).nilIfEmpty,
            categoryName: category.flatMap { text($0["name"]).nilIfEmpty },
            images: images.isEmpty ? productImages : images,
            variants: records(product["variants"]).map { variant in
                Variant(
                    id: text(variant["id"]),
                    name: text(variant["name"]).nilIfEmpty ?? "Default",
                    price: num(variant["price"]),
                    stock: num(variant["stock"]),
                    available: variant["isLive"]?.boolValue != false && num(variant["stock"]) != 0
                )
            },
            variantImages: records(product["variantImages"])
                .map { VariantImage(variantId: text($0["variantId"]), url: text($0["url"]), order: num($0["order"]) ?? 0) }
                .filter { !$0.url.isEmpty },
            optionTitles: records(product["crossVariantTitles"]).map {
                OptionTitle(id: text($0["id"]), title: text($0["title"]), variantId: text($0["variantId"]).nilIfEmpty)
            },
            optionValues: records(product["crossVariants"]).map { option in
                OptionValue(
                    id: text(option["id"]),
                    titleId: text(option["crossVariantTitleId"]),
                    value: text(option["value"]),
                    price: num(option["price"]) ?? 0,
                    stock: num(option["stock"]),
                    available: option["isLive"]?.boolValue != false && num(option["stock"]) != 0
                )
            },
            features: features,
            specs: specs
        )
    }

    /// The variant a page opens on: the first one that can be bought.
    static func defaultVariant(_ view: ProductView) -> Variant? {
        view.variants.first(where: \.available) ?? view.variants.first
    }

    /// The photos for a variant: its own when it has any, else the product's.
    static func galleryFor(_ view: ProductView, _ variantId: String) -> [String] {
        let own = stableSorted(view.variantImages.filter { $0.variantId == variantId }, by: { $0.order < $1.order })
            .map(\.url)
        return own.isEmpty ? view.images : own
    }

    /// The option groups (Size, Colour…) that apply to a variant.
    static func optionGroupsFor(_ view: ProductView, _ variantId: String) -> [OptionGroup] {
        view.optionTitles
            .filter { $0.variantId == nil || $0.variantId == variantId }
            .map { groupOf(view, $0) }
            .filter { !$0.values.isEmpty }
    }

    /// Every option group, with the variant it belongs to (nil: every
    /// variant). The page draws them all; `<bd-product-form>` shows the ones
    /// for the chosen variant.
    static func allOptionGroups(_ view: ProductView) -> [OptionGroup] {
        view.optionTitles
            .map { title -> OptionGroup in
                var group = groupOf(view, title)
                group.variantId = title.variantId
                return group
            }
            .filter { !$0.values.isEmpty }
    }

    /// The sets of photos the page draws: the product's (variant ""), then one
    /// per variant with photos of its own. `<bd-gallery>` shows the chosen
    /// variant's set, or the product's.
    static func photoSets(_ view: ProductView) -> [PhotoSet] {
        var seen = Set<String>()
        let own = view.variantImages.map(\.variantId).filter { !$0.isEmpty && seen.insert($0).inserted }
        return [PhotoSet(variantId: "", photos: view.images)]
            + own.map { PhotoSet(variantId: $0, photos: galleryFor(view, $0)) }
    }

    /// The price shown for a variant and the options chosen so far (`chosen`
    /// maps an option group's id to an option value's id).
    static func priceFor(_ view: ProductView, _ variantId: String, _ chosen: [String: String] = [:]) -> Price {
        guard let variant = view.variants.first(where: { $0.id == variantId }), variant.available else {
            return Price(amount: nil, from: false, stock: 0, ready: false)
        }
        let groups = optionGroupsFor(view, variantId)
        if groups.isEmpty {
            return Price(amount: variant.price, from: false, stock: variant.stock, ready: true)
        }
        let picks = groups.map { group in group.values.first { $0.id == chosen[group.id] } }
        if picks.contains(where: { $0 == nil }) {
            let lowest = groups.map { group -> Double in
                group.values.filter(\.available).map(\.price).min() ?? 0
            }
            return Price(amount: lowest.reduce(0, +), from: true, stock: nil, ready: false)
        }
        let picked = picks.compactMap { $0 }
        if picked.contains(where: { !$0.available }) {
            return Price(amount: nil, from: false, stock: 0, ready: false)
        }
        let stocks = picked.compactMap(\.stock)
        return Price(amount: picked.map(\.price).reduce(0, +), from: false, stock: stocks.min(), ready: true)
    }

    /// The product as the saved lists keep it, priced for what's chosen.
    static func productSummary(_ view: ProductView, _ variantId: String, _ chosen: [String: String] = [:]) -> SavedProduct {
        let start = priceFor(view, variantId, chosen).amount ?? view.variants.first?.price
        return SavedProduct(
            id: view.id,
            name: view.name,
            image: view.images.first,
            priceCents: start.map { Int(($0 * 100).rounded()) }
        )
    }

    /// The variant an add-on is added as: its first.
    static func addonVariant(_ addon: JSONValue) -> String? {
        guard let first = addon["variants"]?.arrayValue?.first else { return nil }
        return first["variantId"]?.stringValue ?? first["id"]?.stringValue
    }

    /// A review's date, as "Mar 4, 2026".
    static func reviewDate(_ iso: String?) -> String {
        guard let iso, !iso.isEmpty else { return "" }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = withFraction.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "MMM d, yyyy"
        return formatter.string(from: date)
    }

    private static let sizeOrder = ["XXS", "2XS", "XS", "S", "SM", "M", "MD", "L", "LG", "XL", "2XL", "XXL", "3XL", "4XL"]

    /// One option group's choices, sizes in size order.
    private static func groupOf(_ view: ProductView, _ title: OptionTitle) -> OptionGroup {
        var values = view.optionValues.filter { $0.titleId == title.id }
        if title.title.range(of: "^sizes?$", options: [.regularExpression, .caseInsensitive]) != nil {
            let rank = { (value: String) in sizeOrder.firstIndex(of: value.uppercased()) ?? sizeOrder.count }
            values = stableSorted(values, by: { rank($0.value) < rank($1.value) })
        }
        return OptionGroup(id: title.id, title: title.title, values: values, variantId: nil)
    }

    /// The specifications column (`{ features, groups: [{ name, rows }] }`).
    private static func readSpecs(_ raw: JSONValue?) -> ([String], [SpecGroup]) {
        let features = raw?["features"]?.arrayValue.map { $0.map(text).filter { !$0.isEmpty } } ?? []
        let specs = records(raw?["groups"])
            .map { group in
                SpecGroup(
                    name: text(group["name"]),
                    rows: records(group["rows"])
                        .map { SpecRow(label: text($0["label"]), value: text($0["value"])) }
                        .filter { !$0.label.isEmpty && !$0.value.isEmpty }
                )
            }
            .filter { !$0.name.isEmpty && !$0.rows.isEmpty }
        return (features, specs)
    }

    /// Sorted, keeping the order of equal elements (as JavaScript's sort does).
    private static func stableSorted<T>(_ items: [T], by less: (T, T) -> Bool) -> [T] {
        items.enumerated()
            .sorted { a, b in less(a.element, b.element) || (!less(b.element, a.element) && a.offset < b.offset) }
            .map(\.element)
    }

    private static func text(_ value: JSONValue?) -> String {
        value?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    private static func num(_ value: JSONValue?) -> Double? {
        if case .number(let n)? = value, n.isFinite { return n }
        return nil
    }

    private static func records(_ value: JSONValue?) -> [JSONValue] {
        (value?.arrayValue ?? []).filter { if case .object = $0 { return true } else { return false } }
    }
}
