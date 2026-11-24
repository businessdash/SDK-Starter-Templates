import Foundation
import Testing
@testable import BdForms

/// Replays `quiz-parity.json`: quizzes run through the TypeScript forms-core
/// by `sdk/scripts/quiz-parity.ts`, with every screen and state TS produced.
/// The native quiz must show a taker exactly what the web quiz shows.
@Suite("Quiz parity with TypeScript forms-core")
struct QuizParityTests {
    static let fixtures: [String: BdJSON] = {
        let url = Bundle.module.url(forResource: "quiz-parity", withExtension: "json", subdirectory: "Fixtures")!
        return try! JSONDecoder().decode(BdJSON.self, from: Data(contentsOf: url)).objectValue!
    }()

    static func cases(_ key: String) -> [[String: BdJSON]] {
        fixtures[key]!.arrayValue!.map { $0.objectValue! }
    }

    static func decode<T: Decodable>(_ type: T.Type, _ json: BdJSON) throws -> T {
        try JSONDecoder().decode(type, from: JSONEncoder().encode(json))
    }

    static func json<T: Encodable>(_ value: T) throws -> BdJSON {
        try JSONDecoder().decode(BdJSON.self, from: JSONEncoder().encode(value))
    }

    /// JSON equality where a missing key equals `null` (TypeScript writes
    /// `null` where Swift leaves an optional out), with float tolerance.
    /// Returns the path of the first difference, or nil.
    static func diff(_ a: BdJSON?, _ b: BdJSON?, _ path: String = "$") -> String? {
        switch (a, b) {
        case (nil, nil), (nil, .null?), (.null?, nil), (.null?, .null?):
            return nil
        case (.number(let x)?, .number(let y)?):
            if x == y || abs(x - y) <= 1e-9 * max(abs(x), abs(y)) { return nil }
            return "\(path): \(x) ≠ \(y)"
        case (.array(let x)?, .array(let y)?):
            guard x.count == y.count else { return "\(path): \(x.count) items ≠ \(y.count)" }
            for (i, (l, r)) in zip(x, y).enumerated() {
                if let d = diff(l, r, "\(path)[\(i)]") { return d }
            }
            return nil
        case (.object(let x)?, .object(let y)?):
            for key in Set(x.keys).union(y.keys).sorted() {
                if let d = diff(x[key], y[key], "\(path).\(key)") { return d }
            }
            return nil
        default:
            return a == b ? nil : "\(path): \(String(describing: a)) ≠ \(String(describing: b))"
        }
    }

    /// The comparison forgives only missing-vs-null, never a real difference.
    @Test func diffCatchesDifferences() {
        #expect(Self.diff(["a": 1], ["a": 2]) != nil)
        #expect(Self.diff(["a": 1], [:]) != nil)
        #expect(Self.diff(["a": "x"], ["a": "y"]) != nil)
        #expect(Self.diff([1, 2], [1]) != nil)
        #expect(Self.diff(["a": ["b": true]], ["a": ["b": false]]) != nil)
        #expect(Self.diff(["a": nil], [:]) == nil)
    }

    @Test func wordsMatch() {
        let expected = Self.fixtures["words"]!.objectValue!
        var mine: [String: String] = [:]
        for child in Mirror(reflecting: BdQuizWords()).children {
            mine[child.label!] = child.value as? String
        }
        #expect(Set(mine.keys) == Set(expected.keys))
        for (key, value) in expected {
            #expect(mine[key] == value.stringValue, "word \(key)")
        }
    }

    @Test func seedHash() {
        for c in Self.cases("seedHash") {
            let text = c["text"]!.stringValue!
            #expect(Double(BdQuizArrange.seedHash(text)) == c["hash"]!.doubleValue!, "hash(\(text))")
        }
    }

    @Test func seededOrder() {
        for c in Self.cases("seededOrder") {
            let count = Int(c["count"]!.doubleValue!)
            let seed = c["seed"]!.stringValue!
            let expected = c["order"]!.arrayValue!.map { Int($0.doubleValue!) }
            #expect(BdQuizArrange.seededOrder(count, seed: seed) == expected, "order(\(count), \(seed))")
        }
    }

    @Test func durations() {
        for c in Self.cases("durations") {
            let seconds = c["seconds"]!.doubleValue!
            #expect(BdQuizEngine.durationLabel(seconds) == c["label"]!.stringValue!, "duration(\(seconds))")
        }
    }

    @Test func answerText() {
        for c in Self.cases("answerText") {
            #expect(BdQuizEngine.answerText(c["value"]) == c["text"]!.stringValue!, "answerText(\(String(describing: c["value"])))")
        }
    }

    @Test func scoring() throws {
        for c in Self.cases("scoring") {
            let fields = try Self.decode([BdFormField].self, c["fields"]!)
            let answers = c["answers"]?.objectValue ?? [:]
            let score = BdQuizScoring.score(fields: fields, answers: answers, passingScore: c["passingScore"]!.doubleValue!)
            let d = Self.diff(try Self.json(score), c["score"])
            #expect(d == nil, "scoring “\(c["name"]!.stringValue!)”: \(d ?? "")")
        }
    }

    struct PageInvitation: Decodable, BdQuizInvitationPageInfo {
        var name: String
        var description: String
        var estimatedMinutes: Double?
        var timeLimitMinutes: Double?
        var recipientName: String?
        var requireAuthentication: Bool
        var authenticationStatus: String
        var recipientEmailHint: String
        var status: String
        var expired: Bool
        var active: Bool
    }

    struct PagePractice: Decodable, BdQuizPageInfo {
        var name: String
        var description: String
        var estimatedMinutes: Double?
        var timeLimitMinutes: Double?
    }

    @Test func pages() throws {
        for c in Self.cases("pages") {
            let name = c["name"]!.stringValue!
            let page: BdQuizPage
            if let practice = c["practice"] {
                page = BdQuizPage.practice(try Self.decode(PagePractice.self, practice))
            } else {
                let links = c["links"]?.objectValue ?? [:]
                // Not `isNull ? nil : $0`: BdJSON is nil-literal-expressible,
                // so that `nil` would be `.null`.
                let invitation: BdJSON? = c["invitation"]?.isNull == false ? c["invitation"] : nil
                page = BdQuizPage.invitation(
                    try invitation.map { try Self.decode(PageInvitation.self, $0) },
                    signInHref: links["signInHref"]?.stringValue,
                    switchAccountHref: links["switchAccountHref"]?.stringValue
                )
            }
            let d = Self.diff(try Self.json(page), c["page"])
            #expect(d == nil, "page “\(name)”: \(d ?? "")")
        }
    }

    @Test func runs() throws {
        for run in Self.cases("runs") {
            let name = run["name"]!.stringValue!
            let options = try Self.decode(BdQuizOptions.self, run["options"]!)
            let config = BdQuizConfig(options, seed: run["seed"]!.stringValue!)
            let initial = try run["initial"].map { try Self.decode(BdQuizInitial.self, $0) } ?? BdQuizInitial()
            let start = run["start"]!.doubleValue!
            var state = BdQuizEngine.initialState(config, initial, now: start)
            let views = run["views"]!.arrayValue!
            let states = run["states"]!.arrayValue!

            func check(_ i: Int, _ at: Double) throws -> Bool {
                let screen = BdQuizEngine.screen(config, state, now: at)
                if let d = Self.diff(try Self.json(screen), views[i]) {
                    Issue.record("run “\(name)”, view \(i): \(d)")
                    return false
                }
                if let d = Self.diff(try Self.json(state), states[i]) {
                    Issue.record("run “\(name)”, state \(i): \(d)")
                    return false
                }
                return true
            }
            guard try check(0, start) else { continue }

            for (i, eventJSON) in run["events"]!.arrayValue!.enumerated() {
                let e = eventJSON.objectValue!
                let at = e["at"]!.doubleValue!
                switch e["do"]!.stringValue! {
                case "answer":
                    state = BdQuizEngine.setAnswer(config, state, fieldId: e["fieldId"]!.stringValue!, value: e["value"] ?? .null)
                case "dontKnow":
                    state = BdQuizEngine.chooseDontKnow(config, state, fieldId: e["fieldId"]!.stringValue!)
                case "back":
                    state = BdQuizEngine.back(config, state)
                case "start":
                    let info = try e["info"].map { try Self.decode(BdQuizStartInfo.self, $0) }
                    state = BdQuizEngine.started(state, info ?? BdQuizEngine.localStart(config, now: at), now: at)
                case "fail":
                    state = BdQuizEngine.failed(state, e["message"]!.stringValue!)
                case "view":
                    break
                case "advance":
                    let step = BdQuizEngine.advance(config, state, now: at)
                    state = step.state
                    switch step {
                    case .lock(_, let fieldId, let answer):
                        let given = try e["result"].map { try Self.decode(BdQuizQuestionResult.self, $0) }
                        if let result = given ?? BdQuizEngine.localResult(config, fieldId: fieldId, answer: answer) {
                            state = BdQuizEngine.locked(config, state, fieldId: fieldId, answer: answer, result: result, now: at)
                        } else {
                            state = BdQuizEngine.failed(state, config.words.unscorable)
                        }
                    case .submit(_, let answers):
                        let given = try e["completion"].map { try Self.decode(BdQuizCompletion.self, $0) }
                        state = BdQuizEngine.completed(state, given ?? BdQuizEngine.localCompletion(config, state, answers: answers, now: at))
                    case .none:
                        break
                    }
                case "tick":
                    if BdQuizEngine.deadlinePassed(config, state, now: at) {
                        let answers = state.answers
                        state = BdQuizEngine.timeUp(state)
                        let given = try e["completion"].map { try Self.decode(BdQuizCompletion.self, $0) }
                        state = BdQuizEngine.completed(state, given ?? BdQuizEngine.localCompletion(config, state, answers: answers, now: at))
                    }
                case let other:
                    Issue.record("run “\(name)”: unknown event \(other)")
                }
                guard try check(i + 1, at) else { break }
            }
        }
    }
}
