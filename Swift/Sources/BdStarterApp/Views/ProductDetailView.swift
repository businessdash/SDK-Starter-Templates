import BusinessDashKit
import SwiftUI

/// One product: photos for the chosen option, option and size buttons, the
/// price for what's chosen, quantity, add to cart, save, compare and share;
/// then details, add-ons, reviews, related products and what was viewed
/// before.
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
        LoadableView(state: model.state) { view in
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 16) {
                        Gallery(urls: view.gallery(for: model.variantID))
                        header(view)
                        choices(view)
                        buy(view)
                    }
                    details(view)
                    addonsSection
                    reviewsSection
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

    @ViewBuilder private func header(_ view: ProductView) -> some View {
        let price = view.price(variantID: model.variantID, chosen: model.chosen)
        VStack(alignment: .leading, spacing: 6) {
            if let category = view.categoryName {
                Text(category.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            }
            Text(view.name).font(.title2.bold())
            if let reviews = model.reviews, reviews.totalCount > 0 {
                HStack(spacing: 6) {
                    StarRating(rating: reviews.avgRating)
                    Text(String(format: "%.1f · %d reviews", reviews.avgRating, reviews.totalCount))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                if let amount = price.amount {
                    if price.from { Text("From").font(.subheadline).foregroundStyle(.secondary) }
                    // Variants and options are in DOLLARS, unlike cards.
                    Text(Money.amount(amount * Double(model.quantity)))
                        .font(.title3.bold().monospacedDigit())
                    if model.quantity > 1 {
                        Text("(\(Money.amount(amount)) each)").font(.caption).foregroundStyle(.secondary)
                    }
                } else {
                    Text("Sold out").font(.title3.bold()).foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder private func choices(_ view: ProductView) -> some View {
        let groups = view.optionGroups(for: model.variantID)
        if view.variants.count > 1 {
            VStack(alignment: .leading, spacing: 8) {
                Text("Option").font(.subheadline.weight(.semibold))
                FlowLayout {
                    ForEach(view.variants) { variant in
                        ChoiceButton(
                            title: variant.price != nil && groups.isEmpty
                                ? "\(variant.name) \(Money.amount(variant.price))"
                                : variant.name,
                            on: variant.id == model.variantID,
                            available: variant.available
                        ) { model.select(variant: variant.id) }
                    }
                }
            }
        }
        ForEach(groups) { group in
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 4) {
                    Text(group.title).font(.subheadline.weight(.semibold))
                    Text(group.values.first { $0.id == model.chosen[group.id] }?.value ?? "")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                FlowLayout {
                    ForEach(group.values) { value in
                        ChoiceButton(title: value.value, on: model.chosen[group.id] == value.id, available: value.available) {
                            model.choose(value, in: group)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder private func buy(_ view: ProductView) -> some View {
        @Bindable var model = model
        let price = view.price(variantID: model.variantID, chosen: model.chosen)
        VStack(alignment: .leading, spacing: 12) {
            if let stock = price.stock, stock > 0, stock <= 5 {
                Text("Only \(stock) left").font(.footnote.weight(.semibold)).foregroundStyle(.orange)
            }
            HStack(spacing: 12) {
                Stepper("Quantity \(model.quantity)", value: $model.quantity, in: 1...max(1, min(99, price.stock ?? 99)))
                    .fixedSize()
                Button {
                    Task { await model.add(view) }
                } label: {
                    Text(price.amount == nil ? "Sold out" : !price.ready ? "Choose options" : model.isAdding ? "Adding…" : "Add to cart")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(model.isAdding || !price.ready || bd.cart == nil)
            }
            if let message = model.message {
                HStack {
                    Text(message.text)
                        .font(.footnote)
                        .foregroundStyle(message.ok ? Color.secondary : Color.red)
                    if message.ok {
                        Button("View cart") { bd.tab = .cart }.buttonStyle(.bordered).controlSize(.small)
                    }
                }
            }
            SaveButtons(product: model.summary(view))
            VStack(alignment: .leading, spacing: 4) {
                Label("Secure checkout with Stripe", systemImage: "lock")
                HStack(spacing: 4) {
                    Text("Questions?")
                    Button("Ask us") { bd.tab = .chat }
                        .buttonStyle(.borderless)
                        .foregroundStyle(Color.accentColor)
                    Text("before you buy")
                }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
    }

    // MARK: Further down

    @ViewBuilder private func details(_ view: ProductView) -> some View {
        if !view.description.isEmpty || !view.features.isEmpty || !view.specs.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Details").font(.title3.bold())
                if !view.description.isEmpty { Text(view.description) }
                if !view.features.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(view.features, id: \.self) { feature in
                            Label(feature, systemImage: "checkmark").font(.subheadline)
                        }
                    }
                }
                ForEach(view.specs, id: \.name) { group in
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

    @ViewBuilder private var addonsSection: some View {
        if !model.addons.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Complete your purchase").font(.title3.bold())
                ForEach(model.addons) { addon in
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
                        let added = model.addedAddons.contains(addon.id)
                        Button(added ? "Added" : model.addingAddon == addon.id ? "…" : "Add") {
                            Task { await model.add(addon) }
                        }
                        .buttonStyle(.bordered)
                        .disabled(added || model.addingAddon == addon.id || bd.cart == nil)
                    }
                }
            }
        }
    }

    @ViewBuilder private var reviewsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Reviews").font(.title3.bold())
            if let reviews = model.reviews, !reviews.items.isEmpty {
                HStack(spacing: 8) {
                    StarRating(rating: reviews.avgRating, size: 14)
                    Text(String(format: "%.1f out of 5", reviews.avgRating)).font(.subheadline.bold())
                    Text("from \(reviews.totalCount) reviews").font(.subheadline).foregroundStyle(.secondary)
                }
                ForEach(reviews.items) { review in
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
                    Divider()
                }
                if model.hasMoreReviews {
                    Button("Show more reviews") { Task { await model.moreReviews() } }
                        .buttonStyle(.bordered)
                }
            } else {
                Text("No reviews yet.").foregroundStyle(.secondary)
            }
        }
    }
}

/// The photos for the chosen option, swiped sideways a page at a time.
private struct Gallery: View {
    let urls: [String]

    var body: some View {
        if urls.isEmpty {
            RemoteImage(url: nil).frame(height: 280).clipShape(RoundedRectangle(cornerRadius: 14))
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 0) {
                    ForEach(urls, id: \.self) { url in
                        RemoteImage(url: url, contentMode: .fit)
                            .containerRelativeFrame(.horizontal)
                            .frame(height: 280)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .frame(height: 280)
            .background(Color.secondary.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            // A new option shows its own photos from the first.
            .id(urls)
        }
    }
}

/// An option or size button. A sold-out one is struck through and can't be
/// chosen.
private struct ChoiceButton: View {
    let title: String
    let on: Bool
    let available: Bool
    let action: () -> Void

    var body: some View {
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
