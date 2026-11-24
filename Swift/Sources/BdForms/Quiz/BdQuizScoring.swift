import Foundation

// Quiz grading: answer keys, accepted answers, thresholds, rationale and the
// deterministic score BD records for an attempt.
//
// A port of the TypeScript forms-core's `quiz-scoring.ts` (itself a port of
// BD's `packages/forms/src/quizzes/scoring.ts`). `QuizParityTests` replays the
// TypeScript answers in `quiz-parity.json`; change them together.
//
// In an app this grades LOCAL quizzes, ones whose fields carry their answer
// keys. An invited quiz arrives without keys and BD grades every answer.

// MARK: - Results

/// A question's verdict. BD may add statuses; an unknown one reads as
/// `incorrect`, which is how the web renderer shows it.
public enum BdQuizQuestionStatus: String, Codable, Sendable, Hashable {
    case correct
    case partiallyCorrect = "partially_correct"
    case incorrect
    case pendingAi = "pending_ai"
    case unscored

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = BdQuizQuestionStatus(rawValue: raw) ?? .incorrect
    }
}

public struct BdQuizOptionExplanation: Codable, Sendable, Hashable {
    public var optionId: String
    public var option: String
    public var accepted: Bool
    public var explanation: String?
}

public struct BdQuizQuestionRationale: Codable, Sendable, Hashable {
    /// `correct`, `partially_correct` or `incorrect`.
    public var outcome: String
    public var explanation: String?
    /// Feedback for each picked option.
    public var selectedOptions: [BdQuizOptionExplanation]?
    /// Every option's explanation, shown once the answer is in.
    public var optionExplanations: [BdQuizOptionExplanation]?
}

public struct BdQuizQuestionResult: Codable, Sendable, Hashable {
    public var fieldId: String
    public var label: String
    public var answer: BdJSON?
    public var status: BdQuizQuestionStatus
    public var pointsPossible: Double
    public var pointsEarned: Double
    /// Nil while a free-text answer waits for AI review.
    public var accuracyPercent: Double?
    public var passingGrade: Double?
    public var correctThreshold: Double?
    public var partiallyCorrectThreshold: Double?
    public var passed: Bool?
    /// Revealed only once an answer is locked or the quiz is submitted.
    public var correctAnswers: [String]?
    public var rationale: BdQuizQuestionRationale?
    /// Legacy results may still carry it.
    public var reason: String?
    public var validation: Validation?

    public struct Validation: Codable, Sendable, Hashable {
        public var source: String
        public var confidence: Double?
        public var rationale: String?
    }
}

/// A scored submission.
public struct BdQuizScore: Codable, Sendable, Hashable {
    /// `scored` or `pending_ai_review`.
    public var status: String
    public var results: [BdQuizQuestionResult]
    public var pointsEarned: Double
    public var pointsPossible: Double
    public var scorePercent: Double?
    public var provisionalScorePercent: Double
    public var passed: Bool?
}

// MARK: - Answer keys

/// The answer key on a question field (`quizAnswerKey`), read from the
/// field as received.
struct BdQuizAnswerKey {
    struct Accepted {
        /// The key had `text` (an open answer), whatever its value.
        var hasText: Bool
        var text: String?
        var optionId: String?
        var validateWithAI: Bool

        init(_ json: BdJSON) {
            let o = json.objectValue ?? [:]
            hasText = o.keys.contains("text")
            text = o["text"]?.stringValue
            optionId = o["option_id"]?.stringValue
            validateWithAI = o["validate_with_ai"]?.boolValue == true
        }

        /// `"option_id" in answer && answer.option_id`
        var choiceId: String? {
            guard let optionId, !optionId.isEmpty else { return nil }
            return optionId
        }
    }

    var answer: Accepted?
    var noWrongAnswer: Bool
    var additional: [Accepted]
    var hasRationale: Bool
    var whyRight: String?
    var whyWrong: String?
    var whyWrongByOptionId: [String: String]
    var reason: String?
    var points: Double?
    var passingGrade: Double?
    var correctThreshold: Double?
    var partialThreshold: Double?

    init(_ json: BdJSON) {
        let o = json.objectValue ?? [:]
        answer = BdQuizScoring.truthy(o["answer"]) ? Accepted(o["answer"]!) : nil
        noWrongAnswer = BdQuizScoring.truthy(o["no_wrong_answer"])
        additional = (o["additional_accepted_answers"]?.arrayValue ?? []).map(Accepted.init)
        let rationale = o["rationale"]?.objectValue
        hasRationale = rationale != nil
        whyRight = rationale?["why_right"]?.stringValue
        whyWrong = rationale?["why_wrong"]?.stringValue
        whyWrongByOptionId = (rationale?["why_wrong_by_option_id"]?.objectValue ?? [:])
            .compactMapValues(\.stringValue)
        reason = o["reason"]?.stringValue
        points = o["points"]?.doubleValue
        passingGrade = o["passing_grade"]?.doubleValue
        correctThreshold = o["correct_threshold"]?.doubleValue
        partialThreshold = o["partially_correct_threshold"]?.doubleValue
    }

    var accepted: [Accepted] { (answer.map { [$0] } ?? []) + additional }
}

extension BdFormField {
    /// The quiz answer key, when this field is a graded question.
    var quizAnswerKey: BdQuizAnswerKey? {
        BdQuizScoring.truthy(raw["quizAnswerKey"]) ? BdQuizAnswerKey(raw["quizAnswerKey"]!) : nil
    }

    /// Stable ids of the options, in display order (graded quizzes only).
    var quizOptionIds: [String] {
        raw["quizOptionIds"]?.arrayValue?.map { $0.stringValue ?? BdJS.string($0) } ?? []
    }

    /// "Keep these choices in order": never shuffled.
    var quizKeepChoiceOrder: Bool { raw["quizKeepChoiceOrder"]?.boolValue == true }
}

// MARK: - Grading

public enum BdQuizScoring {
    public static let defaultPassingGrade = 80.0
    public static let defaultCorrectThreshold = 85.0
    public static let defaultPartialThreshold = 50.0

    /// Layout, display and payment nodes, never graded.
    public static let nonQuestionTypes: Set<String> = [
        "title", "subtitle", "separator", "flex_row", "input_group", "multi_populator",
        "condition_block", "or_condition", "image", "richtext", "body_text", "bullet_list",
        "table", "calculation", "credit_card",
    ]

    /// JavaScript truthiness of a JSON value.
    static func truthy(_ value: BdJSON?) -> Bool {
        switch value {
        case nil, .null?: return false
        case .bool(let b)?: return b
        case .number(let n)?: return n != 0 && !n.isNaN
        case .string(let s)?: return !s.isEmpty
        case .array?, .object?: return true
        }
    }

    static func stripTags(_ s: String) -> String {
        s.replacing(/<[^>]*>/, with: " ")
    }

    static func jsTrim(_ s: String) -> String {
        s.trimmingCharacters(in: BdJS.jsWhitespace)
    }

    static func isBlank(_ value: BdJSON?) -> Bool {
        switch value {
        case nil, .null?: return true
        case .array(let a)?: return a.isEmpty
        case .string(let s)?: return s.isEmpty || jsTrim(stripTags(s)).isEmpty
        default: return false
        }
    }

    /// Tags stripped, whitespace collapsed, lower-cased: how answers compare.
    public static func normalizedText(_ value: BdJSON?) -> String {
        jsTrim(stripTags(BdJS.string(value)))
            .replacing(/\s+/, with: " ")
            .lowercased()
    }

    static func normalizedText(_ value: String?) -> String {
        normalizedText(value.map { BdJSON.string($0) })
    }

    /// The visible choices of an option question, in order.
    public static func optionLabels(_ field: BdFormField) -> [String] {
        if field.type == "choice_cards" {
            return (field.choiceConfig?.options ?? []).map(\.label)
        }
        return field.options ?? []
    }

    static func cleanRationale(_ value: String?) -> String? {
        guard let value else { return nil }
        let cleaned = jsTrim(value)
        guard !cleaned.isEmpty else { return nil }
        let units = Array(cleaned.utf16)
        return units.count <= 2000 ? cleaned : String(utf16CodeUnits: Array(units.prefix(2000)), count: 2000)
    }

    static func acceptedLabel(_ field: BdFormField, _ answer: BdQuizAnswerKey.Accepted) -> String? {
        if answer.hasText { return cleanRationale(answer.text) }
        guard let optionId = answer.optionId else { return nil }
        let labels = optionLabels(field)
        if let index = field.quizOptionIds.firstIndex(of: optionId), index < labels.count {
            return cleanRationale(labels[index])
        }
        return cleanRationale(optionId)
    }

    /// The accepted answers' labels, attached only to locked or submitted results.
    public static func correctAnswers(_ field: BdFormField) -> [String] {
        guard let key = field.quizAnswerKey else { return [] }
        if key.noWrongAnswer { return ["Any non-empty response"] }
        return key.accepted.compactMap { acceptedLabel(field, $0) }
    }

    static func acceptedOptionIds(_ key: BdQuizAnswerKey) -> Set<String> {
        Set(key.accepted.compactMap(\.choiceId))
    }

    static func selectedOptions(_ field: BdFormField, _ value: BdJSON?) -> [(optionId: String, option: String)] {
        let labels = optionLabels(field)
        let ids = field.quizOptionIds
        let values: [BdJSON?] = value?.arrayValue.map { $0.map(Optional.some) } ?? [value]
        return values.compactMap { selected in
            let normalized = normalizedText(selected)
            guard let index = labels.indices.first(where: { i in
                normalizedText(labels[i]) == normalized
                    || normalizedText(i < ids.count ? ids[i] : nil) == normalized
            }) else { return nil }
            let optionId = index < ids.count ? ids[index] : ""
            let option = labels[index]
            return optionId.isEmpty || option.isEmpty ? nil : (optionId, option)
        }
    }

    static func resultRationale(
        _ field: BdFormField, _ key: BdQuizAnswerKey, _ value: BdJSON?, _ outcome: String
    ) -> BdQuizQuestionRationale? {
        let whyRight = cleanRationale(key.whyRight ?? key.reason)
        let whyWrong = cleanRationale(key.whyWrong)
        let accepted = acceptedOptionIds(key)
        func explain(_ optionId: String, _ isAccepted: Bool) -> String? {
            cleanRationale(isAccepted ? whyRight : (key.whyWrongByOptionId[optionId] ?? whyWrong))
        }
        let selections = selectedOptions(field, value).map { selection in
            let isAccepted = accepted.contains(selection.optionId)
            return BdQuizOptionExplanation(
                optionId: selection.optionId, option: selection.option,
                accepted: isAccepted, explanation: explain(selection.optionId, isAccepted)
            )
        }
        let selectedExplanation = selections.count == 1 ? selections[0].explanation : nil
        let ids = field.quizOptionIds
        let optionExplanations: [BdQuizOptionExplanation] = optionLabels(field).enumerated().compactMap { index, option in
            guard index < ids.count, !ids[index].isEmpty else { return nil }
            let optionId = ids[index]
            let isAccepted = accepted.contains(optionId)
            guard let explanation = explain(optionId, isAccepted) else { return nil }
            return BdQuizOptionExplanation(optionId: optionId, option: option, accepted: isAccepted, explanation: explanation)
        }
        let explanation = isBlank(value) || outcome == "correct" ? whyRight : (selectedExplanation ?? whyWrong)
        if explanation == nil, !selections.contains(where: { $0.explanation != nil }), optionExplanations.isEmpty {
            return nil
        }
        return BdQuizQuestionRationale(
            outcome: outcome,
            explanation: explanation,
            selectedOptions: selections.isEmpty ? nil : selections,
            optionExplanations: optionExplanations.isEmpty ? nil : optionExplanations
        )
    }

    static func matches(_ field: BdFormField, _ accepted: BdQuizAnswerKey.Accepted, _ value: BdJSON?) -> Bool {
        if let optionId = accepted.choiceId {
            let labels = optionLabels(field)
            let index = field.quizOptionIds.firstIndex(of: optionId)
            let label = index.flatMap { $0 < labels.count ? labels[$0] : nil }
            let wantLabel = normalizedText(label)
            let wantId = normalizedText(optionId)
            func hit(_ item: BdJSON?) -> Bool {
                let got = normalizedText(item)
                return got == wantLabel || got == wantId
            }
            if let items = value?.arrayValue { return items.contains { hit($0) } }
            return hit(value)
        }
        return normalizedText(value) == normalizedText(accepted.text)
    }

    /// Whether a result's accepted answers include this choice label.
    public static func isAcceptedLabel(_ result: BdQuizQuestionResult, _ label: String) -> Bool {
        let wanted = normalizedText(label)
        return (result.correctAnswers ?? []).contains { normalizedText($0) == wanted }
    }

    static func conditionMatches(_ field: BdFormField, _ data: [String: BdJSON]) -> Bool {
        guard let rule = field.conditionRule, let fieldId = rule.fieldId, !fieldId.isEmpty else { return true }
        let current = data[fieldId]
        let clauses: [(op: String, value: String)] = (rule.clauses?.isEmpty == false)
            ? rule.clauses!.map { ($0.operator, $0.value ?? "") }
            : [(rule.operator ?? "eq", rule.value ?? "")]
        return clauses.allSatisfy { clause in
            switch clause.op {
            case "eq": return BdJS.string(current) == clause.value
            case "neq": return BdJS.string(current) != clause.value
            case "contains": return normalizedText(current).contains(normalizedText(clause.value))
            case "gt": return BdJS.number(current) > BdJS.number(clause.value)
            case "lt": return BdJS.number(current) < BdJS.number(clause.value)
            case "is_empty": return isBlank(current)
            case "is_not_empty": return !isBlank(current)
            default: return true
            }
        }
    }

    static func safePoints(_ value: Double?) -> Double {
        guard let value, value.isFinite else { return 1 }
        return min(1000, max(0, value))
    }

    static func safePercent(_ value: Double?, _ fallback: Double) -> Double {
        guard let value, value.isFinite else { return fallback }
        return min(100, max(0, value))
    }

    /// Deterministically score a submission. A free-text answer that a key
    /// lets AI judge goes to `pendingAi` only when it doesn't already match an
    /// accepted answer exactly; BD grades those, never the app.
    public static func score(
        fields: [BdFormField], answers: [String: BdJSON], passingScore: Double
    ) -> BdQuizScore {
        var results: [BdQuizQuestionResult] = []

        func grade(_ field: BdFormField, _ value: BdJSON?, _ resultId: String) {
            if nonQuestionTypes.contains(field.type) { return }
            let label = field.label.isEmpty ? "Untitled question" : field.label
            guard let key = field.quizAnswerKey else {
                results.append(BdQuizQuestionResult(
                    fieldId: resultId, label: label, answer: value, status: .unscored,
                    pointsPossible: 0, pointsEarned: 0
                ))
                return
            }
            let points = safePoints(key.points)
            let correctThreshold = safePercent(key.correctThreshold, defaultCorrectThreshold)
            let passingGrade = safePercent(key.passingGrade, defaultPassingGrade)
            let partialThreshold = min(correctThreshold, safePercent(key.partialThreshold, defaultPartialThreshold))
            let accepted = key.accepted
            let correct = key.noWrongAnswer ? !isBlank(value) : accepted.contains { matches(field, $0, value) }
            let pendingAi = !correct && !isBlank(value) && accepted.contains { $0.hasText && $0.validateWithAI }
            let accuracy: Double? = pendingAi ? nil : (correct ? 100 : 0)
            let status: BdQuizQuestionStatus
            if let accuracy {
                status = accuracy >= correctThreshold ? .correct
                    : accuracy >= partialThreshold ? .partiallyCorrect : .incorrect
            } else {
                status = .pendingAi
            }
            let rationale = status == .pendingAi ? nil : resultRationale(field, key, value, status.rawValue)
            let correctAnswers = correctAnswers(field)
            let reason = key.reason.map(jsTrim).flatMap { $0.isEmpty ? nil : $0 }
            results.append(BdQuizQuestionResult(
                fieldId: resultId, label: label, answer: value, status: status,
                pointsPossible: points,
                pointsEarned: accuracy.map { points * ($0 / 100) } ?? 0,
                accuracyPercent: accuracy,
                passingGrade: passingGrade,
                correctThreshold: correctThreshold,
                partiallyCorrectThreshold: partialThreshold,
                passed: accuracy.map { $0 >= passingGrade },
                correctAnswers: correctAnswers.isEmpty ? nil : correctAnswers,
                rationale: rationale,
                reason: reason
            ))
        }

        func walk(_ nodes: [BdFormField], _ scope: [String: BdJSON], _ prefix: String) {
            for field in nodes {
                switch field.type {
                case "condition_block":
                    if conditionMatches(field, scope) { walk(field.children ?? [], scope, prefix) }
                case "input_group", "flex_row", "or_condition":
                    walk(field.children ?? [], scope, prefix)
                case "multi_populator":
                    for (index, instance) in (scope[field.id]?.arrayValue ?? []).enumerated() {
                        if let record = instance.objectValue {
                            walk(field.children ?? [], record, "\(prefix)\(field.id)[\(index)].")
                        }
                    }
                default:
                    grade(field, scope[field.id], "\(prefix)\(field.id)")
                }
            }
        }
        walk(fields, answers, "")

        let scorable = results.filter { $0.pointsPossible > 0 }
        let possible = scorable.reduce(0) { $0 + $1.pointsPossible }
        let earned = scorable.reduce(0) { $0 + $1.pointsEarned }
        let provisional = possible == 0 ? 0 : (earned / possible) * 100
        let pending = scorable.contains { $0.status == .pendingAi }
        let percent: Double? = pending ? nil : provisional
        return BdQuizScore(
            status: pending ? "pending_ai_review" : "scored",
            results: results,
            pointsEarned: earned,
            pointsPossible: possible,
            scorePercent: percent,
            provisionalScorePercent: provisional,
            passed: percent.map { $0 >= passingScore }
        )
    }
}
