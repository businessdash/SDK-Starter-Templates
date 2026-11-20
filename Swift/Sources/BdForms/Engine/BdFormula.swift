import Foundation

/// BD's formula language, as used by `calculation` fields and business
/// functions: a port of forms-core's `formula.ts`.
///
/// Values are numbers, strings, booleans and objects (`addr.city`). Errors are
/// values too: a formula that divides by zero produces a result with an error
/// message, never a crash, and the message text matches the TS engine so the
/// same formula reports the same problem everywhere.
public enum BdFormula {
    public enum Result: Sendable, Hashable {
        case ok(BdJSON)
        case error(String)

        public var value: BdJSON? { if case .ok(let v) = self { return v } else { return nil } }
        public var errorMessage: String? { if case .error(let e) = self { return e } else { return nil } }
    }

    /// A business function callable from a formula by its upper-cased slug.
    public struct UserFunction: Sendable {
        let params: [String]
        let ast: Node
    }

    public struct Parsed: Sendable {
        let ast: Node
    }

    struct Failure: Error { let message: String }

    indirect enum Node: Sendable {
        case num(Double)
        case str(String)
        case bool(Bool)
        case variable(String)
        case member(Node, String)
        case unary(String, Node)
        case binary(String, Node, Node)
        case call(String, [Node])
    }

    // MARK: Public API

    public static func parse(_ src: String) throws -> Parsed {
        var parser = Parser(tokens: try tokenize(src))
        return Parsed(ast: try parser.parse())
    }

    public static func evaluate(
        _ parsed: Parsed,
        vars: [String: BdJSON?],
        functions: [String: UserFunction] = [:]
    ) -> Result {
        do {
            return .ok(try eval(parsed.ast, Ctx(vars: vars, fns: functions, stack: [])))
        } catch let f as Failure {
            return .error(f.message)
        } catch {
            return .error("Formula error.")
        }
    }

    public static func run(
        _ src: String,
        vars: [String: BdJSON?],
        functions: [String: UserFunction] = [:]
    ) -> Result {
        let parsed: Parsed
        do {
            parsed = try parse(src)
        } catch let f as Failure {
            return .error(f.message)
        } catch {
            return .error("Invalid formula.")
        }
        return evaluate(parsed, vars: vars, functions: functions)
    }

    /// Business functions as formula functions, keyed by upper-cased slug.
    /// Each one evaluates its first output. A function whose formula doesn't
    /// parse is left out rather than failing the form.
    public static func userFunctions(_ defs: [String: BdBusinessFunction]) -> [String: UserFunction] {
        var out: [String: UserFunction] = [:]
        for (name, def) in defs {
            guard let first = def.outputs.first, let parsed = try? parse(first.formula) else { continue }
            out[name] = UserFunction(params: def.inputs.map(\.key), ast: parsed.ast)
        }
        return out
    }

    // MARK: Tokenizer

    enum Tok: Equatable {
        case num(Double), str(String), ident(String), op(String)
        case lparen, rparen, comma, dot

        var kind: String {
            switch self {
            case .num: "num"
            case .str: "str"
            case .ident: "ident"
            case .op: "op"
            case .lparen: "lparen"
            case .rparen: "rparen"
            case .comma: "comma"
            case .dot: "dot"
            }
        }
    }

    static let multiOps = ["<=", ">=", "<>", "==", "!=", "&&", "||"]
    static let singleOps: Set<Character> = ["+", "-", "*", "/", "%", "^", "&", "<", ">", "=", "!"]

    static func tokenize(_ src: String) throws -> [Tok] {
        let s = Array(src)
        var toks: [Tok] = []
        var i = 0
        let n = s.count
        func isDigit(_ c: Character?) -> Bool { c.map { $0.isASCII && $0.isNumber } ?? false }
        func isIdentStart(_ c: Character) -> Bool { c.isASCII && (c.isLetter || c == "_") }
        func isIdentPart(_ c: Character) -> Bool { c.isASCII && (c.isLetter || c.isNumber || c == "_") }

        while i < n {
            let c = s[i]
            if c == " " || c == "\t" || c == "\n" || c == "\r" || c == "\r\n" {
                i += 1
                continue
            }
            if c == "\"" {
                var str = ""
                i += 1
                while i < n && s[i] != "\"" {
                    if s[i] == "\\" && i + 1 < n {
                        str.append(s[i + 1])
                        i += 2
                    } else {
                        str.append(s[i])
                        i += 1
                    }
                }
                if i >= n { throw Failure(message: "Unterminated string literal.") }
                i += 1
                toks.append(.str(str))
                continue
            }
            if isDigit(c) || (c == "." && isDigit(i + 1 < n ? s[i + 1] : nil)) {
                var j = i
                while j < n && (isDigit(s[j]) || s[j] == ".") { j += 1 }
                if j < n, s[j] == "e" || s[j] == "E", j + 1 < n {
                    j += 1
                    if s[j] == "+" || s[j] == "-" { j += 1 }
                    while j < n && isDigit(s[j]) { j += 1 }
                }
                let raw = String(s[i..<j])
                let value = BdJS.number(raw)
                if value.isNaN { throw Failure(message: "Invalid number \"\(raw)\".") }
                toks.append(.num(value))
                i = j
                continue
            }
            if isIdentStart(c) {
                var j = i
                while j < n && isIdentPart(s[j]) { j += 1 }
                toks.append(.ident(String(s[i..<j])))
                i = j
                continue
            }
            switch c {
            case "(": toks.append(.lparen); i += 1; continue
            case ")": toks.append(.rparen); i += 1; continue
            case ",": toks.append(.comma); i += 1; continue
            case ".": toks.append(.dot); i += 1; continue
            default: break
            }
            if i + 1 < n, multiOps.contains(String(s[i...i + 1])) {
                toks.append(.op(String(s[i...i + 1])))
                i += 2
                continue
            }
            if singleOps.contains(c) {
                toks.append(.op(String(c)))
                i += 1
                continue
            }
            throw Failure(message: "Unexpected character \"\(c)\".")
        }
        return toks
    }

    // MARK: Parser

    struct Parser {
        let tokens: [Tok]
        var pos = 0

        init(tokens: [Tok]) { self.tokens = tokens }

        func peek() -> Tok? { pos < tokens.count ? tokens[pos] : nil }

        mutating func next() -> Tok? {
            defer { pos += 1 }
            return peek()
        }

        mutating func eat(_ kind: String) throws -> Tok {
            guard let t = next(), t.kind == kind else { throw Failure(message: "Expected \(kind).") }
            return t
        }

        func isOp(_ v: String) -> Bool { peek() == .op(v) }

        func isIdent(_ v: String) -> Bool {
            if case .ident(let s)? = peek() { return s.uppercased() == v }
            return false
        }

        mutating func parse() throws -> Node {
            let node = try parseOr()
            if pos < tokens.count { throw Failure(message: "Unexpected trailing input.") }
            return node
        }

        mutating func parseOr() throws -> Node {
            var left = try parseAnd()
            while isOp("||") || isIdent("OR") {
                _ = next()
                left = .binary("OR", left, try parseAnd())
            }
            return left
        }

        mutating func parseAnd() throws -> Node {
            var left = try parseNot()
            while isOp("&&") || isIdent("AND") {
                _ = next()
                left = .binary("AND", left, try parseNot())
            }
            return left
        }

        mutating func parseNot() throws -> Node {
            if isOp("!") || isIdent("NOT") {
                _ = next()
                return .unary("NOT", try parseNot())
            }
            return try parseComparison()
        }

        mutating func parseComparison() throws -> Node {
            var left = try parseConcat()
            let cmp: Set<String> = ["=", "==", "<>", "!=", "<", ">", "<=", ">="]
            while case .op(let op)? = peek(), cmp.contains(op) {
                _ = next()
                left = .binary(op, left, try parseConcat())
            }
            return left
        }

        mutating func parseConcat() throws -> Node {
            var left = try parseAdd()
            while isOp("&") {
                _ = next()
                left = .binary("&", left, try parseAdd())
            }
            return left
        }

        mutating func parseAdd() throws -> Node {
            var left = try parseMul()
            while isOp("+") || isOp("-") {
                guard case .op(let op)? = next() else { break }
                left = .binary(op, left, try parseMul())
            }
            return left
        }

        mutating func parseMul() throws -> Node {
            var left = try parseUnary()
            while isOp("*") || isOp("/") || isOp("%") {
                guard case .op(let op)? = next() else { break }
                left = .binary(op, left, try parseUnary())
            }
            return left
        }

        mutating func parseUnary() throws -> Node {
            if isOp("-") || isOp("+") {
                guard case .op(let op)? = next() else { throw Failure(message: "Unexpected token.") }
                return .unary(op, try parseUnary())
            }
            return try parsePower()
        }

        mutating func parsePower() throws -> Node {
            let base = try parsePrimary()
            if isOp("^") {
                _ = next()
                return .binary("^", base, try parseUnary())
            }
            return base
        }

        mutating func parsePrimary() throws -> Node {
            var node = try parseAtom()
            while peek() == .dot {
                _ = next()
                guard case .ident(let key) = try eat("ident") else { throw Failure(message: "Expected ident.") }
                node = .member(node, key)
            }
            return node
        }

        mutating func parseAtom() throws -> Node {
            guard let t = peek() else { throw Failure(message: "Unexpected end of formula.") }
            switch t {
            case .num(let v):
                _ = next()
                return .num(v)
            case .str(let v):
                _ = next()
                return .str(v)
            case .lparen:
                _ = next()
                let inner = try parseOr()
                _ = try eat("rparen")
                return inner
            case .ident(let name):
                _ = next()
                let upper = name.uppercased()
                if upper == "TRUE" { return .bool(true) }
                if upper == "FALSE" { return .bool(false) }
                if peek() == .lparen {
                    _ = next()
                    var args: [Node] = []
                    if peek() != .rparen {
                        args.append(try parseOr())
                        while peek() == .comma {
                            _ = next()
                            args.append(try parseOr())
                        }
                    }
                    _ = try eat("rparen")
                    return .call(upper, args)
                }
                return .variable(name)
            default:
                throw Failure(message: "Unexpected token.")
            }
        }
    }

    // MARK: Coercion

    static func toNum(_ v: BdJSON) throws -> Double {
        switch v {
        case .number(let n): return n
        case .bool(let b): return b ? 1 : 0
        case .object, .array: throw Failure(message: "Cannot use an object as a number.")
        case .null: return 0
        case .string(let s):
            let n = BdJS.number(s)
            if n.isNaN { throw Failure(message: "\"\(s)\" is not a number.") }
            return n
        }
    }

    static func toBool(_ v: BdJSON) throws -> Bool {
        switch v {
        case .bool(let b): return b
        case .number(let n): return n != 0
        case .object, .array: throw Failure(message: "Cannot use an object as a boolean.")
        case .null: return false
        case .string(let s): return !s.isEmpty && s.lowercased() != "false"
        }
    }

    static func toStr(_ v: BdJSON) throws -> String {
        switch v {
        case .string(let s): return s
        case .object, .array: throw Failure(message: "Cannot use an object as text.")
        default: return BdJS.string(v)
        }
    }

    /// `Math.round`: halves round toward +∞.
    static func jsRound(_ x: Double) -> Double {
        if !x.isFinite { return x }
        let floor = x.rounded(.down)
        return x - floor >= 0.5 ? floor + 1 : floor
    }

    /// `**`: like `pow`, except `1 ** NaN` and `(±1) ** ±∞` are NaN.
    static func jsPow(_ base: Double, _ exp: Double) -> Double {
        if exp.isNaN { return .nan }
        if abs(base) == 1 && exp.isInfinite { return .nan }
        return Foundation.pow(base, exp)
    }

    /// `String.prototype.slice` over UTF-16 units.
    static func jsSlice(_ s: String, _ start: Double, _ end: Double? = nil) -> String {
        let units = Array(s.utf16)
        let len = Double(units.count)
        func clamp(_ v: Double) -> Int {
            if v.isNaN { return 0 }
            let t = v < 0 ? (v.rounded(.towardZero) == 0 ? 0 : max(len + v.rounded(.towardZero), 0)) : min(v.rounded(.towardZero), len)
            return Int(t)
        }
        let from = clamp(start)
        let to = end.map(clamp) ?? units.count
        guard from < to else { return "" }
        return String(decoding: units[from..<to], as: UTF16.self)
    }

    static func parseDate(_ v: BdJSON) throws -> Date {
        guard let d = BdDates.parse(v) else { throw Failure(message: "Invalid date.") }
        return d
    }

    static func ms(_ d: Date) -> Double { (d.timeIntervalSince1970 * 1000).rounded() }

    static func utcParts(_ d: Date) -> (year: Int, month: Int, day: Int) {
        let c = BdDates.utc.dateComponents([.year, .month, .day], from: d)
        return (c.year ?? 0, c.month ?? 1, c.day ?? 1)
    }

    static func monthsBetween(_ s: Date, _ e: Date) -> Double {
        let a = utcParts(s), b = utcParts(e)
        var m = (b.year - a.year) * 12 + (b.month - a.month)
        if b.day < a.day { m -= 1 }
        return Double(m)
    }

    static func yearsBetween(_ s: Date, _ e: Date) -> Double {
        let a = utcParts(s), b = utcParts(e)
        var y = b.year - a.year
        if let anniv = BdDates.utc.date(from: DateComponents(year: b.year, month: a.month, day: a.day)),
           ms(e) < ms(anniv)
        {
            y -= 1
        }
        return Double(y)
    }

    static let fileTypeByExt: [String: String] = {
        var out: [String: String] = [:]
        let table: [(String, [String])] = [
            ("image", ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "heic"]),
            ("video", ["mp4", "mov", "webm", "mkv", "avi"]),
            ("audio", ["mp3", "wav", "m4a", "flac", "ogg", "aac"]),
            ("pdf", ["pdf"]),
            ("doc", ["doc", "docx", "txt", "rtf", "md", "pages"]),
            ("spreadsheet", ["xls", "xlsx", "csv", "numbers"]),
            ("archive", ["zip", "rar", "7z", "tar", "gz"]),
        ]
        for (type, exts) in table { for e in exts { out[e] = type } }
        return out
    }()

    static func fileType(_ url: String) -> String {
        let path = (url.split(whereSeparator: { $0 == "?" || $0 == "#" }).first.map(String.init) ?? "")
            .trimmingCharacters(in: BdJS.jsWhitespace)
        guard let dot = path.lastIndex(of: ".") else { return "other" }
        return fileTypeByExt[path[path.index(after: dot)...].lowercased()] ?? "other"
    }

    /// One left-to-right pass, longest find first, so a replacement is never
    /// itself re-matched.
    static func substituteAll(_ text: String, _ pairs: [(String, String)]) -> String {
        let active = pairs.filter { !$0.0.isEmpty }
        if active.isEmpty { return text }
        let ordered = active.enumerated().sorted {
            $0.element.0.utf16.count != $1.element.0.utf16.count
                ? $0.element.0.utf16.count > $1.element.0.utf16.count
                : $0.offset < $1.offset
        }.map { (Array($0.element.0.utf16), Array($0.element.1.utf16)) }
        let units = Array(text.utf16)
        var out: [UInt16] = []
        var i = 0
        outer: while i < units.count {
            for (find, replace) in ordered where i + find.count <= units.count && Array(units[i..<i + find.count]) == find {
                out.append(contentsOf: replace)
                i += find.count
                continue outer
            }
            out.append(units[i])
            i += 1
        }
        return String(decoding: out, as: UTF16.self)
    }

    static func slugify(_ text: String) -> String {
        let decomposed = text.decomposedStringWithCompatibilityMapping
        let stripped = String(String.UnicodeScalarView(decomposed.unicodeScalars.filter { !(0x300...0x36F).contains($0.value) }))
        return stripped.lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .replacingOccurrences(of: "^-+|-+$", with: "", options: .regularExpression)
    }

    static func haversine(_ lat1: Double, _ lng1: Double, _ lat2: Double, _ lng2: Double, miles: Bool) -> Double {
        func rad(_ d: Double) -> Double { d * .pi / 180 }
        let dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1)
        let a = Foundation.pow(sin(dLat / 2), 2) + cos(rad(lat1)) * cos(rad(lat2)) * Foundation.pow(sin(dLng / 2), 2)
        let km = 2 * 6371 * asin(min(1, a.squareRoot()))
        return miles ? km * 0.621371 : km
    }

    // MARK: Functions

    struct FnDef: Sendable {
        let min: Int
        let max: Int?
        let fn: @Sendable ([BdJSON]) throws -> BdJSON
    }

    static func nums(_ a: [BdJSON]) throws -> [Double] { try a.map(toNum) }

    static func jsMin(_ xs: [Double]) -> Double {
        if xs.contains(where: \.isNaN) { return .nan }
        return xs.min() ?? .infinity
    }

    static func jsMax(_ xs: [Double]) -> Double {
        if xs.contains(where: \.isNaN) { return .nan }
        return xs.max() ?? -.infinity
    }

    static func strictEq(_ a: BdJSON, _ b: BdJSON) -> Bool {
        switch (a, b) {
        case (.number(let x), .number(let y)): return x == y
        default: return a == b
        }
    }

    static let functions: [String: FnDef] = [
        "SUM": FnDef(min: 1, max: nil) { .number(try nums($0).reduce(0, +)) },
        "PRODUCT": FnDef(min: 1, max: nil) { .number(try nums($0).reduce(1, *)) },
        "ABS": FnDef(min: 1, max: 1) { .number(abs(try toNum($0[0]))) },
        "ROUND": FnDef(min: 1, max: 2) { a in
            let f = jsPow(10, a.count > 1 ? try toNum(a[1]) : 0)
            return .number(jsRound(try toNum(a[0]) * f) / f)
        },
        "ROUNDUP": FnDef(min: 1, max: 2) { a in
            let f = jsPow(10, a.count > 1 ? try toNum(a[1]) : 0)
            return .number((try toNum(a[0]) * f).rounded(.up) / f)
        },
        "ROUNDDOWN": FnDef(min: 1, max: 2) { a in
            let f = jsPow(10, a.count > 1 ? try toNum(a[1]) : 0)
            return .number((try toNum(a[0]) * f).rounded(.towardZero) / f)
        },
        "CEILING": FnDef(min: 1, max: 1) { .number(try toNum($0[0]).rounded(.up)) },
        "FLOOR": FnDef(min: 1, max: 1) { .number(try toNum($0[0]).rounded(.down)) },
        "INT": FnDef(min: 1, max: 1) { .number(try toNum($0[0]).rounded(.towardZero)) },
        "MOD": FnDef(min: 2, max: 2) { .number(try toNum($0[0]).truncatingRemainder(dividingBy: try toNum($0[1]))) },
        "POWER": FnDef(min: 2, max: 2) { .number(jsPow(try toNum($0[0]), try toNum($0[1]))) },
        "SQRT": FnDef(min: 1, max: 1) { .number(try toNum($0[0]).squareRoot()) },
        "SIGN": FnDef(min: 1, max: 1) { a in
            let x = try toNum(a[0])
            return .number(x.isNaN ? .nan : x > 0 ? 1 : x < 0 ? -1 : x)
        },
        "EXP": FnDef(min: 1, max: 1) { .number(Foundation.exp(try toNum($0[0]))) },
        "LN": FnDef(min: 1, max: 1) { .number(Foundation.log(try toNum($0[0]))) },
        "LOG10": FnDef(min: 1, max: 1) { .number(Foundation.log10(try toNum($0[0]))) },
        "AVERAGE": FnDef(min: 1, max: nil) { a in .number(try nums(a).reduce(0, +) / Double(a.count)) },
        "MIN": FnDef(min: 1, max: nil) { .number(jsMin(try nums($0))) },
        "MAX": FnDef(min: 1, max: nil) { .number(jsMax(try nums($0))) },
        "MEDIAN": FnDef(min: 1, max: nil) { a in
            let s = try nums(a).sorted()
            let m = s.count / 2
            return .number(s.count % 2 == 1 ? s[m] : (s[m - 1] + s[m]) / 2)
        },
        "COUNT": FnDef(min: 1, max: nil) { a in
            .number(Double(a.filter { x in
                switch x {
                case .number: return true
                case .string(let s): return !s.trimmingCharacters(in: BdJS.jsWhitespace).isEmpty && !BdJS.number(s).isNaN
                default: return false
                }
            }.count))
        },
        "COUNTA": FnDef(min: 1, max: nil) { a in .number(Double(a.filter { $0 != .string("") && !$0.isNull }.count)) },
        "IF": FnDef(min: 2, max: 3) { a in try toBool(a[0]) ? a[1] : (a.count > 2 ? a[2] : .bool(false)) },
        "AND": FnDef(min: 1, max: nil) { a in .bool(try a.allSatisfy(toBool)) },
        "OR": FnDef(min: 1, max: nil) { a in .bool(try a.contains(where: toBool)) },
        "NOT": FnDef(min: 1, max: 1) { .bool(!(try toBool($0[0]))) },
        "XOR": FnDef(min: 1, max: nil) { a in .bool(try a.filter(toBool).count % 2 == 1) },
        "TRUE": FnDef(min: 0, max: 0) { _ in .bool(true) },
        "FALSE": FnDef(min: 0, max: 0) { _ in .bool(false) },
        "IFS": FnDef(min: 2, max: nil) { a in
            var i = 0
            while i + 1 < a.count {
                if try toBool(a[i]) { return a[i + 1] }
                i += 2
            }
            throw Failure(message: "No IFS condition matched.")
        },
        "CHOOSE": FnDef(min: 2, max: nil) { a in
            let idx = try toNum(a[0]).rounded(.towardZero)
            guard idx >= 0, idx < Double(a.count) else { throw Failure(message: "CHOOSE index out of range.") }
            return a[Int(idx)]
        },
        "SWITCH": FnDef(min: 3, max: nil) { a in
            var i = 1
            while i + 1 < a.count {
                if strictEq(a[i], a[0]) { return a[i + 1] }
                i += 2
            }
            return i < a.count ? a[i] : .bool(false)
        },
        "CONCATENATE": FnDef(min: 1, max: nil) { a in .string(try a.map(toStr).joined()) },
        "LEN": FnDef(min: 1, max: 1) { .number(Double(try toStr($0[0]).utf16.count)) },
        "LOWER": FnDef(min: 1, max: 1) { .string(try toStr($0[0]).lowercased()) },
        "UPPER": FnDef(min: 1, max: 1) { .string(try toStr($0[0]).uppercased()) },
        "SUBSTITUTE": FnDef(min: 3, max: nil) { a in
            let text = try toStr(a[0])
            let rest = Array(a.dropFirst())
            if rest.count % 2 != 0 {
                throw Failure(message: "SUBSTITUTE needs find/replace in pairs — it got an odd number of arguments after the text.")
            }
            var pairs: [(String, String)] = []
            var i = 0
            while i < rest.count {
                pairs.append((try toStr(rest[i]), try toStr(rest[i + 1])))
                i += 2
            }
            return .string(substituteAll(text, pairs))
        },
        "SLUGIFY": FnDef(min: 1, max: 1) { .string(slugify(try toStr($0[0]))) },
        "TRIM": FnDef(min: 1, max: 1) { .string(try toStr($0[0]).trimmingCharacters(in: BdJS.jsWhitespace)) },
        "LEFT": FnDef(min: 1, max: 2) { a in
            .string(jsSlice(try toStr(a[0]), 0, a.count > 1 ? try toNum(a[1]) : 1))
        },
        "RIGHT": FnDef(min: 1, max: 2) { a in
            let n = a.count > 1 ? try toNum(a[1]) : 1
            return .string(jsSlice(try toStr(a[0]), -n))
        },
        "MID": FnDef(min: 3, max: 3) { a in
            let start = try toNum(a[1]) - 1
            return .string(jsSlice(try toStr(a[0]), start, start + (try toNum(a[2]))))
        },
        "FILETYPE": FnDef(min: 1, max: 1) { .string(fileType(try toStr($0[0]))) },
        "TODAY": FnDef(min: 0, max: 0) { _ in .string(BdDates.ymd(Date())) },
        "YEAR": FnDef(min: 1, max: 1) { .number(Double(utcParts(try parseDate($0[0])).year)) },
        "MONTH": FnDef(min: 1, max: 1) { .number(Double(utcParts(try parseDate($0[0])).month)) },
        "DAY": FnDef(min: 1, max: 1) { .number(Double(utcParts(try parseDate($0[0])).day)) },
        "DAYS": FnDef(min: 2, max: 2) { a in
            .number(jsRound((ms(try parseDate(a[0])) - ms(try parseDate(a[1]))) / 86_400_000))
        },
        "NOW": FnDef(min: 0, max: 0) { _ in .string(BdDates.isoString(Date())) },
        "MINUTES": FnDef(min: 2, max: 2) { a in
            .number(jsRound((ms(try parseDate(a[1])) - ms(try parseDate(a[0]))) / 60_000))
        },
        "HOURS": FnDef(min: 2, max: 3) { a in
            let f = jsPow(10, a.count > 2 ? try toNum(a[2]) : 2)
            let h = (ms(try parseDate(a[1])) - ms(try parseDate(a[0]))) / 3_600_000
            return .number(jsRound(h * f) / f)
        },
        "WEEKS": FnDef(min: 2, max: 2) { a in
            .number(((ms(try parseDate(a[1])) - ms(try parseDate(a[0]))) / 604_800_000).rounded(.towardZero))
        },
        "MONTHS": FnDef(min: 2, max: 2) { a in .number(monthsBetween(try parseDate(a[0]), try parseDate(a[1]))) },
        "YEARS": FnDef(min: 2, max: 2) { a in .number(yearsBetween(try parseDate(a[0]), try parseDate(a[1]))) },
        "DATEDIFF": FnDef(min: 3, max: 3) { a in
            let unit = try toStr(a[0]).lowercased()
            let s = try parseDate(a[1]), e = try parseDate(a[2])
            let d = ms(e) - ms(s)
            switch unit {
            case "minutes": return .number(jsRound(d / 60_000))
            case "hours": return .number(jsRound(d / 3_600_000 * 100) / 100)
            case "days": return .number(jsRound(d / 86_400_000))
            case "weeks": return .number((d / 604_800_000).rounded(.towardZero))
            case "months": return .number(monthsBetween(s, e))
            case "years": return .number(yearsBetween(s, e))
            default: throw Failure(message: "Unknown DATEDIFF unit \"\(unit)\".")
            }
        },
        "DISTANCE": FnDef(min: 4, max: 5) { a in
            let miles = a.count > 4 ? (try toStr(a[4])).lowercased() == "mi" : false
            return .number(haversine(try toNum(a[0]), try toNum(a[1]), try toNum(a[2]), try toNum(a[3]), miles: miles))
        },
    ]

    // MARK: Evaluator

    struct Ctx {
        let vars: [String: BdJSON?]
        let fns: [String: UserFunction]
        let stack: Set<String>
    }

    static func eval(_ node: Node, _ ctx: Ctx) throws -> BdJSON {
        switch node {
        case .num(let v): return .number(v)
        case .str(let v): return .string(v)
        case .bool(let v): return .bool(v)
        case .variable(let name):
            guard let entry = ctx.vars[name], let v = entry, !v.isNull else {
                throw Failure(message: "Variable \"\(name)\" has no value.")
            }
            return v
        case .member(let objNode, let key):
            let obj = try eval(objNode, ctx)
            guard case .object(let o) = obj else {
                throw Failure(message: "Cannot read field \"\(key)\" of a non-object value.")
            }
            guard let v = o[key], !v.isNull else { throw Failure(message: "Field \"\(key)\" has no value.") }
            return v
        case .unary(let op, let arg):
            if op == "NOT" { return .bool(!(try toBool(try eval(arg, ctx)))) }
            let x = try toNum(try eval(arg, ctx))
            return .number(op == "-" ? -x : x)
        case .binary(let op, let l, let r):
            return try evalBinary(op, l, r, ctx)
        case .call(let name, let argNodes):
            if let def = functions[name] {
                let args = try argNodes.map { try eval($0, ctx) }
                if args.count < def.min || (def.max.map { args.count > $0 } ?? false) {
                    throw Failure(message: "\(name) got the wrong number of arguments.")
                }
                return try def.fn(args)
            }
            guard let user = ctx.fns[name] else { throw Failure(message: "Unknown function \"\(name)\".") }
            if ctx.stack.contains(name) { throw Failure(message: "Circular function reference: \"\(name)\".") }
            if argNodes.count != user.params.count {
                throw Failure(message: "\(name) expects \(user.params.count) argument(s).")
            }
            let args = try argNodes.map { try eval($0, ctx) }
            var scope: [String: BdJSON?] = [:]
            for (i, p) in user.params.enumerated() { scope[p] = args[i] }
            return try eval(user.ast, Ctx(vars: scope, fns: ctx.fns, stack: ctx.stack.union([name])))
        }
    }

    static func evalBinary(_ op: String, _ ln: Node, _ rn: Node, _ ctx: Ctx) throws -> BdJSON {
        if op == "AND" {
            guard try toBool(try eval(ln, ctx)) else { return .bool(false) }
            return .bool(try toBool(try eval(rn, ctx)))
        }
        if op == "OR" {
            if try toBool(try eval(ln, ctx)) { return .bool(true) }
            return .bool(try toBool(try eval(rn, ctx)))
        }
        let l = try eval(ln, ctx)
        let r = try eval(rn, ctx)
        switch op {
        case "+": return .number(try toNum(l) + toNum(r))
        case "-": return .number(try toNum(l) - toNum(r))
        case "*": return .number(try toNum(l) * toNum(r))
        case "/":
            let d = try toNum(r)
            if d == 0 { throw Failure(message: "Division by zero.") }
            return .number(try toNum(l) / d)
        case "%":
            let d = try toNum(r)
            if d == 0 { throw Failure(message: "Division by zero.") }
            return .number(try toNum(l).truncatingRemainder(dividingBy: d))
        case "^": return .number(jsPow(try toNum(l), try toNum(r)))
        case "&": return .string(try toStr(l) + toStr(r))
        case "=", "==": return .bool(try looseEq(l, r))
        case "<>", "!=": return .bool(!(try looseEq(l, r)))
        case "<": return .bool(try cmp(l, r) < 0)
        case ">": return .bool(try cmp(l, r) > 0)
        case "<=": return .bool(try cmp(l, r) <= 0)
        case ">=": return .bool(try cmp(l, r) >= 0)
        default: throw Failure(message: "Unknown operator \"\(op)\".")
        }
    }

    static func looseEq(_ l: BdJSON, _ r: BdJSON) throws -> Bool {
        if l.doubleValue != nil || r.doubleValue != nil {
            let a = BdJS.number(l), b = BdJS.number(r)
            if !a.isNaN && !b.isNaN { return a == b }
        }
        return try toStr(l) == toStr(r)
    }

    static func cmp(_ l: BdJSON, _ r: BdJSON) throws -> Double {
        if l.doubleValue != nil || r.doubleValue != nil {
            return try toNum(l) - toNum(r)
        }
        let a = Array(try toStr(l).utf16), b = Array(try toStr(r).utf16)
        return a.lexicographicallyPrecedes(b) ? -1 : (a == b ? 0 : 1)
    }
}
