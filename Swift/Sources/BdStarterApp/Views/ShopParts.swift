import BusinessDashKit
import SwiftUI

// The small pieces the store screens share: stars, a wrapping row, the
// product card, the save buttons, the compare bar and the product rails.

/// Five stars for a rating, with halves.
struct StarRating: View {
    let rating: Double
    var size: CGFloat = 12

    var body: some View {
        HStack(spacing: 1) {
            ForEach(1...5, id: \.self) { i in
                let value = Double(i)
                Image(systemName: rating >= value ? "star.fill" : rating >= value - 0.5 ? "star.leadinghalf.filled" : "star")
            }
        }
        .font(.system(size: size))
        .foregroundStyle(.orange)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(String(format: "%.1f out of 5", rating))
    }
}

/// Lays its children out in rows, wrapping when a row is full: option
/// buttons, filter chips, tags.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(subviews, width: proposal.width ?? .infinity)
        let width = rows.map { $0.width }.max() ?? 0
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(subviews, width: bounds.width) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(_ subviews: Subviews, width: CGFloat) -> [Row] {
        var rows: [Row] = [Row()]
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = rows[rows.count - 1].indices.isEmpty ? size.width : rows[rows.count - 1].width + spacing + size.width
            if needed > width, !rows[rows.count - 1].indices.isEmpty {
                rows.append(Row())
            }
            let last = rows.count - 1
            rows[last].width += (rows[last].indices.isEmpty ? 0 : spacing) + size.width
            rows[last].height = max(rows[last].height, size.height)
            rows[last].indices.append(index)
        }
        return rows
    }
}

/// A photo from a URL string, filling its frame, or a quiet placeholder.
struct RemoteImage: View {
    let url: String?
    var contentMode: ContentMode = .fill

    var body: some View {
        if let url, let parsed = URL(string: url) {
            AsyncImage(url: parsed) { image in
                image.resizable().aspectRatio(contentMode: contentMode)
            } placeholder: {
                Color.secondary.opacity(0.08)
            }
        } else {
            ZStack {
                Color.secondary.opacity(0.08)
                Text("No image").font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

/// A photo filling a full-width frame of a set height. The frame takes its
/// size from an empty view and the photo is laid over it, so a wide photo
/// can't push the layout wider than its column.
struct CoverImage: View {
    let url: String?
    let height: CGFloat

    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .overlay { RemoteImage(url: url) }
            .clipped()
    }
}

/// ♡ Save and ⇄ Compare for one product. Both lists live on this device.
struct SaveButtons: View {
    @Environment(BdEnvironment.self) private var bd
    let product: SavedProduct
    /// Icons only, for a card's corner.
    var compact = false

    var body: some View {
        let saved = bd.saved.wishlist.contains(product.id)
        let comparing = bd.saved.compare.contains(product.id)
        HStack(spacing: 8) {
            Button {
                bd.saved.wishlist.toggle(product)
            } label: {
                Label(saved ? "Saved" : "Save", systemImage: saved ? "heart.fill" : "heart")
            }
            .tint(saved ? .pink : .primary)

            Button {
                bd.saved.compare.toggle(product)
            } label: {
                Label(comparing ? "Comparing" : "Compare", systemImage: "arrow.left.arrow.right")
            }
            .tint(comparing ? .accentColor : .primary)
            // The table fits four.
            .disabled(!comparing && bd.saved.compare.isFull)
        }
        .labelStyle(SaveLabelStyle(compact: compact))
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
        .controlSize(compact ? .small : .regular)
    }
}

private struct SaveLabelStyle: LabelStyle {
    let compact: Bool
    func makeBody(configuration: Configuration) -> some View {
        if compact {
            Label(configuration)
                .labelStyle(.iconOnly)
        } else {
            Label(configuration)
                .labelStyle(.titleAndIcon)
        }
    }
}

/// A product in the store grid.
struct ProductCardView: View {
    let product: Product

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            CoverImage(url: product.coverImage, height: 150)
                .overlay(alignment: .topLeading) { badges.padding(8) }
                .clipShape(RoundedRectangle(cornerRadius: 12))

            Text(product.name.isEmpty ? "Untitled" : product.name)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
                .foregroundStyle(.primary)

            if let reviews = product.reviewCount, reviews > 0 {
                HStack(spacing: 4) {
                    StarRating(rating: product.avgRating ?? 0, size: 10)
                    Text("(\(reviews))").font(.caption2).foregroundStyle(.secondary)
                }
            }

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(priceLabel)
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(Color.accentColor)
                if product.isOnSale == true, let was = product.comparePriceCents {
                    Text(Money.cents(was)).font(.caption).strikethrough().foregroundStyle(.secondary)
                }
            }

            if product.isLowStock == true {
                Text("Low stock").font(.caption2.weight(.semibold)).foregroundStyle(.orange)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    /// Integer cents; "From" when the variants differ in price.
    private var priceLabel: String {
        guard let cents = product.cheapestPriceCents else { return "View details" }
        return (product.hasMultipleVariants == true ? "From " : "") + Money.cents(cents)
    }

    @ViewBuilder private var badges: some View {
        HStack(spacing: 4) {
            if product.isBestSeller == true { Badge("Best seller") }
            if product.isNew == true { Badge("New") }
            if product.isOnSale == true { Badge("Sale", tint: .red) }
        }
    }
}

struct Badge: View {
    let text: String
    var tint: Color = .accentColor

    init(_ text: String, tint: Color = .accentColor) {
        self.text = text
        self.tint = tint
    }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .bold))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(.background.opacity(0.92), in: Capsule())
            .overlay(Capsule().strokeBorder(tint.opacity(0.4)))
            .foregroundStyle(tint)
    }
}

/// The compare picks along the bottom of the store, with the way to the table.
struct CompareBar: View {
    @Environment(BdEnvironment.self) private var bd

    var body: some View {
        let items = bd.saved.compare.items
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(items) { item in
                            Button {
                                bd.saved.compare.remove(item.id)
                            } label: {
                                Label(item.name, systemImage: "xmark")
                                    .labelStyle(TrailingIconLabelStyle())
                                    .font(.caption)
                            }
                            .buttonStyle(.bordered)
                            .buttonBorderShape(.capsule)
                            .controlSize(.small)
                            .accessibilityLabel("Remove \(item.name) from compare")
                        }
                    }
                }
                HStack {
                    Button("Clear") { bd.saved.compare.clear() }
                        .buttonStyle(.bordered)
                    Spacer()
                    NavigationLink {
                        CompareView()
                    } label: {
                        Text(items.count < 2 ? "Pick one more to compare" : "Compare \(items.count)")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(items.count < 2)
                }
            }
            .padding(12)
            .background(.bar, in: RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal)
            .padding(.bottom, 6)
        }
    }
}

struct TrailingIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.title
            configuration.icon.imageScale(.small)
        }
    }
}

/// A row of small product cards: related products, recently viewed.
struct ProductRail: View {
    let title: String
    let products: [SavedProduct]

    var body: some View {
        if !products.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text(title).font(.title3.bold())
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 12) {
                        ForEach(products) { product in
                            NavigationLink {
                                ProductDetailView(productID: product.id)
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    RemoteImage(url: product.image)
                                        .frame(width: 140, height: 110)
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                    Text(product.name).font(.caption.weight(.semibold)).lineLimit(2)
                                    if let cents = product.priceCents {
                                        Text(Money.cents(cents)).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                                    }
                                }
                                .frame(width: 140, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }
}
