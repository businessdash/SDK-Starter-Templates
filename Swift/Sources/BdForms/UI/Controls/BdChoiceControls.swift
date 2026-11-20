import SwiftUI

struct BdOption: Identifiable, Hashable, Sendable {
    let value: String
    let label: String
    var image: String?
    var icon: String?
    var detail: String?
    var id: String { value }
}

/// A single or multiple choice from a list: a native menu for a short single
/// choice, a searchable sheet for a long list or many picks.
struct BdOptionPicker: View {
    let title: String
    let placeholder: String
    let options: [BdOption]
    @Binding var selection: [String]
    let multi: Bool
    var searchable: Bool?
    var allowCustom = false
    var showsTitle = false

    @State private var presented = false
    @Environment(\.bdRowMode) private var mode
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        let useSheet = multi || (searchable ?? BdFormRules.shouldSearch(optionCount: options.count, display: nil)) || allowCustom
        let labels = selection.map { v in options.first { $0.value == v }?.label ?? v }
        let summary = labels.isEmpty ? placeholder : labels.joined(separator: ", ")
        let row = HStack(spacing: 8) {
            if showsTitle {
                Text(title).foregroundStyle(.primary)
                Spacer(minLength: 12)
                Text(summary).foregroundStyle(labels.isEmpty ? .tertiary : .secondary).lineLimit(1)
            } else {
                Text(summary).foregroundStyle(labels.isEmpty ? .secondary : .primary).lineLimit(2)
                Spacer(minLength: 12)
            }
            Image(systemName: useSheet ? "chevron.right" : "chevron.up.chevron.down")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
        .padding(.horizontal, mode == .inline && !showsTitle ? 12 : 0)
        .padding(.vertical, mode == .inline && !showsTitle ? 10 : 0)
        .background {
            if mode == .inline && !showsTitle {
                RoundedRectangle(cornerRadius: style.cornerRadius * 0.75).fill(.background.secondary)
            }
        }

        if useSheet {
            Button { presented = true } label: { row }
                .buttonStyle(.plain)
                .accessibilityLabel(title)
                .accessibilityValue(summary)
                .sheet(isPresented: $presented) {
                    BdOptionSheet(title: title, options: options, selection: $selection, multi: multi, allowCustom: allowCustom)
                }
        } else {
            Menu {
                Picker(title, selection: Binding(
                    get: { selection.first ?? "" },
                    set: { selection = $0.isEmpty ? [] : [$0] }
                )) {
                    Text(placeholder).tag("")
                    ForEach(options) { o in Text(o.label).tag(o.value) }
                }
                .pickerStyle(.inline)
            } label: {
                row
            }
            .buttonStyle(.plain)
            .accessibilityLabel(title)
            .accessibilityValue(summary)
        }
    }
}

struct BdOptionSheet: View {
    let title: String
    let options: [BdOption]
    @Binding var selection: [String]
    let multi: Bool
    let allowCustom: Bool

    @State private var query = ""
    @Environment(\.dismiss) private var dismiss
    @Environment(\.bdFormStrings) private var strings

    var filtered: [BdOption] {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return options }
        return options.filter { $0.label.localizedStandardContains(q) || $0.value.localizedStandardContains(q) }
    }

    func choose(_ value: String) {
        if multi {
            if let i = selection.firstIndex(of: value) { selection.remove(at: i) } else { selection.append(value) }
        } else {
            selection = selection == [value] ? [] : [value]
            dismiss()
        }
    }

    var body: some View {
        NavigationStack {
            List {
                let q = query.trimmingCharacters(in: .whitespaces)
                if allowCustom, !q.isEmpty, !options.contains(where: { $0.label.caseInsensitiveCompare(q) == .orderedSame }) {
                    Button { choose(q) } label: {
                        Label(strings.format(strings.useCustom, q), systemImage: "plus.circle")
                    }
                }
                ForEach(filtered) { o in
                    BdChoiceRow(selected: selection.contains(o.value), multi: multi, action: { choose(o.value) }) {
                        BdOptionLabel(option: o)
                    }
                }
                if filtered.isEmpty && !(allowCustom && !q.isEmpty) {
                    Text(strings.noResults).foregroundStyle(.secondary)
                }
            }
            #if os(iOS)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: strings.search)
            #else
            .searchable(text: $query, prompt: strings.search)
            #endif
            .navigationTitle(title)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(strings.done) { dismiss() }
                }
                if !selection.isEmpty {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(strings.clear) { selection = [] }
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

struct BdOptionLabel: View {
    let option: BdOption

    var body: some View {
        HStack(spacing: 12) {
            if let image = option.image, let url = BdFormRules.safeHTTPURL(image) {
                AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.secondary.opacity(0.15) }
                    .frame(width: 36, height: 36)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            } else if let icon = option.icon {
                BdIcon(icon, size: 20).foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(option.label)
                if let detail = option.detail {
                    Text(detail).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }
}

// MARK: - Select, radio, checkbox

struct BdSelectControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let f = ctx.field
        let options = (f.options ?? []).map { BdOption(value: $0, label: $0, icon: f.optionIcons?[$0]) }
        BdOptionPicker(
            title: f.label,
            placeholder: f.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? strings.select,
            options: options,
            selection: Binding(
                get: { ctx.value?.stringValue.flatMap { $0.isEmpty ? nil : [$0] } ?? [] },
                set: { ctx.set(.string($0.first ?? "")); ctx.commit() }
            ),
            multi: false,
            searchable: BdFormRules.shouldSearch(optionCount: options.count, display: f.display),
            allowCustom: f.allowCustom == true
        )
    }
}

struct BdRadioControl: View {
    let ctx: BdFieldContext

    var body: some View {
        let current = ctx.value?.stringValue
        BdRows {
            ForEach(ctx.field.options ?? [], id: \.self) { opt in
                BdChoiceRow(selected: current == opt, multi: false, action: { ctx.set(.string(opt)); ctx.commit() }) {
                    BdOptionLabel(option: BdOption(value: opt, label: opt, icon: ctx.field.optionIcons?[opt]))
                }
            }
        }
    }
}

struct BdCheckboxControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let f = ctx.field
        let selected = ctx.value?.stringArray ?? []
        let opts = f.options ?? []
        if f.display == "dropdown" || BdFormRules.shouldSearch(optionCount: opts.count, display: f.display) {
            BdOptionPicker(
                title: f.label,
                placeholder: f.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? strings.select,
                options: opts.map { BdOption(value: $0, label: $0, icon: f.optionIcons?[$0]) },
                selection: Binding(get: { selected }, set: { ctx.set(.array($0.map { .string($0) })); ctx.commit() }),
                multi: true,
                allowCustom: f.allowCustom == true
            )
        } else {
            BdRows {
                ForEach(opts, id: \.self) { opt in
                    BdChoiceRow(selected: selected.contains(opt), multi: true, action: {
                        let next = selected.contains(opt) ? selected.filter { $0 != opt } : selected + [opt]
                        ctx.set(.array(next.map { .string($0) }))
                        ctx.commit()
                    }) {
                        BdOptionLabel(option: BdOption(value: opt, label: opt, icon: f.optionIcons?[opt]))
                    }
                }
            }
        }
    }
}

// MARK: - Choice cards

struct BdChoiceCardsControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdRowMode) private var mode
    @Environment(\.bdFormStyle) private var style
    @Environment(\.bdFormStrings) private var strings
    @Environment(\.openURL) private var openURL

    var body: some View {
        let cfg = ctx.field.choiceConfig
        let multi = cfg?.mode == "multi"
        let options = cfg?.options ?? []
        let picked: [String] = multi ? (ctx.value?.stringArray ?? []) : (ctx.value?.stringValue.map { [$0] } ?? [])

        func toggle(_ label: String) {
            if multi {
                let next = picked.contains(label) ? picked.filter { $0 != label } : picked + [label]
                ctx.set(.array(next.map { .string($0) }))
            } else {
                ctx.set(.string(picked.first == label ? "" : label))
            }
            ctx.commit()
        }

        return Group {
            if mode == .section {
                ForEach(options, id: \.label) { opt in
                    BdChoiceRow(selected: picked.contains(opt.label), multi: multi, action: { toggle(opt.label) }) {
                        card(opt)
                    }
                }
            } else {
                VStack(spacing: 10) {
                    ForEach(options, id: \.label) { opt in
                        let on = picked.contains(opt.label)
                        BdChoiceRow(selected: on, multi: multi, action: { toggle(opt.label) }) { card(opt) }
                            .padding(12)
                            .background(.background.secondary, in: RoundedRectangle(cornerRadius: style.cornerRadius))
                            .overlay {
                                RoundedRectangle(cornerRadius: style.cornerRadius)
                                    .strokeBorder(on ? AnyShapeStyle(.tint) : AnyShapeStyle(.separator), lineWidth: on ? 2 : 1)
                            }
                    }
                }
            }
        }
    }

    private func card(_ opt: BdFormField.ChoiceConfig.Option) -> some View {
        HStack(alignment: .top, spacing: 12) {
            if let img = opt.imageUrl, let url = BdFormRules.safeHTTPURL(img) {
                AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.secondary.opacity(0.15) }
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .accessibilityHidden(true)
            } else if let icon = opt.icon, !icon.isEmpty {
                BdIcon(icon, size: 24).foregroundStyle(.tint).frame(width: 32)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(opt.label).font(.body.weight(.semibold))
                    Spacer()
                    if let price = opt.price, !price.isEmpty {
                        Text(price).font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                    }
                }
                if let d = opt.description, !d.isEmpty {
                    Text(d).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                }
                if let href = BdFormRules.safeHTTPURL(opt.href) {
                    Button(strings.view) { openURL(href) }
                        .font(.subheadline)
                        .buttonStyle(.borderless)
                }
            }
        }
    }
}

// MARK: - Boolean

struct BdBooleanControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        BdCard {
            Toggle(isOn: Binding(get: { ctx.value == .bool(true) }, set: { ctx.set(.bool($0)); ctx.commit() })) {
                Text(ctx.field.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? strings.yesNo)
            }
        }
    }
}

// MARK: - Icon select

struct BdIconSelectControl: View {
    let ctx: BdFieldContext
    @State private var all: [String] = []
    @State private var query = ""
    @Environment(\.bdIconBaseURL) private var base
    @Environment(\.bdFormStrings) private var strings
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        let cfg = ctx.field.iconConfig
        let curated = cfg?.allowedIcons ?? []
        let current = ctx.value?.stringValue ?? ""
        let names: [String] = {
            let source = curated.isEmpty ? all : curated
            let q = query.trimmingCharacters(in: .whitespaces).lowercased()
            return Array((q.isEmpty ? source : source.filter { $0.contains(q) }).prefix(120))
        }()
        let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: max(cfg?.columns ?? 6, 2))

        BdCard {
            VStack(alignment: .leading, spacing: 10) {
                if curated.isEmpty {
                    TextField(strings.searchIcons, text: $query)
                        .bdKeyboard(.url)
                        .textFieldStyle(.roundedBorder)
                }
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(names, id: \.self) { name in
                        let on = name == current
                        Button { ctx.set(.string(on ? "" : name)); ctx.commit() } label: {
                            BdIcon(name, size: 22)
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .foregroundStyle(on ? AnyShapeStyle(.white) : AnyShapeStyle(.primary))
                                .background(on ? AnyShapeStyle(.tint) : AnyShapeStyle(.fill.tertiary),
                                            in: RoundedRectangle(cornerRadius: style.cornerRadius * 0.75))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(name.replacingOccurrences(of: "-", with: " "))
                        .accessibilityAddTraits(on ? [.isSelected] : [])
                    }
                }
                if !current.isEmpty {
                    HStack {
                        Text(current).font(.caption.monospaced()).foregroundStyle(.secondary)
                        Spacer()
                        Button(strings.clear) { ctx.set(.string("")) }.font(.caption).buttonStyle(.borderless)
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .task { if curated.isEmpty && all.isEmpty { all = await BdIconStore.shared.allNames(base: base) } }
    }
}

// MARK: - Services

struct BdServiceControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let cfg = ctx.field.serviceConfig
        let multi = cfg?.multi != false
        let picked = ctx.value?.stringArray ?? []
        BdRows {
            ForEach(cfg?.options ?? [], id: \.id) { opt in
                BdChoiceRow(selected: picked.contains(opt.id), multi: multi, action: {
                    let next = multi
                        ? (picked.contains(opt.id) ? picked.filter { $0 != opt.id } : picked + [opt.id])
                        : (picked == [opt.id] ? [] : [opt.id])
                    ctx.set(.array(next.map { .string($0) }))
                    ctx.commit()
                }) {
                    HStack {
                        Text(opt.title)
                        Spacer()
                        if let h = opt.estimatedHours, h > 0 {
                            Text("\(BdJS.string(h)) \(h == 1 ? strings.hour : strings.hours)").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Collection records

struct BdCollectionControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        let f = ctx.field
        let multi = f.collectionSelectConfig?.multi == true
        let state = ctx.controller.collectionOptions[f.id]
        Group {
            switch state {
            case .loaded(let records):
                let options = records.map { BdOption(value: $0.value, label: $0.label, image: $0.image) }
                let selection = Binding<[String]>(
                    get: { multi ? (ctx.value?.stringArray ?? []) : (ctx.value?.stringValue.flatMap { $0.isEmpty ? nil : [$0] } ?? []) },
                    set: { new in
                        ctx.set(multi ? .array(new.map { .string($0) }) : .string(new.first ?? ""))
                        ctx.commit()
                    }
                )
                if options.count > BdFormRules.searchableThreshold || f.display == "combobox" {
                    BdOptionPicker(
                        title: f.label,
                        placeholder: f.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? strings.select,
                        options: options, selection: selection, multi: multi, searchable: true
                    )
                } else {
                    BdRows {
                        ForEach(options) { o in
                            BdChoiceRow(selected: selection.wrappedValue.contains(o.value), multi: multi, action: {
                                let cur = selection.wrappedValue
                                selection.wrappedValue = multi
                                    ? (cur.contains(o.value) ? cur.filter { $0 != o.value } : cur + [o.value])
                                    : (cur == [o.value] ? [] : [o.value])
                            }) { BdOptionLabel(option: o) }
                        }
                    }
                }
            case .failed(let message):
                HStack {
                    Label(message, systemImage: "exclamationmark.triangle").foregroundStyle(style.errorColor)
                    Spacer()
                    Button(strings.retry) {
                        Task { await ctx.controller.reloadCollectionOptions(f.id) }
                    }
                    .buttonStyle(.borderless)
                }
            default:
                HStack(spacing: 8) {
                    ProgressView()
                    Text(strings.loadingOptions).foregroundStyle(.secondary)
                }
            }
        }
        .task { await ctx.controller.loadCollectionOptions(f.id) }
    }
}

// MARK: - Color

struct BdColorControl: View {
    let ctx: BdFieldContext
    @Environment(\.self) private var environment
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let current = ctx.value?.stringValue ?? ""
        let presets = ctx.field.options ?? []
        let isCustom = !current.isEmpty && !presets.contains { $0.caseInsensitiveCompare(current) == .orderedSame }
        BdCard {
            BdFlowLayout(spacing: 10) {
                ForEach(presets, id: \.self) { hex in
                    let on = hex.caseInsensitiveCompare(current) == .orderedSame
                    Button { ctx.set(.string(hex)); ctx.commit() } label: {
                        Circle()
                            .fill(BdColor.color(hex) ?? .clear)
                            .frame(width: 36, height: 36)
                            .overlay { Circle().strokeBorder(.separator, lineWidth: 1) }
                            .overlay {
                                if on { Image(systemName: "checkmark").font(.footnote.bold()).foregroundStyle(BdColor.contrasting(hex)) }
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(hex)
                    .accessibilityAddTraits(on ? [.isSelected] : [])
                }
                ColorPicker(
                    strings.customColor,
                    selection: Binding(
                        get: { BdColor.color(isCustom ? current : "#3B82F6") ?? .blue },
                        set: { ctx.set(.string(BdColor.hex($0, in: environment))); ctx.commit() }
                    ),
                    supportsOpacity: false
                )
                .labelsHidden()
                .frame(width: 36, height: 36)
                .overlay {
                    if isCustom { Circle().strokeBorder(.tint, lineWidth: 2).allowsHitTesting(false) }
                }
            }
            .padding(.vertical, 4)
        }
    }
}

enum BdColor {
    static func components(_ hex: String) -> (Double, Double, Double)? {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        return (Double((v >> 16) & 0xFF) / 255, Double((v >> 8) & 0xFF) / 255, Double(v & 0xFF) / 255)
    }

    static func color(_ hex: String) -> Color? {
        components(hex).map { Color(.sRGB, red: $0.0, green: $0.1, blue: $0.2) }
    }

    static func contrasting(_ hex: String) -> Color {
        guard let (r, g, b) = components(hex) else { return .primary }
        return (0.299 * r + 0.587 * g + 0.114 * b) > 0.6 ? .black : .white
    }

    static func hex(_ color: Color, in environment: EnvironmentValues) -> String {
        let cg = color.resolve(in: environment).cgColor
        let srgb = CGColorSpace(name: CGColorSpace.sRGB).flatMap {
            cg.converted(to: $0, intent: .defaultIntent, options: nil)
        } ?? cg
        let c = srgb.components ?? [0, 0, 0]
        func byte(_ i: Int) -> Int { Int((min(max(c[safe: i] ?? 0, 0), 1) * 255).rounded()) }
        return String(format: "#%02X%02X%02X", byte(0), byte(1), byte(2))
    }
}

// MARK: - Slider, ratings, stepper

struct BdSliderControl: View {
    let ctx: BdFieldContext

    var body: some View {
        let cfg = ctx.field.sliderConfig
        let lo = cfg?.min ?? 0
        let hi = max(cfg?.max ?? 100, lo + 1)
        let step = max(cfg?.step ?? 1, .ulpOfOne)
        let v = ctx.value?.doubleValue ?? lo
        func fmt(_ n: Double) -> String {
            switch cfg?.unit {
            case "currency": "$" + BdJS.string(n)
            case "percent": BdJS.string(n) + "%"
            default: BdJS.string(n)
            }
        }
        return BdCard {
            VStack(spacing: 6) {
                HStack {
                    Text(fmt(lo)).font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Text(fmt(v)).font(.headline.monospacedDigit())
                    Spacer()
                    Text(fmt(hi)).font(.caption).foregroundStyle(.secondary)
                }
                Slider(value: Binding(get: { v }, set: { ctx.set(.number(($0 / step).rounded() * step)) }), in: lo...hi, step: step) {
                    Text(ctx.field.label)
                } onEditingChanged: { editing in
                    if !editing { ctx.commit() }
                }
                .accessibilityValue(fmt(v))
            }
        }
    }
}

struct BdStarsControl: View {
    let ctx: BdFieldContext

    var body: some View {
        let max = Swift.max(ctx.field.starRatingConfig?.maxStars ?? 5, 1)
        let v = Int(ctx.value?.doubleValue ?? 0)
        BdCard {
            HStack(spacing: 6) {
                ForEach(1...max, id: \.self) { i in
                    Button { ctx.set(.number(Double(i))); ctx.commit() } label: {
                        Image(systemName: i <= v ? "star.fill" : "star")
                            .font(.title2)
                            .foregroundStyle(i <= v ? AnyShapeStyle(.yellow) : AnyShapeStyle(.tertiary))
                            .contentTransition(.symbolEffect(.replace))
                    }
                    .buttonStyle(.plain)
                    .accessibilityHidden(true)
                }
            }
            .accessibilityElement()
            .accessibilityLabel(ctx.field.label)
            .accessibilityValue("\(v) of \(max)")
            .accessibilityAdjustableAction { dir in
                switch dir {
                case .increment: ctx.set(.number(Double(Swift.min(v + 1, max))))
                case .decrement: ctx.set(.number(Double(Swift.max(v - 1, 1))))
                @unknown default: break
                }
            }
        }
    }
}

struct BdHappinessControl: View {
    let ctx: BdFieldContext
    static let faces = ["😞", "😕", "😐", "🙂", "😄"]
    static let names = ["Very unhappy", "Unhappy", "Neutral", "Happy", "Very happy"]

    var body: some View {
        let v = ctx.value?.doubleValue.map { Int($0) } ?? -1
        BdCard {
            HStack {
                ForEach(0..<5, id: \.self) { i in
                    Button { ctx.set(.number(Double(i))); ctx.commit() } label: {
                        Text(Self.faces[i])
                            .font(.largeTitle)
                            .padding(6)
                            .background(i == v ? AnyShapeStyle(.tint.opacity(0.2)) : AnyShapeStyle(.clear), in: Circle())
                            .scaleEffect(i == v ? 1.15 : 1)
                            .opacity(v < 0 || i == v ? 1 : 0.5)
                    }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(Self.names[i])
                    .accessibilityAddTraits(i == v ? [.isSelected] : [])
                }
            }
        }
    }
}

struct BdStepperControl: View {
    let ctx: BdFieldContext

    var body: some View {
        let v = ctx.value?.doubleValue ?? 0
        let lo = ctx.field.validation?.min ?? -1_000_000
        let hi = ctx.field.validation?.max ?? 1_000_000
        BdCard {
            Stepper(value: Binding(get: { v }, set: { ctx.set(.number($0)); ctx.commit() }), in: lo...max(hi, lo)) {
                Text(BdJS.string(v)).font(.body.monospacedDigit())
            }
            .accessibilityLabel(ctx.field.label)
        }
    }
}
