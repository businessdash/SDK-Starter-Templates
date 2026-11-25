import Foundation
import Testing
@testable import App

/// The product page rules (`Shop`) must give what `shop.ts` in the other BD
/// starters gives: the page is drawn here as it opens and `<bd-product-form>`
/// takes over in the browser with the TypeScript, so a disagreement would
/// make the price or photos jump once it loads. Fixtures/shop-parity.json
/// holds the TypeScript's answers (the same file the Laravel and Phoenix
/// starters replay).
struct ShopParityTests {
    static let cases: [JSONValue] = {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures/shop-parity.json")
        guard let data = try? Data(contentsOf: url),
              let fixture = try? JSONDecoder().decode(JSONValue.self, from: data),
              case .object(let root) = fixture,
              case .array(let cases)? = root["cases"] else { return [] }
        return cases
    }()

    @Test func fixtureLoads() {
        #expect(Self.cases.count >= 5)
    }

    @Test func theRulesAgreeWithTypeScript() throws {
        var failures: [String] = []
        func check(_ label: String, _ got: some Encodable, _ want: JSONValue?) throws {
            let encoded = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(got))
            if !Self.same(encoded, want) { failures.append("\(label)\n  gave \(encoded)\n  want \(want ?? .null)") }
        }

        for testCase in Self.cases {
            guard case .object(let c) = testCase else { continue }
            let view = Shop.productView(c["input"] ?? .null)
            let name = "\(c["input"].flatMap { field($0, "id") } ?? .null)"

            try check("productView \(name)", view, c["view"])
            try check("defaultVariant \(name)", Shop.defaultVariant(view)?.id, c["defaultVariant"])
            try check("allOptionGroups \(name)", Shop.allOptionGroups(view), c["allOptionGroups"])
            try check("photoSets \(name)", Shop.photoSets(view), c["photoSets"])
            let unknown = c["unknownVariant"]
            try check("galleryFor unknown \(name)", Shop.galleryFor(view, "nope"), unknown.flatMap { field($0, "gallery") })
            try check("priceFor unknown \(name)", Shop.priceFor(view, "nope"), unknown.flatMap { field($0, "price") })

            for variant in c["variants"]?.arrayValue ?? [] {
                let id = field(variant, "id")?.stringValue ?? ""
                let at = "\(name) variant \(id)"
                try check("galleryFor \(at)", Shop.galleryFor(view, id), field(variant, "gallery"))
                try check("optionGroupsFor \(at)", Shop.optionGroupsFor(view, id), field(variant, "groups"))
                for row in field(variant, "prices")?.arrayValue ?? [] {
                    var chosen: [String: String] = [:]
                    if case .object(let picks)? = field(row, "chosen") {
                        for (group, value) in picks { chosen[group] = value.stringValue }
                    }
                    let with = "\(at) chosen \(chosen)"
                    try check("priceFor \(with)", Shop.priceFor(view, id, chosen), field(row, "price"))
                    try check("productSummary \(with)", Shop.productSummary(view, id, chosen), field(row, "summary"))
                }
            }
        }
        #expect(failures.isEmpty, "\(failures.joined(separator: "\n"))")
    }

    @Test func reviewDates() {
        #expect(Shop.reviewDate("2026-03-04T12:00:00.000Z") == "Mar 4, 2026")
        #expect(Shop.reviewDate("2026-03-04T12:00:00Z") == "Mar 4, 2026")
        #expect(Shop.reviewDate("not a date") == "")
        #expect(Shop.reviewDate(nil) == "")
    }

    /// A member of an object as it is (`JSONValue`'s subscript reads "" as missing).
    private func field(_ value: JSONValue, _ key: String) -> JSONValue? {
        if case .object(let object) = value { return object[key] }
        return nil
    }

    /// JSON equality, numbers to within rounding; a missing key equals null.
    static func same(_ a: JSONValue?, _ b: JSONValue?) -> Bool {
        switch (a ?? .null, b ?? .null) {
        case (.null, .null): return true
        case let (.number(x), .number(y)): return x == y || abs(x - y) <= 1e-12 * max(abs(x), abs(y))
        case let (.string(x), .string(y)): return x == y
        case let (.bool(x), .bool(y)): return x == y
        case let (.array(x), .array(y)): return x.count == y.count && zip(x, y).allSatisfy { same($0, $1) }
        case let (.object(x), .object(y)): return Set(x.keys).union(y.keys).allSatisfy { same(x[$0], y[$0]) }
        default: return false
        }
    }
}
