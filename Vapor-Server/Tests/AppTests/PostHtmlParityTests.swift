import Foundation
import Testing
@testable import App

/// `PostHtml.safe` must give what `safePostHtml` in the TypeScript starters
/// gives. Fixtures/post-html-parity.json holds the TypeScript's answers (the
/// same file the Laravel and Phoenix starters replay).
struct PostHtmlParityTests {
    struct Fixture: Decodable {
        struct Case: Decodable, CustomTestStringConvertible {
            let input: String
            let output: String
            var testDescription: String { input.debugDescription }
        }
        let cases: [Case]
    }

    static let cases: [Fixture.Case] = {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures/post-html-parity.json")
        guard let data = try? Data(contentsOf: url),
              let fixture = try? JSONDecoder().decode(Fixture.self, from: data) else { return [] }
        return fixture.cases
    }()

    @Test func fixtureLoads() {
        #expect(Self.cases.count >= 20)
    }

    @Test(arguments: cases)
    func matchesTypeScript(_ testCase: Fixture.Case) {
        #expect(PostHtml.safe(testCase.input) == testCase.output)
    }

    @Test func readingTimeAndDate() {
        #expect(PostHtml.readingMinutes("<p>" + String(repeating: "word ", count: 700) + "</p>") == 3)
        #expect(PostHtml.readingMinutes("") == 1)
        #expect(PostHtml.date("2026-11-18T15:00:00.000Z") == "November 18, 2026")
        #expect(PostHtml.date("2026-11-18") == "November 18, 2026")
        #expect(PostHtml.date("not a date") == "")
    }
}
