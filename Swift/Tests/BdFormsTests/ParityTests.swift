import Foundation
import Testing
@testable import BdForms

/// Replays `forms-parity.json`: inputs run through the TypeScript forms-core
/// by `sdk/scripts/gen-native-forms.ts`, with the answers TS gave. Every case
/// here must agree, or the native renderer would tell a visitor something the
/// web renderer and the server don't.
@Suite("Parity with TypeScript forms-core")
struct ParityTests {
    static let fixtures: [String: BdJSON] = {
        let url = Bundle.module.url(forResource: "forms-parity", withExtension: "json", subdirectory: "Fixtures")!
        let data = try! Data(contentsOf: url)
        return try! JSONDecoder().decode(BdJSON.self, from: data).objectValue!
    }()

    static func cases(_ key: String) -> [[String: BdJSON]] {
        fixtures[key]!.arrayValue!.map { $0.objectValue! }
    }

    /// Undo the generator's `{ "$number": "NaN" }` tagging.
    static func untag(_ v: BdJSON?) -> BdJSON? {
        guard let v else { return nil }
        switch v {
        case .object(let o):
            if let tag = o["$number"]?.stringValue {
                return .number(tag == "NaN" ? .nan : tag == "Infinity" ? .infinity : -.infinity)
            }
            return .object(o.mapValues { untag($0)! })
        case .array(let a): return .array(a.map { untag($0)! })
        default: return v
        }
    }

    /// JSON equality with float tolerance (libm can differ in the last ulp).
    static func same(_ a: BdJSON?, _ b: BdJSON?) -> Bool {
        switch (a, b) {
        case (.number(let x)?, .number(let y)?):
            if x.isNaN || y.isNaN { return x.isNaN && y.isNaN }
            if x == y { return true }
            return abs(x - y) <= 1e-12 * max(abs(x), abs(y))
        case (.array(let x)?, .array(let y)?):
            return x.count == y.count && zip(x, y).allSatisfy { same($0, $1) }
        case (.object(let x)?, .object(let y)?):
            return x.keys.sorted() == y.keys.sorted() && x.allSatisfy { same($0.value, y[$0.key]) }
        case (nil, nil), (nil, .null?), (.null?, nil):
            return true
        default:
            return a == b
        }
    }

    @Test func numberToString() {
        for c in Self.cases("numberStrings") {
            let n = Self.untag(c["input"])!.doubleValue!
            #expect(BdJS.string(n) == c["output"]!.stringValue!, "String(\(n))")
        }
    }

    @Test func stringToNumber() {
        for c in Self.cases("numberParses") {
            let input = c["input"]!.stringValue!
            let expected = Self.untag(c["output"])!
            #expect(Self.same(.number(BdJS.number(input)), expected), "Number(\(input.debugDescription))")
        }
    }

    @Test func toFixed() {
        for c in Self.cases("toFixed") {
            let n = c["input"]!.doubleValue!
            let d = Int(c["decimals"]!.doubleValue!)
            #expect(BdJS.toFixed(n, d) == c["output"]!.stringValue!, "(\(n)).toFixed(\(d))")
        }
    }

    static func userFunctions(_ raw: BdJSON?) -> [String: BdFormula.UserFunction] {
        guard let defs = raw?.objectValue else { return [:] }
        var out: [String: BdBusinessFunction] = [:]
        for (name, def) in defs {
            let data = try! JSONEncoder().encode(def)
            struct Shape: Decodable { let inputs: [BdBusinessFunction.Input]; let outputs: [BdBusinessFunction.Output] }
            let shape = try! JSONDecoder().decode(Shape.self, from: data)
            out[name] = BdBusinessFunction(id: name, slug: name, inputs: shape.inputs, outputs: shape.outputs)
        }
        return BdFormula.userFunctions(out)
    }

    @Test func formulas() {
        for c in Self.cases("formula") {
            let src = c["src"]!.stringValue!
            let vars = (c["vars"]?.objectValue ?? [:]).mapValues { Optional($0) }
            let r = BdFormula.run(src, vars: vars, functions: Self.userFunctions(c["functions"]))
            let expected = c["result"]!.objectValue!
            if expected["ok"] == .bool(true) {
                #expect(Self.same(r.value, Self.untag(expected["value"])), "\(src) → \(String(describing: r))")
            } else {
                #expect(r.errorMessage == expected["error"]!.stringValue!, "\(src) → \(String(describing: r))")
            }
        }
    }

    @Test func conditions() throws {
        for c in Self.cases("conditions") {
            let rule = try JSONDecoder().decode(BdConditionRule.self, from: JSONEncoder().encode(c["rule"]!))
            let data: [String: BdJSON] = c["value"].map { ["a": $0] } ?? [:]
            let got = BdFormRules.evalCondition(rule, data: data)
            #expect(got == c["result"]!.boolValue!, "\(c["rule"]!) on \(String(describing: c["value"]))")
        }
    }

    @Test func validation() throws {
        for c in Self.cases("validation") {
            let field = try BdFormField.make(c["field"]!)
            let value = c["value"]
            #expect(BdFormRules.isEmpty(field, value) == c["empty"]!.boolValue!, "isEmpty \(field.type) \(String(describing: value))")
            #expect(BdFormRules.validateValue(field, value) == c["reason"]?.stringValue, "validate \(field.type) \(String(describing: value))")
        }
    }

    @Test func trees() throws {
        for c in Self.cases("trees") {
            let name = c["name"]!.stringValue!
            let fields = try c["fields"]!.arrayValue!.map { try BdFormField.make($0) }
            let data = c["data"]!.objectValue!
            let missing = BdFormRules.findMissingRequired(fields, data).map(\.id)
            #expect(missing == c["missing"]!.stringArray, "missing: \(name)")
            #expect(Self.same(.object(BdFormRules.seedInitialData(fields)), c["seed"]), "seed: \(name)")
            #expect(Self.same(.object(BdFormRules.toSubmissionPayload(fields, data)), c["payload"]), "payload: \(name)")
        }
    }

    @Test func units() {
        for c in Self.cases("units") {
            let cat = BdUnits.category(c["category"]!.stringValue!)!
            let value = c["value"]!.doubleValue!
            let unit = c["unit"]!.stringValue!
            let base = BdUnits.convertToBase(value, unit: unit, in: cat)
            #expect(Self.same(base.map { .number($0) }, c["base"]), "base \(value) \(unit)")
            let back = base.flatMap { BdUnits.convertFromBase($0, unit: unit, in: cat) }
            #expect(Self.same(back.map { .number($0) }, c["back"]), "back \(value) \(unit)")
            #expect(BdUnits.format(value, unit: unit, in: cat) == c["formatted"]!.stringValue!, "format \(value) \(unit)")
        }
    }

    static var fnDef: BdBusinessFunction {
        let raw = fixtures["fnDef"]!.objectValue!
        struct Shape: Decodable { let inputs: [BdBusinessFunction.Input]; let outputs: [BdBusinessFunction.Output] }
        let shape = try! JSONDecoder().decode(Shape.self, from: JSONEncoder().encode(BdJSON.object(raw)))
        return BdBusinessFunction(id: "fn1", slug: "quote", inputs: shape.inputs, outputs: shape.outputs)
    }

    @Test func calculations() throws {
        for c in Self.cases("calculations") {
            let config = try JSONDecoder().decode(
                BdFormField.CalculationConfig.self, from: JSONEncoder().encode(c["config"]!)
            )
            let values = c["values"]!.objectValue!
            let r = BdCalculation.compute(config, resolve: { values[$0] }, functionsById: ["fn1": Self.fnDef])
            let expected = c["result"]!.objectValue!
            #expect(r.ok == expected["ok"]!.boolValue!, "ok \(c["config"]!)")
            #expect(Self.same(r.value, expected["value"]), "value \(c["config"]!)")
            #expect(r.error == expected["error"]?.stringValue, "error \(c["config"]!)")
            if let outputs = expected["outputs"] {
                #expect(Self.same(r.outputs.map { .object($0) }, outputs), "outputs \(c["config"]!)")
            }
        }
    }

    @Test func businessFunctions() {
        for c in Self.cases("businessFunctions") {
            let inputs = c["inputs"]!.objectValue!.mapValues { Optional($0) }
            let r = BdCalculation.runFunction(Self.fnDef, inputs: inputs)
            let expected = c["result"]!.objectValue!
            #expect(r.ok == expected["ok"]!.boolValue!)
            #expect(Self.same(.object(r.outputs), expected["outputs"]), "outputs \(inputs)")
            let issues = expected["issues"]!.arrayValue!.map { i in
                "\(i["scope"]!.stringValue!)/\(i["key"]!.stringValue!): \(i["reason"]!.stringValue!)"
            }
            #expect(r.issues == issues, "issues \(inputs)")
        }
    }

    @Test func calcFormat() throws {
        for c in Self.cases("calcFormat") {
            let display = try JSONDecoder().decode(
                BdFormField.CalculationConfig.Display.self, from: JSONEncoder().encode(c["display"]!)
            )
            let value = c["value"].flatMap { $0.isNull ? nil : $0 }
            #expect(BdCalculation.format(value, display: display) == c["output"]!.stringValue!, "\(String(describing: value))")
        }
    }
}
