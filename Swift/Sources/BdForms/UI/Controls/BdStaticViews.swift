import SwiftUI

/// Display-only elements: headings, copy, lists, tables, images.
struct BdStaticContent: View {
    let field: BdFormField
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        switch field.type {
        case "title":
            Text(field.label.isEmpty ? "Untitled" : field.label)
                .font(.title2.bold())
                .accessibilityAddTraits(.isHeader)
        case "subtitle":
            Text(field.label)
                .font(.title3.weight(.semibold))
                .accessibilityAddTraits(.isHeader)
        case "separator":
            Divider()
        case "richtext":
            if let html = field.content, !html.isEmpty {
                Text(BdHTML.attributedString(html))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        case "body_text":
            if let text = field.content, !text.isEmpty {
                Text(text).frame(maxWidth: .infinity, alignment: .leading)
            }
        case "bullet_list":
            BdBulletList(config: field.listConfig)
        case "table":
            BdTableView(config: field.tableConfig)
        case "image":
            if let cfg = field.imageConfig, let url = BdFormRules.safeHTTPURL(cfg.src) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFit()
                } placeholder: {
                    Color.secondary.opacity(0.1)
                }
                .frame(maxWidth: cfg.width.map { CGFloat($0) } ?? .infinity)
                .frame(height: cfg.height.map { CGFloat($0) })
                .clipShape(RoundedRectangle(cornerRadius: style.cornerRadius * 0.5))
                .accessibilityLabel(cfg.alt ?? "")
                .accessibilityHidden((cfg.alt ?? "").isEmpty)
                .frame(maxWidth: .infinity)
            }
        default:
            EmptyView()
        }
    }
}

struct BdBulletList: View {
    let config: BdFormField.ListConfig?

    var body: some View {
        let items = config?.items ?? []
        VStack(alignment: .leading, spacing: 10) {
            if config?.variant != "details", let title = config?.title, !title.isEmpty {
                Text(title).font(.headline)
            }
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                if config?.variant == "details" {
                    HStack(alignment: .top, spacing: 12) {
                        if let icon = item.icon, !icon.isEmpty {
                            BdIcon(icon, size: 20).foregroundStyle(.tint).padding(.top, 2)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.text).font(.body.weight(.semibold))
                            if let d = item.description, !d.isEmpty {
                                Text(d).font(.subheadline).foregroundStyle(.secondary)
                            }
                        }
                    }
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("•").foregroundStyle(.secondary)
                        Text(item.text)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct BdTableView: View {
    let config: BdFormField.TableConfig?

    var body: some View {
        let columns = config?.columns ?? []
        let rows = config?.rows ?? []
        let highlight = config?.highlightColumn
        if !columns.isEmpty {
            // Full width when it fits; scrolls sideways when it doesn't.
            ViewThatFits(in: .horizontal) {
                grid(columns, rows, highlight, stretch: true)
                ScrollView(.horizontal, showsIndicators: false) {
                    grid(columns, rows, highlight, stretch: false)
                }
            }
        }
    }

    private func grid(
        _ columns: [BdFormField.TableConfig.Column],
        _ rows: [BdFormField.TableConfig.Row],
        _ highlight: Int?,
        stretch: Bool
    ) -> some View {
        // No spacing between cells, so a highlighted column reads as one band.
        Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
            GridRow {
                ForEach(Array(columns.enumerated()), id: \.offset) { ci, col in
                    Text(col.header)
                        .font(.subheadline.weight(.semibold))
                        .modifier(BdTableCell(align: col.align, highlighted: ci == highlight, stretch: stretch))
                }
            }
            Divider().gridCellUnsizedAxes(.horizontal)
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                GridRow {
                    ForEach(Array(columns.enumerated()), id: \.offset) { ci, col in
                        cell(row.cells?[safe: ci] ?? "", check: col.type == "check")
                            .modifier(BdTableCell(align: col.align, highlighted: ci == highlight, stretch: stretch))
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func cell(_ text: String, check: Bool) -> some View {
        switch check ? BdFormRules.tableCheckState(text) : "text" {
        case "yes": Image(systemName: "checkmark").foregroundStyle(.tint).accessibilityLabel("Yes")
        case "no": Text("–").foregroundStyle(.secondary).accessibilityLabel("No")
        default: Text(text).font(.subheadline)
        }
    }
}

/// A live calculation result, read-only.
struct BdCalculationView: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let cfg = ctx.field.calculationConfig
        let value = ctx.value
        let hasValue = !(value == nil || value == .null || value == .string(""))
        BdCard {
            if cfg?.sensitive == true && !hasValue {
                Text(strings.calculatedOnSubmit).foregroundStyle(.secondary)
            } else {
                Text(hasValue ? BdCalculation.format(value, display: cfg?.display) : "—")
                    .font(.title3.weight(.semibold).monospacedDigit())
                    .contentTransition(.numericText())
                    .animation(.snappy, value: value)
                    .textSelection(.enabled)
            }
        }
    }
}

private struct BdTableCell: ViewModifier {
    let align: String?
    let highlighted: Bool
    let stretch: Bool

    func body(content: Content) -> some View {
        let alignment: Alignment = switch align {
        case "center": .center
        case "right": .trailing
        default: .leading
        }
        content
            .padding(.horizontal, 8)
            .padding(.vertical, 7)
            .frame(maxWidth: stretch ? .infinity : nil, alignment: alignment)
            .gridColumnAlignment(alignment.horizontal)
            .background(highlighted ? AnyShapeStyle(.tint.opacity(0.12)) : AnyShapeStyle(.clear))
    }
}
