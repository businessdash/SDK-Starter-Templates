import Foundation

// Exactly what a quiz screen shows, texts included: the TypeScript
// forms-core's `QuizView`. `BdQuiz` draws it; a custom UI can draw it too.

public enum BdQuizTone: String, Codable, Sendable, Hashable {
    case correct, partial, incorrect, pending, unscored, unsure
}

public enum BdQuizChoiceState: String, Codable, Sendable, Hashable {
    case idle, selected, correct, incorrect, dimmed
}

public struct BdQuizChoice: Codable, Sendable, Hashable {
    public var letter: String
    public var label: String
    public var selected: Bool
    public var state: BdQuizChoiceState
}

public struct BdQuizDontKnowChoice: Codable, Sendable, Hashable {
    public var label: String
    public var selected: Bool
    public var state: BdQuizChoiceState
}

public struct BdQuizQuestion: Encodable, Sendable, Hashable, Identifiable {
    public var field: BdFormField
    /// 1-based, in the order asked.
    public var number: Int
    public var label: String
    public var value: BdJSON?
    public var error: String?
    /// The answer can't change (locked, or the quiz is busy).
    public var locked: Bool
    /// Lettered choices for multiple choice; nil: render the field itself.
    public var choices: [BdQuizChoice]?
    public var multiple: Bool
    public var dontKnow: BdQuizDontKnowChoice?

    public var id: String { field.id }

    enum CodingKeys: String, CodingKey { case field, number, label, value, error, locked, choices, multiple, dontKnow }

    /// The field is written as its id, as the fixtures carry it.
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(field.id, forKey: .field)
        try c.encode(number, forKey: .number)
        try c.encode(label, forKey: .label)
        try c.encodeIfPresent(value, forKey: .value)
        try c.encodeIfPresent(error, forKey: .error)
        try c.encode(locked, forKey: .locked)
        try c.encodeIfPresent(choices, forKey: .choices)
        try c.encode(multiple, forKey: .multiple)
        try c.encodeIfPresent(dontKnow, forKey: .dontKnow)
    }
}

public struct BdQuizOptionNote: Codable, Sendable, Hashable {
    public var option: String
    public var explanation: String
}

public struct BdQuizFeedback: Codable, Sendable, Hashable {
    public struct Badge: Codable, Sendable, Hashable {
        public var label: String
        public var tone: BdQuizTone
    }

    public struct Others: Codable, Sendable, Hashable {
        public var label: String
        public var items: [BdQuizOptionNote]
    }

    public var fieldId: String
    public var label: String
    public var badge: Badge
    public var accuracy: String?
    public var answerLabel: String
    public var answer: String
    public var acceptedLabel: String
    public var accepted: String?
    public var whyLabel: String
    public var why: String?
    /// Explanations for each picked option, when several were picked.
    public var selected: [BdQuizOptionNote]
    public var others: Others?
}

public struct BdQuizTimer: Codable, Sendable, Hashable {
    public var label: String
    public var value: String
    public var seconds: Int
    public var countdown: Bool
    /// A minute or less left.
    public var warning: Bool
    public var paused: Bool
    public var pausedLabel: String
    /// Percent of time left, for a bar; nil without a countdown.
    public var progress: Double?
}

public enum BdQuizActionID: String, Codable, Sendable, Hashable {
    case start, lock, next, back, submit, finish, retake, signIn
}

public struct BdQuizAction: Codable, Sendable, Hashable, Identifiable {
    public var id: BdQuizActionID
    public var label: String
    public var enabled: Bool
    public var primary: Bool
    public var href: String?
}

public enum BdQuizDone: Encodable, Sendable, Hashable {
    public struct Results: Codable, Sendable, Hashable {
        public struct Item: Codable, Sendable, Hashable {
            public var number: Int
            public var label: String
            public var tone: BdQuizTone
            public var feedback: BdQuizFeedback
        }

        public var eyebrow: String
        public var score: String
        public var tally: String?
        public var summary: String
        public var message: String?
        public var timing: String?
        public var passed: Bool?
        public var items: [Item]
    }

    public struct Message: Codable, Sendable, Hashable {
        public var eyebrow: String
        public var title: String
        public var body: String
    }

    /// Score, tally and per-question feedback.
    case results(Results)
    /// Interview mode: a thank-you, never a score.
    case submitted(Message)
    /// Results wait for the invited account.
    case locked(Message)

    enum KindKey: String, CodingKey { case kind }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: KindKey.self)
        switch self {
        case .results(let r):
            try c.encode("results", forKey: .kind)
            try r.encode(to: encoder)
        case .submitted(let m):
            try c.encode("submitted", forKey: .kind)
            try m.encode(to: encoder)
        case .locked(let m):
            try c.encode("locked", forKey: .kind)
            try m.encode(to: encoder)
        }
    }
}

public enum BdQuizPhase: String, Codable, Sendable, Hashable {
    case empty, ready, question, all, feedback, done
}

public struct BdQuizScreen: Encodable, Sendable, Hashable {
    public struct Ready: Codable, Sendable, Hashable {
        /// `hourglass` (a countdown) or `clock` (elapsed time).
        public var icon: String
        public var title: String
        public var body: String
    }

    public struct Progress: Codable, Sendable, Hashable {
        public var position: String
        public var note: String?
        public var percent: Double
    }

    public var phase: BdQuizPhase
    public var empty: String?
    public var ready: Ready?
    public var timer: BdQuizTimer?
    public var progress: Progress?
    /// End feedback: when answers and rationale appear.
    public var notice: String?
    public var questions: [BdQuizQuestion]
    public var feedback: BdQuizFeedback?
    public var done: BdQuizDone?
    public var actions: [BdQuizAction]
    public var error: String?
    public var busy: Bool
}

// MARK: - Building the screen

extension BdQuizEngine {
    static func badge(_ w: BdQuizWords, _ result: BdQuizQuestionResult, dontKnow: Bool) -> BdQuizFeedback.Badge {
        if dontKnow && result.status != .correct { return .init(label: w.dontKnow, tone: .unsure) }
        switch result.status {
        case .correct: return .init(label: w.correct, tone: .correct)
        case .partiallyCorrect: return .init(label: w.partiallyCorrect, tone: .partial)
        case .pendingAi: return .init(label: w.pendingAi, tone: .pending)
        case .unscored: return .init(label: w.unscored, tone: .unscored)
        case .incorrect: return .init(label: w.incorrect, tone: .incorrect)
        }
    }

    /// One verdict as a feedback card.
    public static func feedback(_ w: BdQuizWords, _ result: BdQuizQuestionResult, dontKnow: Bool = false) -> BdQuizFeedback {
        let unanswered: Bool
        switch result.answer {
        case nil, .null?: unanswered = true
        case .string(let s)?: unanswered = s.isEmpty
        case .array(let a)?: unanswered = a.isEmpty
        default: unanswered = false
        }
        let picked = (result.rationale?.selectedOptions ?? []).compactMap { o in
            o.explanation.map { BdQuizOptionNote(option: o.option, explanation: $0) }
        }
        let others = (result.rationale?.optionExplanations ?? []).compactMap { o in
            o.accepted ? nil : o.explanation.map { BdQuizOptionNote(option: o.option, explanation: $0) }
        }
        return BdQuizFeedback(
            fieldId: result.fieldId,
            label: result.label,
            badge: badge(w, result, dontKnow: dontKnow),
            accuracy: result.accuracyPercent.map { BdQuizWords.fill(w.accurate, ["percent": String(percent($0))]) },
            answerLabel: w.yourAnswer,
            answer: dontKnow && unanswered ? w.dontKnow : answerText(result.answer, words: w),
            acceptedLabel: w.acceptedAnswer,
            accepted: (result.correctAnswers ?? []).isEmpty ? nil : result.correctAnswers!.joined(separator: " · "),
            whyLabel: unanswered ? w.whyAccepted : w.why,
            why: result.rationale?.explanation,
            selected: picked.count > 1 ? picked : [],
            others: others.isEmpty ? nil : .init(label: w.whyOthers, items: others)
        )
    }

    /// The timer as shown, or nil when the quiz has none or hasn't started.
    public static func timer(_ config: BdQuizConfig, _ state: BdQuizState, now: Double) -> BdQuizTimer? {
        guard config.timerEnabled, let startedAt = state.startedAt else { return nil }
        let clock = clock(state, now: now)
        let deadline = effectiveDeadline(config, state, now: now)
        let seconds: Int
        var progress: Double?
        if let deadline {
            seconds = Int(max(0, ((deadline - clock) / 1000).rounded(.up)))
            // Against the time allowed, not the stretched deadline: a local
            // run's pauses push the deadline out, and the bar holds still
            // through them instead of shrinking.
            let allowed = (state.deadlineAt ?? startedAt) - startedAt
            progress = allowed > 0 ? max(0, min(100, ((deadline - clock) / allowed) * 100)) : 0
        } else {
            seconds = Int(max(0, ((clock - startedAt) / 1000).rounded(.down)))
        }
        return BdQuizTimer(
            label: deadline != nil ? config.words.timeRemaining : config.words.elapsedTime,
            value: durationLabel(Double(seconds)),
            seconds: seconds,
            countdown: deadline != nil,
            warning: deadline != nil && seconds <= 60,
            paused: config.local && deadline != nil && state.revealed,
            pausedLabel: config.words.paused,
            progress: progress
        )
    }

    static func choices(_ field: BdFormField, _ value: BdJSON?, _ result: BdQuizQuestionResult?) -> [BdQuizChoice] {
        let values: [BdJSON?] = value?.arrayValue.map { $0.map(Optional.some) } ?? [value]
        let picked = Set(values.map { BdJS.string($0) })
        let scored = !(result?.correctAnswers ?? []).isEmpty
        return BdQuizScoring.optionLabels(field).enumerated().map { index, label in
            let selected = picked.contains(label)
            var state: BdQuizChoiceState = selected ? .selected : .idle
            if let result {
                if scored && BdQuizScoring.isAcceptedLabel(result, label) { state = .correct }
                else if selected { state = scored ? .incorrect : .selected }
                else { state = .dimmed }
            }
            return BdQuizChoice(letter: BdQuizArrange.choiceLetter(index), label: label, selected: selected, state: state)
        }
    }

    static func question(_ config: BdQuizConfig, _ state: BdQuizState, _ field: BdFormField, _ index: Int) -> BdQuizQuestion {
        let value = state.answers[field.id]
        let result = config.feedbackMode == .immediate ? self.result(state, field.id) : nil
        let chosen = state.dontKnow.contains(field.id)
        return BdQuizQuestion(
            field: field,
            number: index + 1,
            label: field.label,
            value: value,
            error: state.fieldErrors[field.id],
            locked: result != nil || busy(state),
            choices: BdQuizArrange.isMultipleChoice(field) ? choices(field, value, result) : nil,
            multiple: BdQuizArrange.isMultiSelect(field),
            dontKnow: offersDontKnow(config, field)
                ? BdQuizDontKnowChoice(
                    label: config.words.dontKnow,
                    selected: chosen,
                    state: result != nil ? (chosen ? .incorrect : .dimmed) : (chosen ? .selected : .idle)
                )
                : nil
        )
    }

    static func answered(_ config: BdQuizConfig, _ state: BdQuizState) -> Int {
        config.questions.filter { q in
            !BdFormRules.isEmpty(q, state.answers[q.id]) || state.dontKnow.contains(q.id)
        }.count
    }

    static func resultsMessage(_ w: BdQuizWords, _ percent: Int) -> String {
        if percent >= 90 { return w.messageExcellent }
        if percent >= 75 { return w.messageSolid }
        if percent >= 50 { return w.messageGettingThere }
        return w.messageKeepGoing
    }

    static func done(_ config: BdQuizConfig, _ state: BdQuizState, _ completion: BdQuizCompletion) -> BdQuizDone {
        let w = config.words
        if !config.showScore {
            return .submitted(.init(eyebrow: w.submittedEyebrow, title: w.submittedTitle, body: w.submittedBody))
        }
        if config.resultsLocked {
            return .locked(.init(eyebrow: w.lockedEyebrow, title: w.lockedTitle, body: w.lockedBody))
        }
        let score = percent(completion.scorePercent ?? completion.provisionalScorePercent ?? 0)
        let scorable = completion.results.filter { $0.pointsPossible > 0 }
        let correct = scorable.filter { $0.status == .correct }.count
        let pending = completion.status == "pending_ai_review"
        var timing: String?
        if completion.timedOut == true || completion.durationSeconds != nil {
            let label = completion.timedOut == true ? w.timeLimitReached : w.completed
            timing = completion.durationSeconds.map {
                BdQuizWords.fill(w.inDuration, ["label": label, "duration": durationLabel($0)])
            } ?? label
        }
        return .results(.init(
            eyebrow: w.resultsEyebrow,
            score: "\(score)%",
            tally: scorable.isEmpty ? nil : BdQuizWords.fill(w.tally, ["correct": String(correct), "total": String(scorable.count)]),
            summary: pending ? w.provisional : completion.passed == true ? w.passed : w.notPassed,
            message: pending ? nil : resultsMessage(w, score),
            timing: timing,
            passed: completion.passed,
            items: completion.results.enumerated().map { index, result in
                let card = feedback(w, result, dontKnow: state.dontKnow.contains(result.fieldId))
                return .init(number: index + 1, label: result.label, tone: card.badge.tone, feedback: card)
            }
        ))
    }

    /// Exactly what the quiz screen shows now.
    public static func screen(_ config: BdQuizConfig, _ state: BdQuizState, now: Double) -> BdQuizScreen {
        let w = config.words
        var view = BdQuizScreen(
            phase: .empty, questions: [], actions: [], error: state.error, busy: state.pending != nil
        )
        let count = config.questions.count

        if let completion = state.completion {
            let done = done(config, state, completion)
            var isLocked = false
            if case .locked = done { isLocked = true }
            if isLocked, let href = config.signInHref {
                view.actions.append(.init(id: .signIn, label: w.lockedAction, enabled: true, primary: true, href: href))
            }
            if config.canRestart {
                view.actions.append(.init(id: .retake, label: w.retake, enabled: true, primary: !isLocked))
            }
            view.phase = .done
            view.done = done
            return view
        }

        if count == 0 {
            view.empty = w.empty
            return view
        }

        if config.timerEnabled && state.startedAt == nil {
            let body: String
            switch config.timeLimitMinutes {
            case nil: body = w.readyElapsed
            case 1?: body = w.readyLimitOne
            case let minutes?: body = BdQuizWords.fill(w.readyLimitMany, ["minutes": String(minutes)])
            }
            view.phase = .ready
            view.ready = .init(icon: config.timeLimitMinutes != nil ? "hourglass" : "clock", title: w.readyTitle, body: body)
            view.actions = [.init(
                id: .start, label: state.pending == .start ? w.starting : w.start,
                enabled: state.pending == nil, primary: true
            )]
            return view
        }

        view.timer = timer(config, state, now: now)
        let idle = state.pending == nil
        let submitAction = BdQuizAction(
            id: .submit, label: state.pending == .submit ? w.submitting : w.submit, enabled: idle, primary: true
        )

        if config.feedbackMode == .end && config.layout == .all {
            let done = answered(config, state)
            view.phase = .all
            view.progress = .init(
                position: BdQuizWords.fill(w.answeredOf, ["answered": String(done), "total": String(count)]),
                note: nil,
                percent: Double(done) / Double(count) * 100
            )
            view.notice = config.showScore ? w.endNotice : w.endNoticeHidden
            view.questions = config.questions.enumerated().map { question(config, state, $1, $0) }
            view.actions = [submitAction]
            return view
        }

        let index = min(max(state.index, 0), count - 1)
        let field = config.questions[index]
        let last = state.index >= count - 1
        let position = BdQuizWords.fill(w.questionOf, ["number": String(state.index + 1), "total": String(count)])

        if config.feedbackMode == .immediate {
            let result = self.result(state, field.id)
            let showing = state.revealed && result != nil
            let percent = max(Double(state.revealed ? state.results.count : state.index) / Double(count) * 100, 4)
            let finishLabel = config.showScore && !config.resultsLocked ? w.seeResults : w.finish
            view.phase = showing ? .feedback : .question
            view.progress = .init(position: position, note: w.locksWhenChecked, percent: percent)
            view.questions = [question(config, state, field, state.index)]
            view.feedback = showing ? feedback(w, result!, dontKnow: state.dontKnow.contains(field.id)) : nil
            view.actions = showing
                ? [.init(
                    id: last ? .finish : .next,
                    label: state.pending == .submit ? w.submitting : last ? finishLabel : w.nextQuestion,
                    enabled: idle, primary: true
                )]
                : [.init(
                    id: .lock,
                    label: state.pending == .lock ? w.checking : config.local ? w.checkAnswer : w.lockAnswer,
                    enabled: idle, primary: true
                )]
            return view
        }

        if state.index > 0 {
            view.actions.append(.init(id: .back, label: w.back, enabled: idle, primary: false))
        }
        view.actions.append(last ? submitAction : .init(id: .next, label: w.next, enabled: idle, primary: true))
        view.phase = .question
        view.progress = .init(position: position, note: nil, percent: max(Double(state.index) / Double(count) * 100, 4))
        view.notice = config.showScore ? w.endNotice : w.endNoticeHidden
        view.questions = [question(config, state, field, state.index)]
        return view
    }
}
