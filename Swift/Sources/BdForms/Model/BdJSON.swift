import Foundation

/// A form value: the JSON the BD form schema and submissions are made of.
///
/// A form answer is not one Swift type. A text field holds a string, a
/// checkbox group an array, an address an object, a rating a number, so values
/// travel as JSON and each element reads the shape it owns. Keeping the JSON
/// as JSON, rather than projecting it into per-field Swift types, is also what
/// lets a form gain an element the app was compiled without: the value
/// round-trips untouched.
public enum BdJSON: Sendable, Hashable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([BdJSON])
    case object([String: BdJSON])
}

// MARK: - Accessors

public extension BdJSON {
    var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    var doubleValue: Double? {
        if case .number(let n) = self { return n }
        return nil
    }

    var boolValue: Bool? {
        if case .bool(let b) = self { return b }
        return nil
    }

    var arrayValue: [BdJSON]? {
        if case .array(let a) = self { return a }
        return nil
    }

    var objectValue: [String: BdJSON]? {
        if case .object(let o) = self { return o }
        return nil
    }

    var isNull: Bool {
        if case .null = self { return true }
        return false
    }

    /// Strings of an array value, skipping anything that isn't a string.
    var stringArray: [String] {
        arrayValue?.compactMap(\.stringValue) ?? []
    }

    subscript(key: String) -> BdJSON? {
        objectValue?[key]
    }

    /// `true` for the values JS forms treat as "no answer": absent, `null`,
    /// and the empty string. An empty array is NOT empty by this rule; the
    /// per-element rules decide that.
    static func isBlank(_ value: BdJSON?) -> Bool {
        switch value {
        case nil, .null?: return true
        case .string(let s)?: return s.isEmpty
        default: return false
        }
    }
}

// MARK: - Literals

extension BdJSON: ExpressibleByStringLiteral, ExpressibleByIntegerLiteral,
    ExpressibleByFloatLiteral, ExpressibleByBooleanLiteral, ExpressibleByArrayLiteral,
    ExpressibleByDictionaryLiteral, ExpressibleByNilLiteral
{
    public init(stringLiteral value: String) { self = .string(value) }
    public init(integerLiteral value: Int) { self = .number(Double(value)) }
    public init(floatLiteral value: Double) { self = .number(value) }
    public init(booleanLiteral value: Bool) { self = .bool(value) }
    public init(arrayLiteral elements: BdJSON...) { self = .array(elements) }
    public init(dictionaryLiteral elements: (String, BdJSON)...) {
        self = .object(Dictionary(elements, uniquingKeysWith: { _, last in last }))
    }
    public init(nilLiteral: ()) { self = .null }
}

// MARK: - Codable

extension BdJSON: Codable {
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let b = try? c.decode(Bool.self) {
            self = .bool(b)
        } else if let n = try? c.decode(Double.self) {
            self = .number(n)
        } else if let s = try? c.decode(String.self) {
            self = .string(s)
        } else if let a = try? c.decode([BdJSON].self) {
            self = .array(a)
        } else {
            self = .object(try c.decode([String: BdJSON].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .number(let n):
            // Whole numbers encode as integers so a stepper's 3 reaches the
            // server as `3`, not `3.0`.
            if n.rounded() == n, abs(n) < 9.007_199_254_740_992e15 {
                try c.encode(Int64(n))
            } else {
                try c.encode(n)
            }
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }
}

// MARK: - JavaScript coercions

/// The handful of JavaScript coercions the BD form rules are written in terms
/// of. Conditions compare `String(value)`, numeric operators use `Number(x)`,
/// a calculation's display uses `toFixed`. Matching the server means matching
/// these exactly, including their odd corners (`String([1,2])` is `"1,2"`,
/// `Number("")` is `0`).
public enum BdJS {
    /// `String(value)` for a JSON value, the way the condition engine sees it.
    public static func string(_ value: BdJSON?) -> String {
        switch value {
        case nil, .null?: return ""
        case .bool(let b)?: return b ? "true" : "false"
        case .number(let n)?: return string(n)
        case .string(let s)?: return s
        case .array(let a)?:
            // Array.prototype.join: null/undefined become "", nested arrays
            // join recursively, objects are "[object Object]".
            return a.map { $0.isNull ? "" : string($0) }.joined(separator: ",")
        case .object?: return "[object Object]"
        }
    }

    /// `Number(value)` for a JSON value.
    public static func number(_ value: BdJSON?) -> Double {
        switch value {
        case nil: return .nan
        case .null?: return 0
        case .bool(let b)?: return b ? 1 : 0
        case .number(let n)?: return n
        case .string(let s)?: return number(s)
        case .array(let a)?:
            // ToPrimitive → join → Number: [] is 0, [x] is Number(x).
            return number(string(.array(a)))
        case .object?: return .nan
        }
    }

    /// `Number(string)`: StringToNumber, including hex/binary/octal literals,
    /// `Infinity`, surrounding whitespace, and `""` → 0.
    public static func number(_ raw: String) -> Double {
        let s = raw.trimmingCharacters(in: jsWhitespace)
        if s.isEmpty { return 0 }
        switch s {
        case "Infinity", "+Infinity": return .infinity
        case "-Infinity": return -.infinity
        default: break
        }
        let lower = s.lowercased()
        for (prefix, radix) in [("0x", 16), ("0b", 2), ("0o", 8)] where lower.hasPrefix(prefix) {
            let digits = s.dropFirst(2)
            guard !digits.isEmpty else { return .nan }
            var value = 0.0
            for ch in digits {
                guard let d = ch.hexDigitValue, d < radix else { return .nan }
                value = value * Double(radix) + Double(d)
            }
            return value
        }
        guard s.wholeMatch(of: decimalLiteral) != nil else { return .nan }
        return Double(s) ?? .nan
    }

    /// Number::toString(10): shortest round-trip digits, laid out with JS's
    /// thresholds for switching to exponent form (1e21 and 1e-7).
    public static func string(_ n: Double) -> String {
        if n.isNaN { return "NaN" }
        if n.isInfinite { return n > 0 ? "Infinity" : "-Infinity" }
        if n == 0 { return "0" }
        if n < 0 { return "-" + string(-n) }

        // Swift's description is the shortest round-trip form; decompose it
        // into digits + exponent, then re-lay it out the JS way.
        let (digits, exponent) = shortestDigits(n)
        let k = digits.count
        let point = exponent // value = 0.d1d2…dk × 10^point
        if k <= point && point <= 21 {
            return digits + String(repeating: "0", count: point - k)
        }
        if 0 < point && point <= 21 {
            let i = digits.index(digits.startIndex, offsetBy: point)
            return String(digits[..<i]) + "." + String(digits[i...])
        }
        if -6 < point && point <= 0 {
            return "0." + String(repeating: "0", count: -point) + digits
        }
        let e = point - 1
        let sign = e < 0 ? "-" : "+"
        let mantissa = k == 1 ? digits : String(digits.prefix(1)) + "." + String(digits.dropFirst())
        return "\(mantissa)e\(sign)\(abs(e))"
    }

    /// Number.prototype.toFixed: exact binary value, ties resolved upward
    /// (away from zero), and String(x) at or above 1e21.
    public static func toFixed(_ n: Double, _ decimals: Int) -> String {
        let places = max(0, min(100, decimals))
        if n.isNaN { return "NaN" }
        if n.isInfinite || abs(n) >= 1e21 { return string(n) }
        let x = abs(n)
        // `-0.0001` keeps its sign ("-0.00"); negative zero does not.
        let sign = n < 0 ? "-" : ""
        // printf rounds the exact binary value correctly except on an exact
        // tie, where it rounds half-to-even and JS rounds up. Print extra
        // digits to spot a true tie: a `5000…` tail only appears for a value
        // that is exactly halfway.
        let wide = String(format: "%.\(places + 30)f", x)
        if let dot = wide.firstIndex(of: ".") {
            let tailStart = wide.index(dot, offsetBy: places + 1)
            let tail = wide[tailStart...]
            if tail.first == "5" && tail.dropFirst().allSatisfy({ $0 == "0" }) {
                let kept = String(wide[..<(places == 0 ? dot : tailStart)])
                return sign + incrementLastDigit(kept)
            }
        }
        return sign + String(format: "%.\(places)f", x)
    }

    /// "0.12" → "0.13", "9.99" → "10.00", "99" → "100".
    private static func incrementLastDigit(_ s: String) -> String {
        var chars = Array(s)
        var i = chars.count - 1
        while i >= 0 {
            if chars[i] == "." { i -= 1; continue }
            if chars[i] == "9" {
                chars[i] = "0"
                i -= 1
            } else {
                chars[i] = Character(String(chars[i].wholeNumberValue! + 1))
                return String(chars)
            }
        }
        return "1" + String(chars)
    }

    /// JS `String.prototype.trim` whitespace.
    static let jsWhitespace: CharacterSet = {
        var set = CharacterSet.whitespacesAndNewlines
        set.insert(charactersIn: "\u{FEFF}\u{00A0}")
        return set
    }()

    nonisolated(unsafe) private static let decimalLiteral =
        #/[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/#

    private static func shortestDigits(_ n: Double) -> (String, Int) {
        // description: "123.45", "1e-07", "1.5e+21", "5e-324"
        let d = n.description
        var mantissa = d
        var exp = 0
        if let eIndex = d.firstIndex(where: { $0 == "e" || $0 == "E" }) {
            mantissa = String(d[..<eIndex])
            exp = Int(d[d.index(after: eIndex)...]) ?? 0
        }
        var intPart = mantissa
        var fracPart = ""
        if let dot = mantissa.firstIndex(of: ".") {
            intPart = String(mantissa[..<dot])
            fracPart = String(mantissa[mantissa.index(after: dot)...])
        }
        var digits = intPart + fracPart
        var point = intPart.count + exp
        // Strip leading zeros (0.0012 → "12", point shifts left).
        while digits.hasPrefix("0") && digits.count > 1 {
            digits.removeFirst()
            point -= 1
        }
        while digits.hasSuffix("0") && digits.count > 1 {
            digits.removeLast()
        }
        return (digits, point)
    }
}
