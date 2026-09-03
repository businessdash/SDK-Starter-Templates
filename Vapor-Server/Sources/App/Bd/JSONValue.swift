import Vapor

/// A decoded JSON value of unknown shape.
///
/// Two BD surfaces are schema-driven and genuinely can't be fixed structs,
/// because the org defines their shape in the dashboard: the **marketing
/// bundle**, and **custom-database records**. Everything else here is a real
/// type — reaching for `JSONValue` on a typed endpoint means the type is
/// wrong, not that the endpoint is dynamic.
enum JSONValue: Content, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let v = try? container.decode(Bool.self) { self = .bool(v) }
        else if let v = try? container.decode(Double.self) { self = .number(v) }
        else if let v = try? container.decode(String.self) { self = .string(v) }
        else if let v = try? container.decode([String: JSONValue].self) { self = .object(v) }
        else if let v = try? container.decode([JSONValue].self) { self = .array(v) }
        else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unrecognised JSON value.")
        }
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let v): try container.encode(v)
        case .number(let v): try container.encode(v)
        case .bool(let v): try container.encode(v)
        case .object(let v): try container.encode(v)
        case .array(let v): try container.encode(v)
        case .null: try container.encodeNil()
        }
    }

    /// Walk a key path. Returns nil for a missing key AND for an empty string,
    /// because those mean the same thing to a page: show the local fallback.
    /// An author who cleared a field wants the default back, not a blank
    /// heading.
    subscript(path: String...) -> JSONValue? { self[path] }

    subscript(path: [String]) -> JSONValue? {
        var current: JSONValue? = self
        for key in path {
            guard case .object(let dict)? = current else { return nil }
            current = dict[key]
        }
        if case .string(let s)? = current, s.isEmpty { return nil }
        if case .null? = current { return nil }
        return current
    }

    var stringValue: String? { if case .string(let v) = self { return v }; return nil }
    var boolValue: Bool? { if case .bool(let v) = self { return v }; return nil }
    var arrayValue: [JSONValue]? { if case .array(let v) = self { return v }; return nil }

    /// `bundle.string("sections", "hero", "headline") ?? "A business, in a box."`
    func string(_ path: String...) -> String? { self[path]?.stringValue }
}
