import BusinessDashKit
import SwiftUI

// The product page's parts. `ProductDetailView` lays them out; each takes
// plain values and callbacks, so you can move, restyle, drop or replace any
// of them, or lay out a product page of your own:
//
//     ProductGallery(urls: view.gallery(for: variantID))
//     ProductTitle(category: view.categoryName, name: view.name, rating: 4.6, reviewCount: 12)
//     ProductPriceLabel(price: view.price(variantID: variantID, chosen: chosen), quantity: 1)
//     VariantPicker(variants: view.variants, selected: variantID, showPrices: true) { variantID = $0 }
//
// The rules (which photos, what "from" means, what can be bought) are
// `ProductView`'s, in BusinessDashKit.

/// The photos for the chosen option, swiped sideways a page at a time.
public struct ProductGallery: View {
    public let urls: [String]
    public var height: CGFloat

    public init(urls: [String], height: CGFloat = 280) {
        self.urls = urls
        self.height = height
    }

    public var body: some View {
        if urls.isEmpty {
            RemoteImage(url: nil).frame(height: height).clipShape(RoundedRectangle(cornerRadius: 14))
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 0) {
                    ForEach(urls, id: \.self) { url in
                        RemoteImage(url: url, contentMode: .fit)
                            .containerRelativeFrame(.horizontal)
                            .frame(height: height)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .frame(height: height)
            .background(Color.secondary.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            // A new option shows its own photos from the first.
            .id(urls)
        }
    }
}

/// The category, the name, and the stars with the number of reviews.
public struct ProductTitle: View {
    public let category: String?
    public let name: String
    public let rating: Double
    public let reviewCount: Int

    public init(category: String?, name: String, rating: Double = 0, reviewCount: Int = 0) {
        self.category = category
        self.name = name
        self.rating = rating
        self.reviewCount = reviewCount
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let category {
                Text(category.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            }
            Text(name).font(.title2.bold())
            if reviewCount > 0 {
                HStack(spacing: 6) {
                    StarRating(rating: rating)
                    Text(String(format: "%.1f · %d reviews", rating, reviewCount))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// The price for what's chosen times the quantity: "From" until every option
/// is picked, the price each when buying more than one, Sold out when there's
/// none.
public struct ProductPriceLabel: View {
    public let price: ProductPrice
    public let quantity: Int

    public init(price: ProductPrice, quantity: Int = 1) {
        self.price = price
        self.quantity = quantity
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            if let amount = price.amount {
                if price.from { Text("From").font(.subheadline).foregroundStyle(.secondary) }
                // Variants and options are in DOLLARS, unlike cards.
                Text(Money.amount(amount * Double(quantity)))
                    .font(.title3.bold().monospacedDigit())
                if quantity > 1 {
                    Text("(\(Money.amount(amount)) each)").font(.caption).foregroundStyle(.secondary)
                }
            } else {
                Text("Sold out").font(.title3.bold()).foregroundStyle(.secondary)
            }
        }
    }
}

/// A button per variant (Cloud, Storm…), the chosen one marked; sold-out ones
/// can't be chosen. Nothing shows for a product with one variant.
public struct VariantPicker: View {
    public let variants: [ProductVariant]
    public let selected: String
    /// Show each variant's price on its button; the page does while the
    /// chosen variant has no options of its own.
    public let showPrices: Bool
    public let onSelect: (String) -> Void

    public init(variants: [ProductVariant], selected: String, showPrices: Bool, onSelect: @escaping (String) -> Void) {
        self.variants = variants
        self.selected = selected
        self.showPrices = showPrices
        self.onSelect = onSelect
    }

    public var body: some View {
        if variants.count > 1 {
            VStack(alignment: .leading, spacing: 8) {
                Text("Option").font(.subheadline.weight(.semibold))
                FlowLayout {
                    ForEach(variants) { variant in
                        ChoiceButton(
                            title: variant.price != nil && showPrices
                                ? "\(variant.name) \(Money.amount(variant.price))"
                                : variant.name,
                            on: variant.id == selected,
                            available: variant.available
                        ) { onSelect(variant.id) }
                    }
                }
            }
        }
    }
}

/// One option group (Size, Colour…): a button per value, the chosen value
/// named beside the title.
public struct OptionPicker: View {
    public let group: OptionGroup
    /// The chosen value's id.
    public let chosen: String?
    public let onChoose: (OptionValue) -> Void

    public init(group: OptionGroup, chosen: String?, onChoose: @escaping (OptionValue) -> Void) {
        self.group = group
        self.chosen = chosen
        self.onChoose = onChoose
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Text(group.title).font(.subheadline.weight(.semibold))
                Text(group.values.first { $0.id == chosen }?.value ?? "")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            FlowLayout {
                ForEach(group.values) { value in
                    ChoiceButton(title: value.value, on: chosen == value.id, available: value.available) {
                        onChoose(value)
                    }
                }
            }
        }
    }
}

/// An option or size button. A sold-out one is struck through and can't be
/// chosen.
public struct ChoiceButton: View {
    public let title: String
    public let on: Bool
    public let available: Bool
    public let action: () -> Void

    public init(title: String, on: Bool, available: Bool = true, action: @escaping () -> Void) {
        self.title = title
        self.on = on
        self.available = available
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Text(title)
                .strikethrough(!available)
                .font(.subheadline)
                .padding(.horizontal, 4)
        }
        .buttonStyle(.bordered)
        .tint(on ? .accentColor : .secondary)
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(on ? Color.accentColor : .clear, lineWidth: 1.5))
        .disabled(!available)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// "Only 3 left", at five or fewer.
public struct StockNote: View {
    public let stock: Int?

    public init(stock: Int?) {
        self.stock = stock
    }

    public var body: some View {
        if let stock, stock > 0, stock <= 5 {
            Text("Only \(stock) left").font(.footnote.weight(.semibold)).foregroundStyle(.orange)
        }
    }
}

/// − and + around how many to add, from 1 up to what's in stock (99 at most).
public struct QuantityStepper: View {
    @Binding public var quantity: Int
    /// What's in stock; nil when it isn't tracked.
    public let stock: Int?

    public init(quantity: Binding<Int>, stock: Int?) {
        _quantity = quantity
        self.stock = stock
    }

    public var body: some View {
        Stepper("Quantity \(quantity)", value: $quantity, in: 1...max(1, min(99, stock ?? 99)))
            .fixedSize()
    }
}

/// Add to cart; "Choose options" until every option is picked, Sold out when
/// there's none.
public struct AddToCartButton: View {
    public let price: ProductPrice
    public let isAdding: Bool
    /// False when there's no cart to add to (the store isn't connected).
    public let enabled: Bool
    public let action: () -> Void

    public init(price: ProductPrice, isAdding: Bool, enabled: Bool = true, action: @escaping () -> Void) {
        self.price = price
        self.isAdding = isAdding
        self.enabled = enabled
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Text(price.amount == nil ? "Sold out" : !price.ready ? "Choose options" : isAdding ? "Adding…" : "Add to cart")
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(isAdding || !price.ready || !enabled)
    }
}

/// After adding: "Added 2 to your cart." with View cart, or what went wrong.
public struct CartNotice: View {
    public let text: String
    public let ok: Bool
    public let onViewCart: () -> Void

    public init(text: String, ok: Bool, onViewCart: @escaping () -> Void) {
        self.text = text
        self.ok = ok
        self.onViewCart = onViewCart
    }

    public var body: some View {
        HStack {
            Text(text)
                .font(.footnote)
                .foregroundStyle(ok ? Color.secondary : Color.red)
            if ok {
                Button("View cart", action: onViewCart).buttonStyle(.bordered).controlSize(.small)
            }
        }
    }
}

/// Secure checkout, and a way to ask before buying.
public struct ProductPolicies: View {
    public let onAsk: () -> Void

    public init(onAsk: @escaping () -> Void) {
        self.onAsk = onAsk
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Secure checkout with Stripe", systemImage: "lock")
            HStack(spacing: 4) {
                Text("Questions?")
                Button("Ask us", action: onAsk)
                    .buttonStyle(.borderless)
                    .foregroundStyle(Color.accentColor)
                Text("before you buy")
            }
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
}

/// Details: the description, the feature list, then each group of specs.
public struct ProductDetails: View {
    public let description: String
    public let features: [String]
    public let specs: [SpecGroup]

    public init(description: String, features: [String], specs: [SpecGroup]) {
        self.description = description
        self.features = features
        self.specs = specs
    }

    public init(_ view: ProductView) {
        self.init(description: view.description, features: view.features, specs: view.specs)
    }

    public var body: some View {
        if !description.isEmpty || !features.isEmpty || !specs.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Details").font(.title3.bold())
                if !description.isEmpty { Text(description) }
                if !features.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(features, id: \.self) { feature in
                            Label(feature, systemImage: "checkmark").font(.subheadline)
                        }
                    }
                }
                ForEach(specs, id: \.name) { group in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(group.name).font(.subheadline.weight(.semibold))
                        ForEach(group.rows, id: \.label) { row in
                            LabeledContent(row.label, value: row.value).font(.subheadline)
                        }
                    }
                }
            }
        }
    }
}

/// "Complete your purchase": the add-ons, each with Add.
public struct ProductAddons: View {
    public let addons: [StoreAddon]
    /// The ids of the add-ons already added.
    public let added: Set<String>
    /// The id of the add-on being added.
    public let adding: String?
    /// False when there's no cart to add to.
    public let enabled: Bool
    public let onAdd: (StoreAddon) -> Void

    public init(
        addons: [StoreAddon],
        added: Set<String> = [],
        adding: String? = nil,
        enabled: Bool = true,
        onAdd: @escaping (StoreAddon) -> Void
    ) {
        self.addons = addons
        self.added = added
        self.adding = adding
        self.enabled = enabled
        self.onAdd = onAdd
    }

    public var body: some View {
        if !addons.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Complete your purchase").font(.title3.bold())
                ForEach(addons) { addon in
                    AddonRow(
                        addon: addon,
                        added: added.contains(addon.id),
                        adding: adding == addon.id,
                        enabled: enabled
                    ) { onAdd(addon) }
                }
            }
        }
    }
}

/// One add-on: photo, group, name, price and Add.
public struct AddonRow: View {
    public let addon: StoreAddon
    public let added: Bool
    public let adding: Bool
    public let enabled: Bool
    public let onAdd: () -> Void

    public init(addon: StoreAddon, added: Bool, adding: Bool, enabled: Bool = true, onAdd: @escaping () -> Void) {
        self.addon = addon
        self.added = added
        self.adding = adding
        self.enabled = enabled
        self.onAdd = onAdd
    }

    public var body: some View {
        HStack(spacing: 12) {
            RemoteImage(url: addon.imageUrl)
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                if let group = addon.groupLabel { Text(group).font(.caption2).foregroundStyle(.secondary) }
                Text(addon.addonName).font(.subheadline.weight(.semibold))
                if let cents = addon.priceCents { Text(Money.cents(cents)).font(.caption.monospacedDigit()) }
            }
            Spacer()
            Button(added ? "Added" : adding ? "…" : "Add", action: onAdd)
                .buttonStyle(.bordered)
                .disabled(added || adding || !enabled)
        }
    }
}

/// The product's reviews: the average, each review, and Show more reviews.
public struct ProductReviews: View {
    public let reviews: ProductReviewPage?
    public let hasMore: Bool
    public let onMore: () -> Void

    public init(reviews: ProductReviewPage?, hasMore: Bool = false, onMore: @escaping () -> Void = {}) {
        self.reviews = reviews
        self.hasMore = hasMore
        self.onMore = onMore
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Reviews").font(.title3.bold())
            if let reviews, !reviews.items.isEmpty {
                HStack(spacing: 8) {
                    StarRating(rating: reviews.avgRating, size: 14)
                    Text(String(format: "%.1f out of 5", reviews.avgRating)).font(.subheadline.bold())
                    Text("from \(reviews.totalCount) reviews").font(.subheadline).foregroundStyle(.secondary)
                }
                ForEach(reviews.items) { review in
                    ProductReviewRow(review: review)
                    Divider()
                }
                if hasMore {
                    Button("Show more reviews", action: onMore)
                        .buttonStyle(.bordered)
                }
            } else {
                Text("No reviews yet.").foregroundStyle(.secondary)
            }
        }
    }
}

/// One review of the product: stars, name, date, title and words.
public struct ProductReviewRow: View {
    public let review: ProductReview

    public init(review: ProductReview) {
        self.review = review
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                StarRating(rating: review.rating, size: 10)
                Text(review.reviewerName?.isEmpty == false ? review.reviewerName! : "Verified buyer")
                    .font(.caption.weight(.semibold))
                Text(PostHtml.date(review.createdAt)).font(.caption).foregroundStyle(.secondary)
            }
            if let title = review.title, !title.isEmpty { Text(title).font(.subheadline.weight(.semibold)) }
            if let text = review.text { Text(text).font(.subheadline) }
        }
        .padding(.vertical, 4)
    }
}
