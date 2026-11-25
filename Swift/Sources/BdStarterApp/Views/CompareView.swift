import BusinessDashKit
import SwiftUI

/// The compare picks side by side: price, rating, category, options, and
/// every specification any of them has.
struct CompareView: View {
    @Environment(BdEnvironment.self) private var bd
    @State private var model = CompareViewModel()

    var body: some View {
        let ids = bd.saved.compare.items.map(\.id)
        LoadableView(state: model.state) { columns in
            if columns.isEmpty {
                ContentUnavailableView(
                    "Nothing to compare",
                    systemImage: "arrow.left.arrow.right",
                    description: Text("Tap ⇄ on up to four products.")
                )
            } else {
                ScrollView([.horizontal, .vertical]) {
                    Grid(alignment: .topLeading, horizontalSpacing: 16, verticalSpacing: 12) {
                        GridRow {
                            Color.clear.frame(width: 90, height: 1)
                            ForEach(columns) { column in
                                VStack(alignment: .leading, spacing: 6) {
                                    NavigationLink {
                                        ProductDetailView(productID: column.view.id)
                                    } label: {
                                        VStack(alignment: .leading, spacing: 6) {
                                            RemoteImage(url: column.view.images.first)
                                                .frame(width: 140, height: 110)
                                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                            Text(column.view.name).font(.subheadline.weight(.semibold)).lineLimit(2)
                                        }
                                    }
                                    .buttonStyle(.plain)
                                    Button("Remove") { bd.saved.compare.remove(column.view.id) }
                                        .font(.caption)
                                        .buttonStyle(.borderless)
                                }
                                .frame(width: 140, alignment: .leading)
                            }
                        }
                        Divider()
                        row("Price", columns) { column in
                            column.view.defaultVariant?.price.map { Money.amount($0) } ?? "—"
                        }
                        row("Rating", columns) { column in
                            column.rating.map { String(format: "%.1f ★ (%d)", $0.avg, $0.count) } ?? "No reviews"
                        }
                        row("Category", columns) { $0.view.categoryName ?? "—" }
                        row("Options", columns) { column in
                            let names = column.view.variants.map(\.name).joined(separator: ", ")
                            return names.isEmpty ? "—" : names
                        }
                        ForEach(specRows(columns), id: \.self) { spec in
                            row("\(spec.label) (\(spec.group))", columns) { column in
                                column.view.specs.first { $0.name == spec.group }?.rows.first { $0.label == spec.label }?.value ?? "—"
                            }
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationTitle("Compare")
        // The picks change here (Remove) and in the store; reload either way.
        .task(id: ids) {
            model.bind(bd)
            await model.load(ids: ids)
        }
    }

    private func row(
        _ label: String,
        _ columns: [CompareViewModel.Column],
        value: @escaping (CompareViewModel.Column) -> String
    ) -> some View {
        GridRow {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary).frame(width: 90, alignment: .leading)
            ForEach(columns) { column in
                Text(value(column)).font(.subheadline).frame(width: 140, alignment: .leading)
            }
        }
    }

    private struct SpecRow: Hashable {
        let group: String
        let label: String
    }

    /// Every specification row any product has, in the order first seen.
    private func specRows(_ columns: [CompareViewModel.Column]) -> [SpecRow] {
        var seen: [SpecRow] = []
        for column in columns {
            for group in column.view.specs {
                for spec in group.rows where !seen.contains(SpecRow(group: group.name, label: spec.label)) {
                    seen.append(SpecRow(group: group.name, label: spec.label))
                }
            }
        }
        return seen
    }
}
