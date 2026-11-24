import BdForms
import Foundation
import Vapor

/// BusinessDash quizzes, rendered on this server, like `FormPage`.
///
/// The quiz BD's hosted /quiz-invite page shows — one question at a time with
/// lettered choices, "I don't know" when the quiz offers it, the verdict and
/// why after each answer (or all at the end), a timer, the results — driven by
/// the Swift SDK's own quiz engine (`BdQuizController`, in Sources/BdForms).
/// This file turns the engine's screen into HTML with the SDK's `bd-quiz__*`
/// classes; the grading, the clock and the wording are the engine's.
///
///     /quiz               BD_QUIZ (a practice quiz), or the bundled sample
///     /quiz/<slug>        any practice quiz ("Practice on your site" in BD)
///     /quiz/sample        the sample: graded here, never sent anywhere
///     /quiz-invite/<t>    an invitation. BD's invite emails link here when the
///                         quiz's invite domain (in the builder) is this site.
///
/// A run lives on this server between requests — its controller holds the
/// answers, the verdicts and the clock, and a timed quiz submits itself at
/// zero even if the page is closed. The page carries the run's id. Answers
/// post on change, buttons post their action, and a running clock is re-read
/// once a second. Without JavaScript it's plain form posts (the clock shows
/// the time at each page).
@MainActor
enum QuizPage {
    nonisolated static let sampleSlug = "sample"

    enum Source: Sendable, Equatable {
        case sample
        case practice(String)
        case invitation(String)

        /// Where its page and posts live.
        var path: String {
            switch self {
            case .sample: "/quiz/\(QuizPage.sampleSlug)"
            case .practice(let slug): "/quiz/\(slug.uriComponent)"
            case .invitation(let token): "/quiz-invite/\(token.uriComponent)"
            }
        }
    }

    /// What the visitor's request brings to a quiz that needs their account.
    struct Visitor: Sendable {
        /// The `bd_session` cookie: who's signed in, for invitations that need the invited account.
        var session: String?
        /// Where "Sign in" goes, coming back here.
        var signInHref: String
        /// Where "Sign out and switch account" goes.
        var switchAccountHref: String
    }

    struct Result: Sendable {
        var body: String
        var title: String
        /// A run to come back to on reload (practice and the sample).
        var runCookie: String?
    }

    // MARK: - Where a quiz comes from

    private struct Header {
        var eyebrow: String
        var title: String
        var description: String?
        var facts: [String]

        init(_ h: BdQuizPage.Header) {
            eyebrow = h.eyebrow; title = h.title; description = h.description; facts = h.facts
        }
    }

    /// A quiz that can't be taken here and now: invalid, expired, closed, or needs another account.
    private struct Gate {
        var kind: String
        var title: String?
        var body: String
        var actionLabel: String?
        var actionHref: String?

        init(kind: String, title: String? = nil, body: String, actionLabel: String? = nil, actionHref: String? = nil) {
            self.kind = kind; self.title = title; self.body = body; self.actionLabel = actionLabel; self.actionHref = actionHref
        }

        init(_ g: BdQuizPage.Gate) {
            self.init(kind: g.kind.rawValue, title: g.title, body: g.body, actionLabel: g.action?.label, actionHref: g.action?.href)
        }
    }

    private struct Loaded {
        var header: Header?
        var gate: Gate?
        var options: BdQuizOptions?
        var backend: BdQuizBackend?
        var initial = BdQuizInitial()
    }

    private struct SampleInfo: BdQuizPageInfo {
        let name = "Sample quiz"
        let description = "Bundled with the starter and graded on this server. Set BD_QUIZ and your BD keys to take one of your practice quizzes."
        let estimatedMinutes: Double? = 2
        let timeLimitMinutes: Double? = 5
    }

    private struct SampleFile: Decodable { let fields: [BdFormField] }

    /// The sample: answer keys and all, graded on this server.
    private static func sample() throws -> Loaded {
        let fields = try JSONDecoder().decode(SampleFile.self, from: Data(contentsOf: FormSamples.file("demo-quiz.json"))).fields
        return Loaded(
            header: BdQuizPage.practice(SampleInfo()).header.map(Header.init),
            options: BdQuizOptions(fields: fields, feedbackMode: .immediate, timeLimitMinutes: 5, allowDontKnow: true)
        )
    }

    /// BD's quizzes with this server's secret key, as the visitor (when signed in).
    static func client(_ bd: BdClient?, session: String?) -> BdQuizzes? {
        guard let bd, let endpoint = URL(string: bd.baseURL + "/quizzes") else { return nil }
        return BdQuizzes(endpoint: endpoint, headers: ["Authorization": "Bearer \(bd.apiKey)", "Origin": bd.origin])
            .withSession(session)
    }

    /// Read the quiz from BD (or the sample). A gate means there's nothing to take.
    private static func load(_ source: Source, visitor: Visitor, bd: BdClient?) async throws -> Loaded {
        let invalid = Loaded(gate: Gate(kind: "invalid", body: "This quiz doesn't exist or isn't open."))
        if case .sample = source { return try sample() }
        guard let quizzes = client(bd, session: visitor.session) else { return invalid }
        do {
            switch source {
            case .sample:
                return try sample()
            case .practice(let slug):
                let practice = try await quizzes.practice(slug)
                return Loaded(
                    header: BdQuizPage.practice(practice).header.map(Header.init),
                    options: BdQuizOptions(practice: practice),
                    backend: quizzes.practiceBackend(slug)
                )
            case .invitation(let token):
                let invitation = try await quizzes.invitation(token)
                let page = BdQuizPage.invitation(invitation, signInHref: visitor.signInHref, switchAccountHref: visitor.switchAccountHref)
                if let gate = page.gate { return Loaded(header: page.header.map(Header.init), gate: Gate(gate)) }
                return Loaded(
                    header: page.header.map(Header.init),
                    options: BdQuizOptions(invitation: invitation, signInHref: visitor.signInHref),
                    backend: quizzes.invitationBackend(token),
                    initial: BdQuizInitial(invitation: invitation)
                )
            }
        } catch let error as BdFormsError where error.status == 404 {
            // A quiz that doesn't exist (or isn't open); anything else may pass.
            if case .invitation = source, let gate = BdQuizPage.invitation(BdQuizInvitation?.none).gate {
                return Loaded(gate: Gate(gate))
            }
            return invalid
        }
    }

    // MARK: - Runs

    private final class Run {
        let id = UUID().uuidString.lowercased()
        let source: Source
        let header: Header?
        let controller: BdQuizController
        var touched = Date()

        init(source: Source, header: Header?, controller: BdQuizController) {
            self.source = source; self.header = header; self.controller = controller
        }
    }

    /// Runs in progress. A run nobody has touched for 3 hours goes.
    private static var runs: [String: Run] = [:]
    nonisolated static let runCookie = "bd_quiz_run"
    nonisolated static let runSeconds = 3 * 60 * 60

    private static func sweep() {
        let now = Date()
        for (id, run) in runs where now.timeIntervalSince(run.touched) > Double(runSeconds) {
            run.controller.stop()
            runs[id] = nil
        }
        while runs.count >= 500, let stalest = runs.values.min(by: { $0.touched < $1.touched }) {
            stalest.controller.stop()
            runs[stalest.id] = nil
        }
    }

    private static func findRun(_ id: String?, for source: Source? = nil) -> Run? {
        guard let id, let run = runs[id], source == nil || run.source == source else { return nil }
        run.touched = Date()
        return run
    }

    // MARK: - Requests

    /// The quiz's page content. A practice run or the sample picks up where this
    /// browser left off (`runCookie`); an invitation is read from BD each time —
    /// BD keeps its answers and clock.
    static func page(_ source: Source, visitor: Visitor, runCookie: String?, bd: BdClient?) async -> Result {
        if case .invitation = source {} else if let run = findRun(runCookie, for: source) {
            return Result(body: quizHtml(run), title: run.header?.title ?? "Quiz")
        }
        let loaded: Loaded
        do {
            loaded = try await load(source, visitor: visitor, bd: bd)
        } catch {
            return Result(body: statusHtml(source.path, "We couldn't load this quiz.", retry: true), title: "Quiz")
        }
        guard let options = loaded.options else {
            return Result(body: gateHtml(loaded.header, loaded.gate), title: loaded.header?.title ?? "Quiz")
        }
        sweep()
        let run = Run(
            source: source, header: loaded.header,
            controller: BdQuizController(options: options, backend: loaded.backend, initial: loaded.initial)
        )
        runs[run.id] = run
        let remember: Bool = if case .invitation = source { false } else { true }
        return Result(body: quizHtml(run), title: loaded.header?.title ?? "Quiz", runCookie: remember ? run.id : nil)
    }

    /// A post from the quiz: answers, and a button's action.
    static func handle(_ source: Source, post: FormPost, visitor: Visitor, bd: BdClient?) async -> Result {
        // The run is gone (the server restarted, or it sat for hours): start again.
        guard let run = findRun(post.text("_run"), for: source) else {
            return await page(source, visitor: visitor, runCookie: nil, bd: bd)
        }
        applyAnswers(run.controller, post)
        let action = post.text("_action")
        if !action.isEmpty { await perform(run.controller, action) }
        return Result(body: quizHtml(run), title: run.header?.title ?? "Quiz")
    }

    /// The clock, re-read: `/quiz-timer/<run>`, polled once a second while it
    /// runs. Once the time is up the run submits itself, and this answers with
    /// the whole quiz instead — sending, then the results (or why it couldn't
    /// send) — morphed into the page. Nil: the run is gone.
    static func timer(_ runId: String) -> (body: String, wholeQuiz: Bool, runId: String)? {
        guard let run = findRun(runId) else { return nil }
        run.controller.tick()
        let screen = run.controller.screen
        if screen.timer == nil || screen.phase == .done || run.controller.state.timeUp {
            return (quizHtml(run), true, run.id)
        }
        return (timerHtml(run, screen), false, run.id)
    }

    /// "I don't know" on a single-answer question: a choice in the same group.
    private static let dontKnowValue = "~dont-know"

    /// Each answer the page showed (and didn't lock) → the controller, when it changed.
    private static func applyAnswers(_ controller: BdQuizController, _ post: FormPost) {
        for question in controller.screen.questions where !question.locked {
            let id = question.field.id
            guard post.has("q.\(id).~") else { continue }
            let state = controller.state
            let wasDontKnow = state.dontKnow.contains(id)
            let current = state.answers[id]
            if question.choices != nil, question.multiple {
                let picked = post.texts("q.\(id)")
                let dontKnow = post.has("q.\(id).dk")
                let before = current?.arrayValue?.map { BdJS.string($0) } ?? []
                let answer = BdJSON.array(picked.map { .string($0) })
                if dontKnow, !wasDontKnow {
                    controller.chooseDontKnow(id)
                } else if wasDontKnow, !picked.isEmpty || !dontKnow {
                    controller.setAnswer(id, answer)
                } else if !wasDontKnow, picked.count != before.count || Set(picked) != Set(before) {
                    controller.setAnswer(id, answer)
                }
            } else if question.choices != nil {
                let picked = post.text("q.\(id)")
                if picked == dontKnowValue {
                    if !wasDontKnow { controller.chooseDontKnow(id) }
                } else if !picked.isEmpty, wasDontKnow || .string(picked) != current {
                    controller.setAnswer(id, .string(picked))
                }
            } else {
                let typed = post.text("q.\(id)")
                if typed != (current.map { BdJS.string($0) } ?? "") { controller.setAnswer(id, .string(typed)) }
            }
        }
    }

    /// A button: one of the screen's actions, or "primary" (Enter in a box).
    private static func perform(_ controller: BdQuizController, _ action: String) async {
        let actions = controller.screen.actions.filter { $0.enabled && $0.href == nil }
        let chosen = action == "primary" ? actions.first { $0.primary } : actions.first { $0.id.rawValue == action }
        if let chosen { await controller.perform(chosen.id) }
    }

    // MARK: - Rendering

    private static func headerHtml(_ h: Header?) -> String {
        guard let h else { return "" }
        let facts = h.facts.isEmpty ? "" : "<ul class=\"bd-quiz__facts\">\(h.facts.map { "<li>\($0.html)</li>" }.joined())</ul>"
        return """
        <header class="bd-quiz__header"><p class="bd-quiz__eyebrow">\(h.eyebrow.html)</p><h2 class="bd-quiz__title">\(h.title.html)</h2>\
        \(h.description.map { "<p class=\"bd-quiz__description\">\($0.html)</p>" } ?? "")\(facts)</header>
        """
    }

    private static func gateHtml(_ header: Header?, _ gate: Gate?) -> String {
        let body = gate.map { g in
            let action = g.actionHref.map { "<div class=\"bd-quiz__actions\"><a class=\"bd-quiz__button bd-quiz__button--primary\" href=\"\($0.html)\">\((g.actionLabel ?? "Continue").html)</a></div>" } ?? ""
            return "<div class=\"bd-quiz__gate\" data-kind=\"\(g.kind)\">\(g.title.map { "<h3>\($0.html)</h3>" } ?? "")<p>\(g.body.html)</p>\(action)</div>"
        } ?? ""
        return "<div class=\"bd-quiz\">\(headerHtml(header))\(body)</div>"
    }

    private static func statusHtml(_ path: String, _ text: String, retry: Bool) -> String {
        let action = retry ? "<div class=\"bd-quiz__actions\"><a class=\"bd-quiz__button\" href=\"\(path.html)\">Try again</a></div>" : ""
        return "<div class=\"bd-quiz\"><div class=\"bd-quiz__status\"><p>\(text.html)</p>\(action)</div></div>"
    }

    /// The quiz: a form that posts its answers and buttons back here.
    private static func quizHtml(_ run: Run) -> String {
        let screen = run.controller.screen
        let path = run.source.path.html
        let primary = screen.actions.first { $0.primary && $0.enabled && $0.href == nil }
        // The form posts its buttons and the div inside posts each change, as
        // in FormPage: a change post never carries the last button clicked.
        return """
        <form class="bd-quiz" id="bd-quiz-\(run.id)" data-phase="\(screen.phase.rawValue)"\(screen.busy ? " aria-busy=\"true\"" : "")
          method="post" action="\(path)" novalidate
          hx-post="\(path)" hx-trigger="submit" hx-target="this" hx-ext="morph" hx-swap="morph:{ignoreActiveValue:true}" hx-sync="this:replace">
          <input type="hidden" name="_run" value="\(run.id)" />
          \(primary.map { "<button class=\"bd-quiz__default\" type=\"submit\" name=\"_action\" value=\"primary\" tabindex=\"-1\" aria-hidden=\"true\">\($0.label.html)</button>" } ?? "")
          \(headerHtml(run.header))
          <div class="bd-quiz__live" hx-post="\(path)" hx-trigger="change" hx-target="closest form" hx-sync="closest form:replace">
          \(bodyHtml(run, screen))
          </div>
        </form>
        """
    }

    private static func bodyHtml(_ run: Run, _ s: BdQuizScreen) -> String {
        let error = s.error.map { "<p class=\"bd-quiz__error\" role=\"alert\">\($0.html)</p>" } ?? ""
        switch s.phase {
        case .empty:
            return "<p class=\"bd-quiz__status\">\((s.empty ?? "").html)</p>"
        case .ready:
            guard let ready = s.ready else { break }
            return "<div class=\"bd-quiz__ready\" data-icon=\"\(ready.icon.html)\"><h3>\(ready.title.html)</h3><p>\(ready.body.html)</p>\(actionsHtml(s))\(error)</div>"
        case .done:
            switch s.done {
            case .results(let done)?:
                let items = done.items.map { item in
                    """
                    <li data-tone="\(item.tone.rawValue)"><details class="bd-quiz__review-item"><summary class="bd-quiz__review-label">\
                    <span class="bd-quiz__number">\(item.number).</span>\(item.label.html)<span class="bd-quiz__badge" data-tone="\(item.feedback.badge.tone.rawValue)">\(item.feedback.badge.label.html)</span></summary>\
                    \(feedbackHtml(item.feedback))</details></li>
                    """
                }.joined()
                return """
                <section class="bd-quiz__results"\(done.passed == true ? " data-passed" : "")><p class="bd-quiz__eyebrow">\(done.eyebrow.html)</p>\
                <p class="bd-quiz__score">\(done.score.html)</p>\(done.tally.map { "<p class=\"bd-quiz__tally\">\($0.html)</p>" } ?? "")\
                <p class="bd-quiz__summary">\(done.summary.html)</p>\(done.message.map { "<p class=\"bd-quiz__message\">\($0.html)</p>" } ?? "")\
                \(done.timing.map { "<p class=\"bd-quiz__timing\">\($0.html)</p>" } ?? "")</section>\
                <ol class="bd-quiz__review">\(items)</ol>\(actionsHtml(s))
                """
            case .submitted(let m)?, .locked(let m)?:
                let kind = if case .locked? = s.done { "locked" } else { "submitted" }
                return "<div class=\"bd-quiz__done\" data-kind=\"\(kind)\"><p class=\"bd-quiz__eyebrow\">\(m.eyebrow.html)</p><h3>\(m.title.html)</h3><p>\(m.body.html)</p>\(actionsHtml(s))</div>"
            case nil:
                break
            }
        default:
            break
        }
        let progress = s.progress.map { p in
            """
            <div class="bd-quiz__progress"><div class="bd-quiz__progress-row"><span>\(p.position.html)</span>\(p.note.map { "<span>\($0.html)</span>" } ?? "")</div>\
            <div class="bd-quiz__progress-bar" aria-hidden="true"><span style="width:\(percent(p.percent))%"></span></div></div>
            """
        } ?? ""
        return """
        \(timerHtml(run, s))\(progress)\(s.notice.map { "<p class=\"bd-quiz__notice\">\($0.html)</p>" } ?? "")\
        \(s.questions.map { questionHtml($0, s) }.joined())\(s.feedback.map(feedbackHtml) ?? "")\(error)\(actionsHtml(s))
        """
    }

    private static func percent(_ value: Double) -> String { BdJS.string(.number((value * 10).rounded() / 10)) }

    /// The clock. While it runs — and after time's up, until the quiz has sent —
    /// htmx re-reads it once a second (`timer`).
    private static func timerHtml(_ run: Run, _ s: BdQuizScreen) -> String {
        guard let timer = s.timer else { return "" }
        let state = run.controller.state
        let polling = !state.timeUp || state.pending != nil
        let poll = polling ? " hx-get=\"/quiz-timer/\(run.id)\" hx-trigger=\"every 1s\" hx-target=\"this\" hx-swap=\"outerHTML\" hx-sync=\"this:drop\"" : ""
        return """
        <div class="bd-quiz__timer" id="bd-quiz-timer-\(run.id)"\(flag(timer.warning, "data-warning"))\(flag(timer.paused, "data-paused")) role="timer"\(poll)>\
        <span class="bd-quiz__timer-label">\(timer.label.html)\(timer.paused ? "<span class=\"bd-quiz__paused\">\(timer.pausedLabel.html)</span>" : "")</span>\
        <span class="bd-quiz__timer-value">\(timer.value.html)</span>\
        \(timer.progress.map { "<span class=\"bd-quiz__timer-bar\" style=\"width:\(percent($0))%\"></span>" } ?? "")</div>
        """
    }

    private static func actionsHtml(_ s: BdQuizScreen) -> String {
        guard !s.actions.isEmpty else { return "" }
        let buttons = s.actions.map { action -> String in
            let cls = "bd-quiz__button" + (action.primary ? " bd-quiz__button--primary" : "")
            if let href = action.href {
                return "<a class=\"\(cls)\" href=\"\(href.html)\" data-quiz-action=\"\(action.id.rawValue)\">\(action.label.html)</a>"
            }
            return "<button class=\"\(cls)\" type=\"submit\" name=\"_action\" value=\"\(action.id.rawValue)\"\(flag(!action.enabled, "disabled")) data-quiz-action=\"\(action.id.rawValue)\">\(action.label.html)</button>"
        }.joined()
        return "<div class=\"bd-quiz__actions\">\(buttons)</div>"
    }

    private static let inputTypes = ["email": "email", "url": "url", "phone": "tel", "tel": "tel", "number": "number", "date": "date", "time": "time"]

    private static func questionHtml(_ q: BdQuizQuestion, _ s: BdQuizScreen) -> String {
        let field = q.field
        let base = "bd-quiz-\(field.id.html)"
        let labelId = "\(base)-label"
        let errorId = "\(base)-error"
        let locked = flag(q.locked, "disabled")
        let invalid = q.error != nil ? " aria-invalid=\"true\" aria-describedby=\"\(errorId)\"" : ""
        let name = "q.\(field.id)".html
        let answer: String
        if let choices = q.choices {
            let type = q.multiple ? "checkbox" : "radio"
            let choice = { (state: String, selected: Bool, letter: String, label: String, name: String, value: String, extra: String) in
                """
                <label class="bd-quiz__choice\(extra)" data-state="\(state)"\(flag(q.locked, "data-locked"))>\
                <input class="bd-visually-hidden" type="\(type)" name="\(name)" value="\(value.html)"\(flag(selected, "checked"))\(locked) />\
                <span class="bd-quiz__letter" aria-hidden="true">\(letter.html)</span><span class="bd-quiz__choice-label">\(label.html)</span></label>
                """
            }
            let dontKnow = q.dontKnow.map { dk in
                choice(dk.state.rawValue, dk.selected, "?", dk.label, q.multiple ? "\(name).dk" : name, q.multiple ? "1" : dontKnowValue, " bd-quiz__choice--dont-know")
            } ?? ""
            answer = """
            <div class="bd-quiz__choices" role="\(q.multiple ? "group" : "radiogroup")" aria-labelledby="\(labelId)"\(invalid)>\
            \(choices.map { choice($0.state.rawValue, $0.selected, $0.letter, $0.label, name, $0.label, "") }.joined())\(dontKnow)</div>
            """
        } else {
            let value = q.value.map { BdJS.string($0) } ?? ""
            let common = "class=\"bd-quiz__input\" id=\"\(base)\" name=\"\(name)\""
            switch field.type {
            case "textarea", "long_text":
                answer = "<textarea \(common) aria-labelledby=\"\(labelId)\"\(invalid)\(locked)>\(value.html)</textarea>"
            case "select":
                let options = (field.options ?? []).map { "<option value=\"\($0.html)\"\(flag($0 == value, "selected"))>\($0.html)</option>" }.joined()
                answer = "<select \(common) aria-labelledby=\"\(labelId)\"\(invalid)\(locked)><option value=\"\">\((field.placeholder?.nilIfEmpty ?? "Choose…").html)</option>\(options)</select>"
            default:
                let placeholder = field.placeholder?.nilIfEmpty.map { " placeholder=\"\($0.html)\"" } ?? ""
                answer = "<input \(common) type=\"\(inputTypes[field.type] ?? "text")\" value=\"\(value.html)\"\(placeholder) aria-labelledby=\"\(labelId)\"\(invalid)\(locked) />"
            }
        }
        return """
        <fieldset class="bd-quiz__question" data-field-id="\(field.id.html)" data-bd-type="\(field.type.html)">\
        <legend class="bd-quiz__label" id="\(labelId)">\(s.phase == .all ? "<span class=\"bd-quiz__number\">\(q.number).</span>" : "")\(q.label.html)</legend>\
        <input type="hidden" name="\(name).~" value="1" />\(answer)\
        \(q.error.map { "<p class=\"bd-quiz__field-error\" id=\"\(errorId)\" role=\"alert\">\($0.html)</p>" } ?? "")</fieldset>
        """
    }

    private static func explainedHtml(_ items: [BdQuizOptionNote]) -> String {
        "<ul class=\"bd-quiz__explained\">\(items.map { "<li><strong>\($0.option.html)</strong><span>\($0.explanation.html)</span></li>" }.joined())</ul>"
    }

    private static func feedbackHtml(_ f: BdQuizFeedback) -> String {
        let accepted = f.accepted.map { "<div class=\"bd-quiz__answer bd-quiz__answer--accepted\"><p class=\"bd-quiz__small\">\(f.acceptedLabel.html)</p><p>\($0.html)</p></div>" } ?? ""
        return """
        <div class="bd-quiz__feedback" data-field-id="\(f.fieldId.html)" role="status">\
        <div class="bd-quiz__feedback-row"><span class="bd-quiz__badge" data-tone="\(f.badge.tone.rawValue)">\(f.badge.label.html)</span>\
        \(f.accuracy.map { "<span class=\"bd-quiz__accuracy\">\($0.html)</span>" } ?? "")</div>\
        <div class="bd-quiz__answers"><div class="bd-quiz__answer"><p class="bd-quiz__small">\(f.answerLabel.html)</p><p>\(f.answer.html)</p></div>\(accepted)</div>\
        \(f.why.map { "<div class=\"bd-quiz__why\"><p class=\"bd-quiz__small\">\(f.whyLabel.html)</p><p>\($0.html)</p></div>" } ?? "")\
        \(f.selected.isEmpty ? "" : explainedHtml(f.selected))\
        \(f.others.map { "<details class=\"bd-quiz__others\"><summary>\($0.label.html)</summary>\(explainedHtml($0.items))</details>" } ?? "")</div>
        """
    }
}
