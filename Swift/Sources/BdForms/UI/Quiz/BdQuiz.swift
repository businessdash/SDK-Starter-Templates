import SwiftUI

/// A BD quiz as a native screen: an invitation sent to this customer, a
/// practice quiz, or a local quiz. It shows exactly what BD's hosted quiz
/// shows (`BdQuizScreen`): lettered choices, "I don't know", open answers,
/// a verdict after each answer or everything at the end, an elapsed or
/// countdown timer that submits on its own, and the results.
///
/// ```swift
/// let quizzes = BdQuizzes(host: URL(string: "https://businessdash.us")!,
///                         publishableKey: "pk_…", sessionToken: session?.sessionToken)
///
/// BdQuiz(.invitation(token: token), quizzes: quizzes, onSignIn: { showSignIn = true })
/// BdQuiz(.practice(slug: "food-safety"), quizzes: quizzes)
/// ```
///
/// Looks follow `.bdFormStyle(_:)` (tint, error color, corner radius); words
/// follow `words`. Changing `quizzes` (a customer signs in) reloads it.
public struct BdQuiz: View {
    public enum Source: Sendable, Hashable {
        /// An invited quiz, by the token in its link.
        case invitation(token: String)
        /// A practice quiz: graded by BD, never recorded, retakeable.
        /// `questionLimit` asks a subset; `seed` pins the shuffle.
        case practice(slug: String, seed: String? = nil, questionLimit: Int? = nil)
    }

    enum Content {
        case remote(Source, BdQuizzes)
        case controller(BdQuizController, BdQuizPage?)
    }

    let content: Content
    let words: BdQuizWords
    let showsHeader: Bool
    let onSignIn: (@MainActor () -> Void)?
    let onSwitchAccount: (@MainActor () -> Void)?
    let onDone: (@MainActor (BdQuizCompletion) -> Void)?

    /// - Parameters:
    ///   - onSignIn: show your sign-in. Offered when an invitation needs the
    ///     invited account, and when results wait for it. Give `BdQuizzes`
    ///     the new session afterwards and the quiz reloads.
    ///   - onSwitchAccount: sign the customer out so the invited one can sign in.
    ///   - onDone: the quiz ended (scored, submitted, or out of time).
    public init(
        _ source: Source,
        quizzes: BdQuizzes,
        words: BdQuizWords = BdQuizWords(),
        showsHeader: Bool = true,
        onSignIn: (@MainActor () -> Void)? = nil,
        onSwitchAccount: (@MainActor () -> Void)? = nil,
        onDone: (@MainActor (BdQuizCompletion) -> Void)? = nil
    ) {
        content = .remote(source, quizzes)
        self.words = words
        self.showsHeader = showsHeader
        self.onSignIn = onSignIn
        self.onSwitchAccount = onSwitchAccount
        self.onDone = onDone
    }

    /// Any quiz you run yourself, e.g. a local one whose fields carry
    /// answer keys: `BdQuizController(options: BdQuizOptions(fields: fields))`.
    public init(
        controller: BdQuizController,
        page: BdQuizPage? = nil,
        onSignIn: (@MainActor () -> Void)? = nil,
        onDone: (@MainActor (BdQuizCompletion) -> Void)? = nil
    ) {
        content = .controller(controller, page)
        words = controller.config.words
        showsHeader = page != nil
        self.onSignIn = onSignIn
        onSwitchAccount = nil
        self.onDone = onDone
    }

    enum Phase {
        case loading
        case failed
        case page(BdQuizPage, BdQuizController?)
    }

    @State private var phase: Phase = .loading
    @State private var attempt = 0

    /// Where the engine's sign-in links point when the app handles sign-in.
    static let signInLink = "bd-quiz:sign-in"
    static let switchAccountLink = "bd-quiz:switch-account"

    public var body: some View {
        Group {
            switch content {
            case .controller(let controller, let page):
                BdQuizPageView(
                    page: showsHeader ? page : page.map { BdQuizPage(header: nil, gate: $0.gate) },
                    controller: controller, words: words,
                    onSignIn: onSignIn, onSwitchAccount: onSwitchAccount
                )
                .onAppear { if let onDone { controller.onDone = onDone } }
            case .remote(let source, let quizzes):
                remote(source, quizzes)
                    .task(id: LoadKey(source: source, quizzes: quizzes, attempt: attempt)) {
                        await load(source, quizzes)
                    }
            }
        }
    }

    struct LoadKey: Hashable {
        let source: Source
        let quizzes: BdQuizzes
        let attempt: Int
    }

    @ViewBuilder
    func remote(_ source: Source, _ quizzes: BdQuizzes) -> some View {
        switch phase {
        case .loading:
            VStack(spacing: 12) {
                ProgressView()
                Text(words.loading).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 200)
        case .failed:
            VStack(spacing: 12) {
                Text(words.loadFailed).multilineTextAlignment(.center)
                Button(words.tryAgain) { attempt += 1 }
                    .buttonStyle(.bordered)
            }
            .frame(maxWidth: .infinity, minHeight: 200)
            .padding()
        case .page(let page, let controller):
            BdQuizPageView(
                page: showsHeader ? page : BdQuizPage(header: nil, gate: page.gate),
                controller: controller, words: words,
                onSignIn: onSignIn, onSwitchAccount: onSwitchAccount
            )
        }
    }

    func load(_ source: Source, _ quizzes: BdQuizzes) async {
        if case .page(_, let old?) = phase { old.stop() }
        phase = .loading
        let signIn = onSignIn != nil ? Self.signInLink : nil
        let switchAccount = onSwitchAccount != nil ? Self.switchAccountLink : nil
        do {
            switch source {
            case .invitation(let token):
                let invitation = try await quizzes.invitation(token)
                let page = BdQuizPage.invitation(
                    invitation, words: words, signInHref: signIn, switchAccountHref: switchAccount
                )
                guard page.gate == nil else {
                    phase = .page(page, nil)
                    return
                }
                let controller = BdQuizController(
                    options: BdQuizOptions(invitation: invitation, signInHref: signIn, words: words),
                    backend: quizzes.invitationBackend(token),
                    initial: BdQuizInitial(invitation: invitation)
                )
                controller.onDone = onDone
                phase = .page(page, controller)
            case .practice(let slug, let seed, let limit):
                let practice = try await quizzes.practice(slug)
                let controller = BdQuizController(
                    options: BdQuizOptions(practice: practice, seed: seed, questionLimit: limit, words: words),
                    backend: quizzes.practiceBackend(slug)
                )
                controller.onDone = onDone
                phase = .page(BdQuizPage.practice(practice, words: words), controller)
            }
        } catch let error as BdFormsError where error.status == 404 {
            if case .invitation = source {
                phase = .page(BdQuizPage.invitation(BdQuizInvitation?.none, words: words), nil)
            } else {
                phase = .page(BdQuizPage(header: nil, gate: .init(kind: .invalid, title: nil, body: error.message, action: nil)), nil)
            }
        } catch is CancellationError {
            return
        } catch {
            if Task.isCancelled { return }
            phase = .failed
        }
    }
}

// MARK: - Page

struct BdQuizPageView: View {
    let page: BdQuizPage?
    let controller: BdQuizController?
    let words: BdQuizWords
    let onSignIn: (@MainActor () -> Void)?
    let onSwitchAccount: (@MainActor () -> Void)?

    @Environment(\.bdFormStyle) private var style
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let header = page?.header { headerView(header) }
                if let gate = page?.gate {
                    gateView(gate)
                } else if let controller {
                    BdQuizBody(controller: controller, onSignIn: onSignIn)
                }
            }
            .padding()
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .tint(style.tint)
    }

    func headerView(_ header: BdQuizPage.Header) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(header.eyebrow.uppercased())
                .font(.caption.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(.tint)
            Text(header.title)
                .font(.title2.bold())
                .accessibilityAddTraits(.isHeader)
            if let description = header.description {
                Text(description).foregroundStyle(.secondary)
            }
            if !header.facts.isEmpty {
                BdFlowLayout(spacing: 6) {
                    ForEach(header.facts, id: \.self) { fact in
                        Text(fact)
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(.quaternary, in: Capsule())
                    }
                }
            }
        }
    }

    func gateView(_ gate: BdQuizPage.Gate) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title = gate.title {
                Text(title).font(.headline)
            }
            Text(gate.body).foregroundStyle(gate.title == nil ? .primary : .secondary)
            if let action = gate.action, let run = handler(action) {
                Button(action.label, action: run)
                    .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: style.cornerRadius))
    }

    func handler(_ action: BdQuizPage.Gate.Action) -> (() -> Void)? {
        let app = action.id == .signIn ? onSignIn : onSwitchAccount
        if let app { return { app() } }
        if let href = action.href, let url = URL(string: href), url.scheme != "bd-quiz" {
            return { openURL(url) }
        }
        return nil
    }
}

// MARK: - The quiz

struct BdQuizBody: View {
    let controller: BdQuizController
    let onSignIn: (@MainActor () -> Void)?

    @Environment(\.bdFormStyle) private var style
    @Environment(\.openURL) private var openURL

    var body: some View {
        let screen = controller.screen
        VStack(alignment: .leading, spacing: 16) {
            if let timer = screen.timer { BdQuizTimerView(timer: timer) }
            if let progress = screen.progress { progressView(progress) }
            if let notice = screen.notice {
                Text(notice).font(.footnote).foregroundStyle(.secondary)
            }
            if let empty = screen.empty {
                Text(empty).foregroundStyle(.secondary)
            }
            if let ready = screen.ready { readyView(ready) }
            ForEach(screen.questions) { question in
                BdQuizQuestionView(question: question, controller: controller, primary: primaryAction(screen))
            }
            if let feedback = screen.feedback {
                BdQuizFeedbackView(feedback: feedback)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
            if let done = screen.done { BdQuizDoneView(done: done) }
            if let error = screen.error {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(style.errorColor)
                    .font(.callout)
            }
            actionsView(screen.actions)
        }
        .animation(style.animation, value: screen.phase)
        .animation(style.animation, value: screen.feedback)
    }

    func primaryAction(_ screen: BdQuizScreen) -> BdQuizActionID? {
        screen.actions.first { $0.primary && $0.enabled }?.id
    }

    func progressView(_ progress: BdQuizScreen.Progress) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(progress.position).font(.subheadline.weight(.medium))
                Spacer()
                if let note = progress.note {
                    Text(note).font(.caption).foregroundStyle(.secondary)
                }
            }
            ProgressView(value: min(max(progress.percent, 0), 100), total: 100)
        }
    }

    func readyView(_ ready: BdQuizScreen.Ready) -> some View {
        VStack(spacing: 10) {
            Image(systemName: ready.icon == "hourglass" ? "hourglass" : "clock")
                .font(.largeTitle)
                .foregroundStyle(.tint)
            Text(ready.title).font(.title3.bold())
            Text(ready.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    func actionsView(_ actions: [BdQuizAction]) -> some View {
        HStack(spacing: 12) {
            ForEach(actions.filter { !$0.primary }) { button($0) }
            Spacer(minLength: 0)
            ForEach(actions.filter(\.primary)) { button($0) }
        }
    }

    @ViewBuilder
    func button(_ action: BdQuizAction) -> some View {
        let tap = {
            if action.id == .signIn {
                if let onSignIn { onSignIn() }
                else if let href = action.href, let url = URL(string: href), url.scheme != "bd-quiz" { openURL(url) }
            } else {
                Task { await controller.perform(action.id) }
            }
        }
        if action.primary {
            Button(action.label, action: tap)
                .buttonStyle(.borderedProminent)
                .disabled(!action.enabled)
        } else {
            Button(action.label, action: tap)
                .buttonStyle(.bordered)
                .disabled(!action.enabled)
        }
    }
}

// MARK: - Timer

struct BdQuizTimerView: View {
    let timer: BdQuizTimer
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label(timer.label, systemImage: timer.countdown ? "hourglass" : "clock")
                    .font(.subheadline)
                Spacer()
                Text(timer.paused ? timer.pausedLabel : timer.value)
                    .font(.body.monospacedDigit().weight(.semibold))
                    .foregroundStyle(timer.warning ? style.errorColor : .primary)
                    .contentTransition(.numericText(countsDown: timer.countdown))
            }
            if let progress = timer.progress {
                ProgressView(value: progress, total: 100)
                    .tint(timer.warning ? style.errorColor : nil)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - A question

struct BdQuizQuestionView: View {
    let question: BdQuizQuestion
    let controller: BdQuizController
    let primary: BdQuizActionID?

    @Environment(\.bdFormStyle) private var style

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(question.number).").foregroundStyle(.secondary)
                Text(question.label)
            }
            .font(.headline)
            .accessibilityAddTraits(.isHeader)

            if let choices = question.choices {
                ForEach(choices, id: \.letter) { choice in
                    BdQuizChoiceRow(letter: choice.letter, label: choice.label, state: choice.state, selected: choice.selected) {
                        controller.choose(question.field.id, choice.label)
                    }
                    // Not `.disabled`: that would fade the verdict's colors.
                    .allowsHitTesting(!question.locked)
                }
                if let dontKnow = question.dontKnow {
                    BdQuizChoiceRow(letter: "?", label: dontKnow.label, state: dontKnow.state, selected: dontKnow.selected) {
                        controller.chooseDontKnow(question.field.id)
                    }
                    .allowsHitTesting(!question.locked)
                }
            } else {
                BdQuizAnswerInput(question: question, controller: controller, primary: primary)
                    .disabled(question.locked)
            }

            if let error = question.error {
                Text(error).font(.footnote).foregroundStyle(style.errorColor)
            }
        }
    }
}

struct BdQuizChoiceRow: View {
    let letter: String
    let label: String
    let state: BdQuizChoiceState
    let selected: Bool
    let action: () -> Void

    @Environment(\.bdFormStyle) private var style

    var color: Color {
        switch state {
        case .correct: .green
        case .incorrect: style.errorColor
        case .selected: style.tint ?? .accentColor
        case .idle, .dimmed: .secondary
        }
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(letter)
                    .font(.subheadline.weight(.semibold))
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(color.opacity(state == .idle || state == .dimmed ? 0.12 : 0.9)))
                    .foregroundStyle(state == .idle || state == .dimmed ? Color.primary : Color.white)
                Text(label)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                switch state {
                case .correct: Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                case .incorrect: Image(systemName: "xmark.circle.fill").foregroundStyle(style.errorColor)
                default: EmptyView()
                }
            }
            .padding(12)
            .contentShape(Rectangle())
            .background(
                RoundedRectangle(cornerRadius: style.cornerRadius)
                    .fill(color.opacity(state == .idle || state == .dimmed ? 0.06 : 0.12))
            )
            .overlay(
                RoundedRectangle(cornerRadius: style.cornerRadius)
                    .strokeBorder(color.opacity(state == .idle || state == .dimmed ? 0.25 : 0.8), lineWidth: 1)
            )
            .opacity(state == .dimmed ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(letter). \(label)")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// An open answer: a text box, a text area, a number, a dropdown, yes/no.
struct BdQuizAnswerInput: View {
    let question: BdQuizQuestion
    let controller: BdQuizController
    let primary: BdQuizActionID?

    var field: BdFormField { question.field }

    var text: Binding<String> {
        Binding(
            get: {
                switch question.value {
                case .string(let s)?: s
                case .number(let n)?: BdJS.string(n)
                default: ""
                }
            },
            set: { controller.setAnswer(field.id, .string($0)) }
        )
    }

    func submit() {
        guard let primary else { return }
        Task { await controller.perform(primary) }
    }

    var body: some View {
        switch field.type {
        case "textarea", "richtext":
            TextField(field.placeholder ?? "", text: text, axis: .vertical)
                .lineLimit(4...12)
                .textFieldStyle(.roundedBorder)
        case "select":
            Picker(selection: text) {
                Text("—").tag("")
                ForEach(field.options ?? [], id: \.self) { Text($0).tag($0) }
            } label: {
                Text(field.placeholder ?? question.label)
            }
            .pickerStyle(.menu)
        case "boolean":
            Picker(question.label, selection: Binding(
                get: { question.value?.boolValue },
                set: { if let v = $0 { controller.setAnswer(field.id, .bool(v)) } }
            )) {
                Text(controller.config.words.yes).tag(Bool?.some(true))
                Text(controller.config.words.no).tag(Bool?.some(false))
            }
            .pickerStyle(.segmented)
            .labelsHidden()
        case "number", "currency", "slider":
            TextField(field.placeholder ?? "", text: Binding(
                get: { text.wrappedValue },
                set: { raw in
                    let trimmed = raw.trimmingCharacters(in: .whitespaces)
                    let n = BdJS.number(trimmed)
                    controller.setAnswer(field.id, trimmed.isEmpty ? .string("") : n.isFinite ? .number(n) : .string(raw))
                }
            ))
            .textFieldStyle(.roundedBorder)
            #if os(iOS)
            .keyboardType(.decimalPad)
            #endif
            .onSubmit(submit)
        default:
            TextField(field.placeholder ?? "", text: text)
                .textFieldStyle(.roundedBorder)
                .submitLabel(.done)
                .onSubmit(submit)
        }
    }
}

// MARK: - Verdicts

extension BdQuizTone {
    var color: Color {
        switch self {
        case .correct: .green
        case .partial: .orange
        case .incorrect: .red
        case .pending: .blue
        case .unscored: .gray
        case .unsure: .purple
        }
    }
}

struct BdQuizBadge: View {
    let badge: BdQuizFeedback.Badge
    var body: some View {
        Text(badge.label)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .foregroundStyle(badge.tone.color)
            .background(badge.tone.color.opacity(0.14), in: Capsule())
    }
}

struct BdQuizFeedbackView: View {
    let feedback: BdQuizFeedback
    var framed = true
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        let content = VStack(alignment: .leading, spacing: 10) {
            HStack {
                BdQuizBadge(badge: feedback.badge)
                Spacer()
                if let accuracy = feedback.accuracy {
                    Text(accuracy).font(.caption).foregroundStyle(.secondary)
                }
            }
            row(feedback.answerLabel, feedback.answer)
            if let accepted = feedback.accepted { row(feedback.acceptedLabel, accepted) }
            if let why = feedback.why { row(feedback.whyLabel, why) }
            ForEach(feedback.selected, id: \.option) { note in
                row(note.option, note.explanation)
            }
            if let others = feedback.others {
                Text(others.label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                ForEach(others.items, id: \.option) { note in
                    row(note.option, note.explanation)
                }
            }
        }
        if framed {
            content
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(feedback.badge.tone.color.opacity(0.06), in: RoundedRectangle(cornerRadius: style.cornerRadius))
                .overlay(
                    RoundedRectangle(cornerRadius: style.cornerRadius)
                        .strokeBorder(feedback.badge.tone.color.opacity(0.3))
                )
        } else {
            content
        }
    }

    func row(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            Text(value)
        }
    }
}

struct BdQuizDoneView: View {
    let done: BdQuizDone
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        switch done {
        case .results(let r): results(r)
        case .submitted(let m), .locked(let m): message(m)
        }
    }

    func message(_ m: BdQuizDone.Message) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(m.eyebrow.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(.tint)
            Text(m.title).font(.title3.bold())
            Text(m.body).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    func results(_ r: BdQuizDone.Results) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(r.eyebrow.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(.tint)
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(r.score).font(.system(size: 48, weight: .bold, design: .rounded))
                    if let tally = r.tally { Text(tally).foregroundStyle(.secondary) }
                }
                Label(r.summary, systemImage: r.passed == true ? "checkmark.seal.fill" : r.passed == false ? "xmark.seal" : "hourglass")
                    .foregroundStyle(r.passed == true ? Color.green : r.passed == false ? style.errorColor : Color.blue)
                if let message = r.message { Text(message) }
                if let timing = r.timing {
                    Text(timing).font(.footnote).foregroundStyle(.secondary)
                }
            }
            ForEach(r.items, id: \.feedback.fieldId) { item in
                DisclosureGroup {
                    BdQuizFeedbackView(feedback: item.feedback, framed: false)
                        .padding(.top, 8)
                } label: {
                    HStack(alignment: .firstTextBaseline) {
                        Text("\(item.number).").foregroundStyle(.secondary)
                        Text(item.label).multilineTextAlignment(.leading)
                        Spacer()
                        BdQuizBadge(badge: item.feedback.badge)
                    }
                }
                .padding(12)
                .background(.quaternary.opacity(0.4), in: RoundedRectangle(cornerRadius: style.cornerRadius))
            }
        }
    }
}
