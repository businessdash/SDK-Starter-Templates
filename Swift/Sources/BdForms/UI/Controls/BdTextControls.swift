import SwiftUI

struct BdTextControl: View {
    enum Kind { case text, email }
    let ctx: BdFieldContext
    let kind: Kind

    var body: some View {
        let f = ctx.field
        BdTextField(
            title: f.label,
            text: ctx.text,
            prompt: f.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? (kind == .email ? "you@example.com" : nil),
            keyboard: kind == .email ? .email : .text,
            autofill: BdFormRules.autocompleteToken(f),
            onCommit: ctx.commit
        )
    }
}

struct BdTextAreaControl: View {
    let ctx: BdFieldContext

    var body: some View {
        let rows = max(ctx.field.textareaConfig?.rows ?? 4, 1)
        BdTextField(
            title: ctx.field.label,
            text: ctx.text,
            prompt: ctx.field.placeholder,
            autofill: BdFormRules.autocompleteToken(ctx.field),
            axis: .vertical,
            lineLimit: rows...(ctx.field.textareaConfig?.resizable == true ? rows + 12 : rows + 4),
            onCommit: ctx.commit
        )
    }
}

struct BdPhoneControl: View {
    let ctx: BdFieldContext

    var body: some View {
        let intl = ctx.field.phoneConfig?.international == true
        let text = Binding(
            get: { BdFormRules.formatPhone(ctx.value?.stringValue ?? "", international: intl) },
            set: { ctx.set(.string(BdFormRules.formatPhone($0, international: intl))) }
        )
        HStack(spacing: 8) {
            if ctx.field.phoneConfig?.showFlags == true {
                Text("🇺🇸").accessibilityHidden(true)
            }
            BdTextField(
                title: ctx.field.label,
                text: text,
                prompt: ctx.field.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? (intl ? "+1 (555) 000-0000" : "(555) 000-0000"),
                keyboard: .phone,
                autofill: BdFormRules.autocompleteToken(ctx.field),
                onCommit: ctx.commit
            )
        }
    }
}

struct BdURLControl: View {
    let ctx: BdFieldContext

    var body: some View {
        let text = Binding(
            get: { ctx.value?["url"]?.stringValue ?? "" },
            set: { new in
                var o = ctx.value?.objectValue ?? [:]
                o["url"] = .string(new)
                ctx.set(.object(o))
            }
        )
        BdTextField(
            title: ctx.field.label,
            text: text,
            prompt: ctx.field.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? "https://example.com",
            keyboard: .url,
            autofill: BdFormRules.autocompleteToken(ctx.field),
            onCommit: ctx.commit
        )
    }
}

// MARK: - Numbers

/// A number typed as text: keeps what the visitor typed ("1.", "-") while
/// the value stays a number, and filters out what the field doesn't allow.
struct BdNumericField: View {
    let title: String
    let value: Double?
    var allowDecimal = true
    var allowNegative = true
    var prompt: String?
    let onChange: (Double?) -> Void
    var onCommit: () -> Void = {}

    @State private var text = ""

    var body: some View {
        BdTextField(
            title: title,
            text: $text,
            prompt: prompt,
            keyboard: allowNegative ? .signedDecimal : (allowDecimal ? .decimal : .integer),
            onCommit: onCommit
        )
        .monospacedDigit()
        .onAppear { text = Self.format(value) }
        .onChange(of: text) { _, typed in
            let clean = sanitize(typed)
            if clean != typed { text = clean; return }
            let n = Self.parse(clean)
            if n != value { onChange(n) }
        }
        .onChange(of: value) { _, v in
            if Self.parse(text) != v { text = Self.format(v) }
        }
    }

    func sanitize(_ s: String) -> String {
        var out = ""
        var sawDot = false
        for (i, c) in s.enumerated() {
            if c.isASCIIDigit { out.append(c); continue }
            if (c == "." || c == ","), allowDecimal, !sawDot { out.append("."); sawDot = true; continue }
            if c == "-", allowNegative, i == 0 { out.append(c) }
        }
        return out
    }

    static func parse(_ s: String) -> Double? {
        guard !s.isEmpty, s != "-", s != ".", s != "-." else { return nil }
        return Double(s)
    }

    static func format(_ v: Double?) -> String {
        guard let v, v.isFinite else { return "" }
        return BdJS.string(v)
    }
}

struct BdNumberControl: View {
    let ctx: BdFieldContext

    var body: some View {
        let f = ctx.field
        let allowDecimal = f.allowDecimal != false
        BdNumericField(
            title: f.label,
            value: ctx.value?.doubleValue,
            allowDecimal: allowDecimal,
            allowNegative: f.allowNegative != false,
            prompt: f.placeholder,
            onChange: { n in
                guard let n else { ctx.set(.null); return }
                ctx.set(.number(allowDecimal ? n : n.rounded(.towardZero)))
            },
            onCommit: ctx.commit
        )
    }
}

struct BdCurrencyControl: View {
    let ctx: BdFieldContext

    var body: some View {
        let cfg = ctx.field.currencyConfig
        let allowDecimal = cfg?.allowDecimal != false
        HStack(spacing: 6) {
            Text(cfg?.symbol.flatMap { $0.isEmpty ? nil : $0 } ?? "$")
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            BdNumericField(
                title: ctx.field.label,
                value: ctx.value?.doubleValue,
                allowDecimal: allowDecimal,
                allowNegative: cfg?.allowNegative == true,
                prompt: ctx.field.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? (allowDecimal ? "0.00" : "0"),
                onChange: { n in
                    guard let n else { ctx.set(.null); return }
                    ctx.set(.number(allowDecimal ? n : n.rounded(.towardZero)))
                },
                onCommit: ctx.commit
            )
        }
    }
}

struct BdMeasurementControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdRowMode) private var mode

    var body: some View {
        let cfg = ctx.field.unitConfig
        let cat = BdUnits.category(cfg?.category) ?? BdUnits.category("length")!
        let units = (cfg?.units?.isEmpty == false ? cfg!.units! : cat.units.map(\.symbol))
        let unit = ctx.value?["unit"]?.stringValue ?? cfg?.defaultUnit ?? units.first ?? cat.baseUnit
        let number = ctx.value?["value"]?.doubleValue
        let allowDecimal = cfg?.allowDecimal != false

        func emit(_ n: Double?, _ u: String) {
            var o: [String: BdJSON] = ["unit": .string(u), "baseUnit": .string(cat.baseUnit)]
            if let n {
                o["value"] = .number(n)
                if let base = BdUnits.convertToBase(n, unit: u, in: cat) { o["base"] = .number(base) }
            } else {
                o["value"] = ""
            }
            ctx.set(.object(o))
        }

        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                BdNumericField(
                    title: ctx.field.label,
                    value: number,
                    allowDecimal: allowDecimal,
                    allowNegative: cat.isAffine,
                    prompt: ctx.field.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? "0",
                    onChange: { emit($0.map { allowDecimal ? $0 : $0.rounded(.towardZero) }, unit) },
                    onCommit: ctx.commit
                )
                if cfg?.mode == "fixed" {
                    Text(unit).foregroundStyle(.secondary)
                } else {
                    Picker(ctx.field.label, selection: Binding(get: { unit }, set: { emit(number, $0) })) {
                        ForEach(units, id: \.self) { Text($0).tag($0) }
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .fixedSize()
                }
            }
            if let number {
                Text("≈ " + BdUnits.format(number, unit: unit, in: cat))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Name & address

struct BdNameControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings

    func part(_ key: String) -> Binding<String> {
        Binding(
            get: { ctx.value?[key]?.stringValue ?? ctx.value?[key]?.arrayValue.map { $0.compactMap(\.stringValue).joined(separator: ", ") } ?? "" },
            set: { new in
                var o = ctx.value?.objectValue ?? [:]
                o[key] = .string(new)
                ctx.set(.object(o))
            }
        )
    }

    var body: some View {
        let cfg = ctx.field.nameConfig
        let off = ctx.field.autocomplete == "off"
        let token: (String) -> String? = { off ? "off" : $0 }
        BdRows {
            if cfg?.prefix == true {
                BdSubField(label: strings.namePrefix, text: part("prefix"), placeholder: "Dr.", autofill: token("honorific-prefix"), onCommit: ctx.commit)
            }
            BdSubField(label: strings.firstName, text: part("first"), placeholder: "Jane", autofill: token("given-name"), onCommit: ctx.commit)
            if cfg?.middle == true {
                BdSubField(label: strings.middleName, text: part("middle"), placeholder: "Quinn", autofill: token("additional-name"), onCommit: ctx.commit)
            }
            BdSubField(label: strings.lastName, text: part("last"), placeholder: "Doe", autofill: token("family-name"), onCommit: ctx.commit)
            if cfg?.suffix == true {
                BdSubField(label: strings.nameSuffix, text: part("suffix"), placeholder: "Jr.", autofill: token("honorific-suffix"), onCommit: ctx.commit)
            }
            if cfg?.nicknames == true {
                BdSubField(label: strings.nicknames, text: part("nicknames"), placeholder: strings.nicknamesPlaceholder, autofill: off ? "off" : nil, onCommit: ctx.commit)
            }
        }
    }
}

struct BdAddressControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings

    func part(_ key: String, filter: ((String) -> String)? = nil) -> Binding<String> {
        Binding(
            get: { ctx.value?[key]?.stringValue ?? "" },
            set: { new in
                var o = ctx.value?.objectValue ?? [:]
                o[key] = .string(filter?(new) ?? new)
                ctx.set(.object(o))
            }
        )
    }

    var body: some View {
        let off = ctx.field.autocomplete == "off"
        let token: (String) -> String? = { off ? "off" : $0 }
        BdRows {
            BdSubField(label: strings.addressLine1, text: part("line1"), autofill: token("address-line1"), onCommit: ctx.commit)
            BdSubField(label: strings.addressLine2, text: part("line2"), autofill: token("address-line2"), onCommit: ctx.commit)
            BdSubField(label: strings.city, text: part("city"), autofill: token("address-level2"), onCommit: ctx.commit)
            BdOptionPicker(
                title: strings.state,
                placeholder: strings.selectState,
                options: BdFormsData.usStates.map { BdOption(value: $0.abbr, label: $0.name) },
                selection: Binding(
                    get: { ctx.value?["state"]?.stringValue.map { [$0] } ?? [] },
                    set: { new in
                        var o = ctx.value?.objectValue ?? [:]
                        o["state"] = .string(new.first ?? "")
                        ctx.set(.object(o))
                    }
                ),
                multi: false,
                showsTitle: true
            )
            BdSubField(
                label: strings.zip,
                text: part("zip", filter: { $0.filter { $0.isASCIIDigit || $0 == "-" } }),
                placeholder: "90210",
                keyboard: .zip,
                autofill: token("postal-code"),
                onCommit: ctx.commit
            )
        }
    }
}

// MARK: - Tags

struct BdTagsControl: View {
    let ctx: BdFieldContext
    @State private var draft = ""
    @Environment(\.bdFormStrings) private var strings

    var tags: [String] { ctx.value?.stringArray ?? [] }

    func add() {
        let parts = draft.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        guard !parts.isEmpty else { return }
        var next = tags
        for p in parts where !next.contains(p) { next.append(p) }
        ctx.set(.array(next.map { .string($0) }))
        draft = ""
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            BdTextField(
                title: ctx.field.label,
                text: $draft,
                prompt: ctx.field.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? strings.addTag,
                onCommit: { add(); ctx.commit() }
            )
            .onChange(of: draft) { _, t in if t.hasSuffix(",") { add() } }
            if !tags.isEmpty {
                BdFlowLayout(spacing: 6) {
                    ForEach(tags, id: \.self) { tag in
                        Button {
                            ctx.set(.array(tags.filter { $0 != tag }.map { .string($0) }))
                        } label: {
                            HStack(spacing: 4) {
                                Text(tag)
                                Image(systemName: "xmark").imageScale(.small)
                            }
                            .font(.subheadline)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(.fill.tertiary, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove \(tag)")
                    }
                }
            }
        }
    }
}
