import Foundation

/// A value problem found by the client-side validation walk.
public struct BdInvalidField: Sendable, Hashable {
    public let id: String
    public let label: String
    public let path: String
    public let reason: String
}

extension BdFormRules {
    // MARK: Whole-tree value validation

    /// Every visible, answered field whose value doesn't conform, walking the
    /// tree the way the required walk does (hidden blocks and pages are
    /// skipped; each repeater entry is checked field by field, so the error
    /// lands on the entry's own field rather than on the repeater).
    public static func findInvalidValues(
        _ fields: [BdFormField],
        _ data: [String: BdJSON],
        resolveMatch: ((BdConditionRule, BdJSON?) -> BdJSON?)? = nil
    ) -> [BdInvalidField] {
        let derived = withDerivedFieldValues(fields, deriveReferenceValues(fields, data))
        var out: [BdInvalidField] = []
        walkValues(fields, scope: derived, prefix: "", resolveMatch: resolveMatch, into: &out)
        return out
    }

    static func walkValues(
        _ nodes: [BdFormField],
        scope: [String: BdJSON],
        prefix: String,
        resolveMatch: ((BdConditionRule, BdJSON?) -> BdJSON?)?,
        into out: inout [BdInvalidField]
    ) {
        let resolve = resolver(scope, resolveMatch)
        for f in nodes {
            switch f.type {
            case "condition_block", "input_group", "flex_row", "or_condition":
                if f.type == "condition_block" {
                    guard evalCondition(f.conditionRule, resolve: resolve) else { continue }
                } else {
                    guard isNodeVisible(f, resolve: resolve) else { continue }
                }
                walkValues(f.children ?? [], scope: scope, prefix: prefix, resolveMatch: resolveMatch, into: &out)
            case "multi_populator":
                let instances = scope[f.id]?.arrayValue ?? []
                let max = min(f.populatorConfig?.maxInstances ?? 10, maxArrayLen)
                if instances.count > max {
                    out.append(.init(id: f.id, label: f.label, path: prefix + f.id, reason: "max"))
                }
                for (index, inst) in instances.enumerated() {
                    guard let o = inst.objectValue else { continue }
                    walkValues(f.children ?? [], scope: o, prefix: "\(prefix)\(f.id)[\(index)].", resolveMatch: resolveMatch, into: &out)
                }
            default:
                if BdFieldType.layoutOnly.contains(f.type) || f.type == "calculation" { continue }
                let value = scope[f.id]
                if isPendingUpload(value) { continue }
                if let reason = validateValue(f, value) ?? clientOnlyRule(f, value) {
                    out.append(.init(id: f.id, label: f.label, path: prefix + f.id, reason: reason))
                }
            }
        }
    }

    /// Checks the server doesn't make but a visitor should hear about: a
    /// range that ends before it starts.
    static func clientOnlyRule(_ field: BdFormField, _ value: BdJSON?) -> String? {
        switch field.type {
        case "date_range":
            guard let s = value?["start"]?.stringValue, let e = value?["end"]?.stringValue,
                  !s.isEmpty, !e.isEmpty else { return nil }
            if e < s { return "range_order" }
            if e == s && field.dateRangeConfig?.allowSameDay == false { return "range_same_day" }
            return nil
        case "time_picker" where field.timeConfig?.mode == "time_block":
            guard let s = value?["start"]?.stringValue, let e = value?["end"]?.stringValue,
                  !s.isEmpty, !e.isEmpty else { return nil }
            return e <= s ? "range_order" : nil
        default:
            return nil
        }
    }

    // MARK: Uploads

    /// A picked file waiting for submit. Stored in the value tree as a
    /// placeholder object so required checks and file counts see it, and
    /// swapped for the uploaded file (or image URL) on submit.
    public static func isPendingUpload(_ value: BdJSON?) -> Bool {
        value?["pending"] == .bool(true) && value?["localId"]?.stringValue != nil
    }

    static let iosImageTypes = ["image/heic", "image/heif"]
    static let iosVideoTypes = ["video/quicktime"]

    /// The author's allowed types, plus the formats iOS produces for them
    /// (a photo is HEIC, a video is QuickTime) so "images only" accepts a
    /// photo straight off the camera.
    public static func expandAllowedTypes(_ allowed: [String]) -> [String] {
        var out = allowed
        func add(_ t: String) { if !out.contains(t) { out.append(t) } }
        if allowed.contains(where: { $0 == "image/*" || ($0.hasPrefix("image/") && !$0.contains("heic")) }) {
            iosImageTypes.forEach(add)
            add(".heic")
            add(".heif")
        }
        if allowed.contains(where: { $0 == "video/*" || $0.hasPrefix("video/") }) {
            iosVideoTypes.forEach(add)
            add(".mov")
        }
        return out
    }

    public static func isFileTypeAllowed(name: String, mimeType: String, allowed: [String]?) -> Bool {
        guard let allowed, !allowed.isEmpty else { return true }
        let type = mimeType.lowercased()
        let ext = name.lastIndex(of: ".").map { name[$0...].lowercased() } ?? ""
        for raw in expandAllowedTypes(allowed) {
            let a = raw.lowercased().trimmingCharacters(in: .whitespaces)
            if a.isEmpty { continue }
            if a.hasPrefix(".") {
                if ext == a { return true }
                continue
            }
            if a.hasSuffix("/*") {
                if type.hasPrefix(String(a.dropLast())) { return true }
                continue
            }
            if !type.isEmpty && type == a { return true }
        }
        return false
    }

    /// Why a picked file is refused, or nil. Same wording as the web renderer.
    public static func fileProblem(name: String, mimeType: String, size: Int, allowed: [String]?, maxMB: Double?) -> String? {
        if !isFileTypeAllowed(name: name, mimeType: mimeType, allowed: allowed) {
            return "File type not allowed: \(mimeType.isEmpty ? name : mimeType)"
        }
        if let maxMB, maxMB > 0, Double(size) > maxMB * 1024 * 1024 {
            return "\"\(name)\" exceeds the \(BdJS.string(maxMB)) MB limit."
        }
        return nil
    }

    /// At most this many files across every file field in one submission.
    public static let formWideMaxFiles = 5

    // MARK: Autofill

    nonisolated(unsafe) static let autofillRules: [(Regex<AnyRegexOutput>, String)] = {
        let table: [(String, String)] = [
            (#"first[\s_-]?name|given[\s_-]?name"#, "given-name"),
            (#"last[\s_-]?name|family[\s_-]?name|surname"#, "family-name"),
            (#"full[\s_-]?name|your[\s_-]?name|^name$|contact[\s_-]?name"#, "name"),
            (#"company|organi[sz]ation|business[\s_-]?name|employer"#, "organization"),
            (#"job[\s_-]?title|position|occupation"#, "organization-title"),
            (#"web[\s_-]?site|homepage|\burl\b"#, "url"),
            (#"address[\s_-]?line[\s_-]?2|apartment|\bapt\b|\bsuite\b|\bunit\b"#, "address-line2"),
            (#"street|address[\s_-]?line[\s_-]?1|^address1?$|street[\s_-]?address"#, "street-address"),
            (#"\bcity\b|\btown\b"#, "address-level2"),
            (#"\bstate\b|province|region"#, "address-level1"),
            (#"\bzip\b|postal|post[\s_-]?code"#, "postal-code"),
            (#"\bcountry\b"#, "country-name"),
            (#"birth|\bdob\b"#, "bday"),
            (#"work[\s_-]?phone|office[\s_-]?phone|company[\s_-]?phone|mobile|cell"#, "tel"),
        ]
        return table.compactMap { pattern, token in
            (try? Regex(pattern)).map { ($0.ignoresCase(), token) }
        }
    }()

    /// The autofill token (HTML `autocomplete` vocabulary) a field should
    /// advertise: the author's explicit one, else one inferred from its type,
    /// key and label. The UI maps it to the platform's content types.
    public static func autocompleteToken(_ field: BdFormField) -> String? {
        if let explicit = field.autocomplete, !explicit.isEmpty { return explicit }
        switch field.type {
        case "email": return "email"
        case "phone": return "tel"
        case "url": return "url"
        default: break
        }
        let haystack = "\(field.key ?? "") \(field.label)"
        for (re, token) in autofillRules where haystack.firstMatch(of: re) != nil {
            return token
        }
        return nil
    }

    // MARK: Search

    /// Past this many options a dropdown grows a search box.
    public static let searchableThreshold = 10

    public static func shouldSearch(optionCount: Int, display: String?) -> Bool {
        display == "combobox" || optionCount > searchableThreshold
    }
}
