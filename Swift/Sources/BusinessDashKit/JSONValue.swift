import Foundation

/// A decoded JSON value of unknown shape.
///
/// Two BIAB surfaces are schema-driven and genuinely can't be modelled as
/// fixed structs, because the org defines their shape in the dashboard:
///
/// * the **marketing bundle** — whatever `biab.config.ts` declared
/// * **custom-database records** — whatever `biab.data-model.config.ts` declared
///
/// Everything else in this kit is a real struct. Reaching for `JSONValue` on a
/// typed endpoint means the struct is wrong, not that the endpoint is dynamic.
public enum JSONValue: Codable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unrecognised JSON value."
            )
        }
    }

    /// Re-encode a decoded value.
    ///
    /// Needed because JSON-LD arrives as `JSONValue` and has to go back out as
    /// a `<script type="application/ld+json">` payload. Decoding without being
    /// able to re-encode made the org's structured data unusable — it could be
    /// read, and not rendered.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

extension JSONValue {
    /// Walk a key path, e.g. `bundle["sections", "hero", "headline"]`.
    ///
    /// Returns `nil` for a missing key AND for an empty string, because those
    /// mean the same thing to a screen: show the local fallback. An author who
    /// cleared a field wants the default back, not a blank heading.
    public subscript(path: String...) -> JSONValue? {
        self[path]
    }

    public subscript(path: [String]) -> JSONValue? {
        var current: JSONValue? = self
        for key in path {
            guard case .object(let dictionary)? = current else { return nil }
            current = dictionary[key]
        }
        if case .string(let text)? = current, text.isEmpty { return nil }
        if case .null? = current { return nil }
        return current
    }

    public var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    public var doubleValue: Double? {
        if case .number(let value) = self { return value }
        return nil
    }

    public var intValue: Int? {
        if case .number(let value) = self { return Int(value) }
        return nil
    }

    public var boolValue: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }

    public var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    public var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    /// `bundle.string("sections", "hero", "headline") ?? "A business, in a box."`
    public func string(_ path: String...) -> String? {
        self[path]?.stringValue
    }
}
