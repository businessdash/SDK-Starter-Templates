import Foundation
import Testing
@testable import BdForms

/// A clock the test moves by hand.
final class TestClock: @unchecked Sendable {
    private let lock = NSLock()
    private var ms: Double
    init(_ ms: Double = 1_767_225_600_000) { self.ms = ms }
    func now() -> Double { lock.withLock { ms } }
    func advance(seconds: Double) { lock.withLock { ms += seconds * 1000 } }
}

/// Calls a fake BD received.
actor Calls {
    var log: [String] = []
    var lastAnswers: [String: BdJSON]?
    var lastIds: [String]?
    func add(_ s: String) { log.append(s) }
    func submitted(_ answers: [String: BdJSON], _ ids: [String]) {
        log.append("submit")
        lastAnswers = answers
        lastIds = ids
    }
}

func field(_ json: BdJSON) -> BdFormField { BdFormField.decode(json)! }

let capital = field([
    "id": "q_capital", "type": "radio", "label": "Capital of France?", "required": true,
    "options": ["Paris", "Lyon", "Nice"],
    "quizOptionIds": ["o_paris", "o_lyon", "o_nice"],
    "quizAnswerKey": ["answer": ["option_id": "o_paris"], "rationale": ["why_right": "Since 987."]],
])
let ocean = field([
    "id": "q_ocean", "type": "text", "label": "Largest ocean?",
    "quizAnswerKey": [
        "answer": ["text": "Pacific"],
        "additional_accepted_answers": [["text": "The Pacific Ocean"]],
    ],
])
let essay = field([
    "id": "q_essay", "type": "textarea", "label": "Explain photosynthesis.",
    "quizAnswerKey": ["answer": ["text": "Plants turn light into energy.", "validate_with_ai": true]],
])

/// Let queued main-actor work (a timed submit) run.
@MainActor
func settle(_ until: () -> Bool) async {
    for _ in 0..<200 where !until() {
        try? await Task.sleep(for: .milliseconds(5))
    }
}

func result(_ fieldId: String, _ status: String) -> BdQuizQuestionResult {
    try! JSONDecoder().decode(BdQuizQuestionResult.self, from: JSONEncoder().encode([
        "fieldId": .string(fieldId), "label": "Q", "status": .string(status),
        "pointsPossible": 1, "pointsEarned": status == "correct" ? 1 : 0,
        "correctAnswers": ["Paris"],
    ] as BdJSON))
}

func completion(_ results: [BdQuizQuestionResult] = []) -> BdQuizCompletion {
    BdQuizCompletion(
        status: "scored", results: results, pointsEarned: 1, pointsPossible: 2,
        scorePercent: 50, provisionalScorePercent: 50, passed: false
    )
}

@Suite("BdQuizController")
@MainActor
struct QuizControllerTests {
    @Test func localImmediateRunLocksChecksAndFinishes() async {
        let clock = TestClock()
        let quiz = BdQuizController(
            options: BdQuizOptions(fields: [capital, ocean], feedbackMode: .immediate),
            clock: clock.now
        )
        var done: [BdQuizCompletion] = []
        quiz.onDone = { done.append($0) }

        // Required: checking an empty answer shows the error.
        await quiz.advance()
        #expect(quiz.screen.questions.first?.error == "Capital of France? is required.")

        quiz.choose("q_capital", "Paris")
        await quiz.advance()
        #expect(quiz.screen.phase == .feedback)
        #expect(quiz.screen.feedback?.badge.label == "Correct")
        #expect(quiz.screen.questions[0].choices?.first?.state == .correct)
        // A locked answer can't change.
        quiz.choose("q_capital", "Lyon")
        #expect(quiz.state.answers["q_capital"] == "Paris")

        await quiz.advance()
        quiz.setAnswer("q_ocean", "  the pacific   ocean ")
        await quiz.advance()
        #expect(quiz.screen.feedback?.badge.label == "Correct")
        #expect(quiz.screen.actions.first?.id == .finish)

        await quiz.advance()
        #expect(quiz.screen.phase == .done)
        guard case .results(let r)? = quiz.screen.done else { Issue.record("no results"); return }
        #expect(r.score == "100%")
        #expect(r.tally == "2 / 2 correct")
        #expect(done.count == 1)
        #expect(quiz.screen.actions.map(\.id) == [.retake])
    }

    @Test func countdownSubmitsOnItsOwnAndKeepsAnswers() async {
        let clock = TestClock()
        let quiz = BdQuizController(
            options: BdQuizOptions(fields: [capital, ocean], timeLimitMinutes: 1),
            clock: clock.now
        )
        #expect(quiz.screen.phase == .ready)
        #expect(quiz.screen.ready?.body.hasPrefix("You have 1 minute.") == true)
        await quiz.start()
        #expect(quiz.screen.timer?.value == "1:00")

        quiz.choose("q_capital", "Paris")
        clock.advance(seconds: 30)
        quiz.tick()
        #expect(quiz.screen.timer?.value == "0:30")
        #expect(quiz.screen.timer?.warning == true)

        clock.advance(seconds: 31)
        quiz.tick()
        await settle { quiz.state.completion != nil }
        #expect(quiz.state.timeUp)
        guard case .results(let r)? = quiz.screen.done else { Issue.record("no results"); return }
        #expect(r.timing == "Time limit reached in 1:01")
        #expect(quiz.state.completion?.results.first?.status == .correct)
        #expect(quiz.state.completion?.results.last?.status == .incorrect)
    }

    @Test func openAnswersMatchAlternativesOrWaitForAI() {
        let score = BdQuizScoring.score(
            fields: [ocean, essay],
            answers: ["q_ocean": "<b>Pacific</b>", "q_essay": "Light makes sugar."],
            passingScore: 80
        )
        #expect(score.results[0].status == .correct)
        #expect(score.results[1].status == .pendingAi)
        #expect(score.status == "pending_ai_review")
        #expect(score.scorePercent == nil)
        #expect(score.provisionalScorePercent == 50)
    }

    @Test func invitedQuizUsesBDForEveryStep() async {
        let calls = Calls()
        let backend = BdQuizBackend(
            start: {
                await calls.add("start")
                return BdQuizStartInfo(startedAt: "2026-01-01T00:00:00.000Z", deadlineAt: nil, serverNow: 1_767_225_600_000)
            },
            saveDraft: { _ in await calls.add("draft") },
            lockAnswer: { id, _ in await calls.add("lock \(id)"); return result(id, "correct") },
            submit: { answers, ids in await calls.submitted(answers, ids); return completion() }
        )
        let quiz = BdQuizController(
            options: BdQuizOptions(fields: [capital, ocean], feedbackMode: .end, showTimer: true, local: false),
            backend: backend,
            draftDelay: .milliseconds(5)
        )
        await quiz.start()
        quiz.choose("q_capital", "Lyon")
        try? await Task.sleep(for: .milliseconds(60))
        await quiz.advance()
        quiz.setAnswer("q_ocean", "Atlantic")
        await quiz.advance()

        let log = await calls.log
        #expect(log.first == "start")
        #expect(log.contains("draft"))
        #expect(log.last == "submit")
        #expect(await calls.lastAnswers == ["q_capital": "Lyon", "q_ocean": "Atlantic"])
        #expect(await calls.lastIds == ["q_capital", "q_ocean"])
        // Not a local run: no retake.
        #expect(quiz.screen.actions.isEmpty)
    }

    @Test func bdErrorsShowBDsWordsAndOthersTheQuizs() async {
        let quiz = BdQuizController(
            options: BdQuizOptions(fields: [capital], feedbackMode: .immediate, local: false),
            backend: BdQuizBackend(
                lockAnswer: { _, _ in throw BdFormsError(status: 409, message: "That answer is already locked.") },
                submit: { _, _ in completion() }
            )
        )
        quiz.choose("q_capital", "Paris")
        await quiz.advance()
        #expect(quiz.screen.error == "That answer is already locked.")
        #expect(quiz.state.pending == nil)

        let offline = BdQuizController(
            options: BdQuizOptions(fields: [capital], feedbackMode: .immediate, local: false),
            backend: BdQuizBackend(
                lockAnswer: { _, _ in throw URLError(.notConnectedToInternet) },
                submit: { _, _ in completion() }
            )
        )
        offline.choose("q_capital", "Paris")
        await offline.advance()
        #expect(offline.screen.error == "Couldn't lock answer.")
    }

    @Test func practiceRunIsTimedHereAndCanBeRetaken() async {
        let clock = TestClock()
        let quiz = BdQuizController(
            options: BdQuizOptions(
                fields: [capital, ocean], feedbackMode: .end, showTimer: true,
                shuffleQuestions: true, local: true, canRestart: true
            ),
            backend: BdQuizBackend(submit: { _, ids in
                #expect(Set(ids) == ["q_capital", "q_ocean"])
                return completion()
            }),
            clock: clock.now
        )
        await quiz.start()
        for question in quiz.config.questions {
            if question.id == "q_capital" { quiz.choose(question.id, "Paris") } else { quiz.setAnswer(question.id, "Pacific") }
            clock.advance(seconds: 40)
            await quiz.advance()
        }
        #expect(quiz.state.completion?.durationSeconds == 80)
        #expect(quiz.state.completion?.timedOut == false)

        quiz.restart()
        #expect(quiz.state.completion == nil)
        #expect(quiz.state.answers.isEmpty)
        #expect(quiz.screen.phase == .ready)
    }

    @Test func dontKnowOnlyOnOptionalMultipleChoice() async {
        let optional = field([
            "id": "q_primes", "type": "checkbox", "label": "Primes?",
            "options": ["4", "7"], "quizOptionIds": ["o4", "o7"],
            "quizAnswerKey": ["answer": ["option_id": "o7"]],
        ])
        let quiz = BdQuizController(
            options: BdQuizOptions(fields: [capital, optional], feedbackMode: .immediate, allowDontKnow: true)
        )
        #expect(quiz.screen.questions[0].dontKnow == nil) // required
        quiz.choose("q_capital", "Nice")
        await quiz.advance()
        await quiz.advance()
        #expect(quiz.screen.questions[0].dontKnow?.label == "I don't know")
        quiz.chooseDontKnow("q_primes")
        #expect(quiz.state.answers["q_primes"] == [])
        await quiz.advance()
        #expect(quiz.screen.feedback?.badge.tone == .unsure)
        #expect(quiz.screen.feedback?.answer == "I don't know")
    }
}

// MARK: - The HTTP client

final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var requests: [URLRequest] = []
    nonisolated(unsafe) static var bodies: [Data] = []
    nonisolated(unsafe) static var respond: (URLRequest) -> (Int, BdJSON) = { _ in (200, [:]) }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requests.append(request)
        var body = request.httpBody ?? Data()
        if body.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let n = stream.read(&buffer, maxLength: buffer.count)
                if n <= 0 { break }
                body.append(buffer, count: n)
            }
            stream.close()
        }
        Self.bodies.append(body)
        let (status, json) = Self.respond(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: try! JSONEncoder().encode(json))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@Suite("BdQuizzes client", .serialized)
struct QuizClientTests {
    func session() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        return URLSession(configuration: config)
    }

    @Test func sendsTheKeyTheSessionAndThePackageAPIPaths() async throws {
        StubProtocol.requests = []
        StubProtocol.bodies = []
        StubProtocol.respond = { request in
            switch request.url!.absoluteString {
            case "https://bd.test/api/package/v1/quizzes/invitations/tok%2F1/lock":
                return (200, ["result": ["fieldId": "q", "label": "Q", "status": "correct", "pointsPossible": 1, "pointsEarned": 1]])
            case "https://bd.test/api/package/v1/quizzes/capitals/score":
                return (200, ["status": "scored", "results": [], "pointsEarned": 0, "pointsPossible": 0,
                              "scorePercent": 0, "provisionalScorePercent": 0, "passed": false])
            default:
                return (404, ["error": "not_found", "message": "This quiz invitation isn't valid."])
            }
        }
        let quizzes = BdQuizzes(
            host: URL(string: "https://bd.test")!, publishableKey: "pk_test", sessionToken: "sess_1", session: session()
        )
        // A token is one path segment, slashes and all (encodeURIComponent).
        let locked = try await quizzes.lockInvitationAnswer("tok/1", fieldId: "q", answer: "Paris")
        #expect(locked.status == .correct)

        let request = try #require(StubProtocol.requests.first)
        #expect(request.httpMethod == "POST")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer pk_test")
        #expect(request.value(forHTTPHeaderField: "X-BD-Session-Token") == "sess_1")
        let body = try JSONDecoder().decode(BdJSON.self, from: StubProtocol.bodies[0])
        #expect(body == ["fieldId": "q", "answer": "Paris"])

        _ = try await quizzes.scorePractice("capitals", answers: ["q": "x"], questionFieldIds: ["q"])
        let scoreBody = try JSONDecoder().decode(BdJSON.self, from: StubProtocol.bodies[1])
        #expect(scoreBody == ["answers": ["q": "x"], "questionFieldIds": ["q"]])

        await #expect(throws: BdFormsError.self) { try await quizzes.invitation("missing") }
        do {
            _ = try await quizzes.invitation("missing")
        } catch let error as BdFormsError {
            #expect(error.status == 404)
            #expect(error.message == "This quiz invitation isn't valid.")
        }

        // Signed out: no session header.
        _ = try? await quizzes.withSession(nil).invitation("x")
        #expect(StubProtocol.requests.last?.value(forHTTPHeaderField: "X-BD-Session-Token") == nil)
    }
}
