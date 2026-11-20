import SwiftUI

/// Walks a list of elements: containers apply their conditions and lay out
/// their children; everything else becomes a ``BdFieldRow``.
struct BdFieldTree: View {
    let nodes: [BdFormField]
    let entries: [BdFieldPath.Entry]

    var body: some View {
        ForEach(nodes) { node in
            BdNodeView(node: node, entries: entries)
        }
    }
}

struct BdNodeView: View {
    let node: BdFormField
    let entries: [BdFieldPath.Entry]

    @Environment(BdFormController.self) private var controller
    @Environment(\.bdRowMode) private var mode
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        switch node.type {
        case "condition_block", "flex_row":
            if controller.isVisible(node, in: entries) {
                BdFieldTree(nodes: node.children ?? [], entries: entries)
            }
        case "input_group":
            if controller.isVisible(node, in: entries) {
                let children = Array((node.children ?? []).prefix(controller.revealCount(node, in: entries)))
                if node.showGroupLabel == true, !node.label.isEmpty {
                    BdGroupHeading(text: node.label)
                }
                BdFieldTree(nodes: children, entries: entries)
            }
        case "or_condition":
            if controller.isVisible(node, in: entries) {
                BdEitherOrView(node: node, entries: entries)
            }
        case "multi_populator":
            BdRepeaterView(node: node, entries: entries)
        case "reference_value":
            EmptyView()
        case "calculation" where node.calculationConfig?.display?.show == false:
            EmptyView()
        default:
            BdFieldRow(field: node, path: BdFieldPath(node.id, in: entries))
        }
    }
}

/// A group's own label, above its fields.
struct BdGroupHeading: View {
    let text: String
    @Environment(\.bdRowMode) private var mode

    var body: some View {
        if mode == .section {
            Section {} header: {
                Text(text).font(.headline).foregroundStyle(.primary).textCase(nil)
            }
        } else {
            Text(text).font(.headline).padding(.top, 4)
        }
    }
}

/// Label, control, error and help for one field.
struct BdFieldRow: View {
    let field: BdFormField
    let path: BdFieldPath

    @Environment(BdFormController.self) private var controller
    @Environment(\.bdRowMode) private var mode
    @Environment(\.bdFormStyle) private var style
    @Environment(\.bdFieldRenderers) private var renderers

    var body: some View {
        let ctx = BdFieldContext(field: field, path: path, controller: controller)
        let control = Group {
            if let custom = renderers.renderer(for: field) {
                custom(ctx)
            } else {
                BdFieldControl(ctx: ctx)
            }
        }
        if BdFieldType.noLabel.contains(field.type) || field.type == "image" {
            BdStaticRow(field: field) { control }
                .id(path.key)
        } else if mode == .section {
            Section {
                control
            } header: {
                label
            } footer: {
                footnotes
            }
            .id(path.key)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                label.font(.subheadline.weight(.semibold))
                control
                footnotes.font(.footnote)
            }
            .id(path.key)
        }
    }

    private var isRequired: Bool {
        (field.required || field.mustBeTrue == true) && !BdFieldType.staticOrLayout.contains(field.type)
    }

    @ViewBuilder
    private var label: some View {
        if !field.label.isEmpty {
            Text("\(field.label)\(Text(isRequired ? style.requiredMarker : "").foregroundStyle(style.errorColor))")
                .textCase(nil)
                .accessibilityLabel(field.label + (isRequired ? ", required" : ""))
        }
    }

    @ViewBuilder
    private var footnotes: some View {
        let error = controller.error(for: path)
        if error != nil || field.helpText?.isEmpty == false {
            VStack(alignment: .leading, spacing: 4) {
                if let error {
                    Label(error, systemImage: "exclamationmark.circle.fill")
                        .foregroundStyle(style.errorColor)
                        .labelStyle(BdCompactLabelStyle())
                        .transition(.opacity)
                }
                if let help = field.helpText, !help.isEmpty {
                    Text(help).foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// Static content: a section with no header in the grouped layout.
struct BdStaticRow<Content: View>: View {
    let field: BdFormField
    @ViewBuilder let content: Content
    @Environment(\.bdRowMode) private var mode

    var body: some View {
        if mode == .section {
            switch field.type {
            case "title", "subtitle":
                Section {} header: { content.textCase(nil).foregroundStyle(.primary) }
            case "separator":
                EmptyView()
            default:
                Section { content }
            }
        } else {
            content
        }
    }
}

struct BdCompactLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            configuration.icon.imageScale(.small)
            configuration.title
        }
    }
}

// MARK: - Either/or

/// Two (or more) alternatives where at least one must be filled.
struct BdEitherOrView: View {
    let node: BdFormField
    let entries: [BdFieldPath.Entry]

    @Environment(BdFormController.self) private var controller
    @Environment(\.bdRowMode) private var mode
    @Environment(\.bdFormStyle) private var style
    @Environment(\.bdFormStrings) private var strings

    static func showsOwnLabel(_ field: BdFormField) -> Bool {
        let containers: Set<String> = ["condition_block", "flex_row", "input_group", "or_condition", "multi_populator"]
        return !containers.contains(field.type) && !BdFieldType.noLabel.contains(field.type) && !field.label.isEmpty
    }

    func sideLabel(_ i: Int, _ child: BdFormField) -> String {
        if i == 0, let l = node.orConditionConfig?.leftLabel, !l.isEmpty { return l }
        if i == 1, let l = node.orConditionConfig?.rightLabel, !l.isEmpty { return l }
        if !child.label.isEmpty { return child.label }
        return ["Option A", "Option B", "Option C"][safe: i] ?? "Option \(i + 1)"
    }

    var body: some View {
        let branches = node.children ?? []
        let error = controller.error(for: BdFieldPath(node.id, in: entries))
        let content = VStack(alignment: .leading, spacing: 14) {
            ForEach(Array(branches.enumerated()), id: \.element.id) { i, child in
                if i > 0 {
                    HStack {
                        VStack { Divider() }
                        Text(strings.or).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        VStack { Divider() }
                    }
                }
                VStack(alignment: .leading, spacing: 8) {
                    let side = sideLabel(i, child)
                    // A plain field already shows its own label; don't say it twice.
                    if !(Self.showsOwnLabel(child) && side == child.label) {
                        Text(side).font(.subheadline.weight(.medium))
                    }
                    BdFieldTree(nodes: [child], entries: entries)
                        .environment(\.bdRowMode, .inline)
                }
            }
        }
        if mode == .section {
            Section {
                content.padding(.vertical, 4)
            } header: {
                if !node.label.isEmpty { Text(node.label).textCase(nil) }
            } footer: {
                if let error {
                    Label(error, systemImage: "exclamationmark.circle.fill")
                        .foregroundStyle(style.errorColor)
                        .labelStyle(BdCompactLabelStyle())
                } else {
                    Text(strings.fillOneSide)
                }
            }
            .id(BdFieldPath(node.id, in: entries).key)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                if !node.label.isEmpty {
                    HStack(alignment: .firstTextBaseline) {
                        Text(node.label).font(.subheadline.weight(.semibold))
                        Text(strings.fillOneSide).font(.caption).foregroundStyle(.secondary)
                    }
                }
                content
                    .padding()
                    .background(.background.secondary, in: RoundedRectangle(cornerRadius: style.cornerRadius))
                    .overlay {
                        if error != nil {
                            RoundedRectangle(cornerRadius: style.cornerRadius).stroke(style.errorColor, lineWidth: 1)
                        }
                    }
                if let error { Text(error).font(.footnote).foregroundStyle(style.errorColor) }
            }
            .id(BdFieldPath(node.id, in: entries).key)
        }
    }
}

// MARK: - Repeater

/// A `multi_populator`: the same fields once per entry, with add/remove.
struct BdRepeaterView: View {
    let node: BdFormField
    let entries: [BdFieldPath.Entry]

    @Environment(BdFormController.self) private var controller
    @Environment(\.bdRowMode) private var mode
    @Environment(\.bdFormStyle) private var style
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let path = BdFieldPath(node.id, in: entries)
        let list = controller.entries(of: path)
        let cfg = node.populatorConfig
        let max = cfg?.maxInstances ?? 10
        let itemLabel = cfg?.itemLabel.flatMap { $0.isEmpty ? nil : $0 } ?? (node.label.isEmpty ? strings.entry : node.label)
        let error = controller.error(for: path)

        if mode == .section {
            if !node.label.isEmpty || error != nil {
                Section {} header: {
                    if !node.label.isEmpty {
                        Text(node.label + (node.required ? style.requiredMarker : "")).font(.headline).foregroundStyle(.primary).textCase(nil)
                    }
                } footer: {
                    if let error { Text(error).foregroundStyle(style.errorColor) }
                }
                .id(path.key)
            }
            ForEach(Array(list.indices), id: \.self) { index in
                Section {
                    entryFields(path, index)
                        .environment(\.bdRowMode, .inline)
                        .padding(.vertical, 4)
                } header: {
                    entryHeader(itemLabel, index: index, count: list.count, path: path)
                }
            }
            if list.count < max {
                Section {
                    Button { withAnimation(style.animation) { controller.addEntry(to: path) } } label: {
                        Label(cfg?.addButtonLabel.flatMap { $0.isEmpty ? nil : $0 } ?? strings.addAnother, systemImage: "plus.circle.fill")
                    }
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 12) {
                if !node.label.isEmpty {
                    Text(node.label + (node.required ? style.requiredMarker : "")).font(.subheadline.weight(.semibold))
                }
                ForEach(Array(list.indices), id: \.self) { index in
                    VStack(alignment: .leading, spacing: 12) {
                        entryHeader(itemLabel, index: index, count: list.count, path: path)
                        entryFields(path, index)
                    }
                    .padding()
                    .background(.background.secondary, in: RoundedRectangle(cornerRadius: style.cornerRadius))
                }
                if list.count < max {
                    Button { withAnimation(style.animation) { controller.addEntry(to: path) } } label: {
                        Label(cfg?.addButtonLabel.flatMap { $0.isEmpty ? nil : $0 } ?? strings.addAnother, systemImage: "plus.circle.fill")
                    }
                    .buttonStyle(.bordered)
                }
                if let error { Text(error).font(.footnote).foregroundStyle(style.errorColor) }
            }
            .id(path.key)
        }
    }

    private func entryHeader(_ label: String, index: Int, count: Int, path: BdFieldPath) -> some View {
        HStack {
            Text("\(label) \(index + 1)").font(.subheadline.weight(.semibold)).textCase(nil)
            Spacer()
            if count > 1 {
                Button(role: .destructive) {
                    withAnimation(style.animation) { controller.removeEntry(at: index, from: path) }
                } label: {
                    Image(systemName: "minus.circle.fill")
                }
                .buttonStyle(.borderless)
                .accessibilityLabel(strings.removeEntry)
            }
        }
    }

    private func entryFields(_ path: BdFieldPath, _ index: Int) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            BdFieldTree(nodes: node.children ?? [], entries: path.entry(index))
        }
    }
}
