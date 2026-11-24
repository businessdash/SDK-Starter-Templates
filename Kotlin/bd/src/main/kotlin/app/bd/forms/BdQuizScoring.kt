package app.bd.forms

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json

// Quiz grading: answer keys, accepted answers, thresholds, rationale and the
// deterministic score BD records for an attempt.
//
// A port of the TypeScript forms-core's `quiz-scoring.ts` (itself a port of
// BD's `packages/forms/src/quizzes/scoring.ts`). `QuizParityTest` replays the
// TypeScript answers in `quiz-parity.json`; change them together.
//
// In an app this grades LOCAL quizzes, ones whose fields carry their answer
// keys. An invited quiz arrives without keys and BD grades every answer.

/** Reads and writes quiz JSON: lenient in, every value out. */
internal val quizJson: Json = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    encodeDefaults = true
    explicitNulls = false
}

/** A question's verdict. An unknown one reads as [INCORRECT], as the web shows it. */
@Serializable(with = BdQuizQuestionStatus.Serializer::class)
public enum class BdQuizQuestionStatus(public val wire: String) {
    CORRECT("correct"),
    PARTIALLY_CORRECT("partially_correct"),
    INCORRECT("incorrect"),
    PENDING_AI("pending_ai"),
    UNSCORED("unscored"),
    ;

    internal object Serializer : KSerializer<BdQuizQuestionStatus> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("BdQuizQuestionStatus", PrimitiveKind.STRING)
        override fun serialize(encoder: Encoder, value: BdQuizQuestionStatus): Unit = encoder.encodeString(value.wire)
        override fun deserialize(decoder: Decoder): BdQuizQuestionStatus {
            val raw = decoder.decodeString()
            return entries.firstOrNull { it.wire == raw } ?: INCORRECT
        }
    }
}

@Serializable
public data class BdQuizOptionExplanation(
    public val optionId: String,
    public val option: String,
    public val accepted: Boolean,
    public val explanation: String? = null,
)

@Serializable
public data class BdQuizQuestionRationale(
    /** `correct`, `partially_correct` or `incorrect`. */
    public val outcome: String,
    public val explanation: String? = null,
    public val selectedOptions: List<BdQuizOptionExplanation>? = null,
    public val optionExplanations: List<BdQuizOptionExplanation>? = null,
)

@Serializable
public data class BdQuizQuestionResult(
    public val fieldId: String,
    public val label: String,
    public val answer: BdJson? = null,
    public val status: BdQuizQuestionStatus,
    public val pointsPossible: Double,
    public val pointsEarned: Double,
    /** Null while a free-text answer waits for AI review. */
    public val accuracyPercent: Double? = null,
    public val passingGrade: Double? = null,
    public val correctThreshold: Double? = null,
    public val partiallyCorrectThreshold: Double? = null,
    public val passed: Boolean? = null,
    /** Revealed only once an answer is locked or the quiz is submitted. */
    public val correctAnswers: List<String>? = null,
    public val rationale: BdQuizQuestionRationale? = null,
    public val reason: String? = null,
    public val validation: Validation? = null,
) {
    @Serializable
    public data class Validation(
        public val source: String,
        public val confidence: Double? = null,
        public val rationale: String? = null,
    )
}

/** A scored submission. */
@Serializable
public data class BdQuizScore(
    /** `scored` or `pending_ai_review`. */
    public val status: String,
    public val results: List<BdQuizQuestionResult>,
    public val pointsEarned: Double,
    public val pointsPossible: Double,
    public val scorePercent: Double?,
    public val provisionalScorePercent: Double,
    public val passed: Boolean?,
)

/** The answer key on a question field (`quizAnswerKey`), as received. */
internal class BdQuizAnswerKey(json: BdJson) {
    class Accepted(json: BdJson) {
        private val o = json.objectValue ?: emptyMap()

        /** The key had `text` (an open answer), whatever its value. */
        val hasText: Boolean = "text" in o
        val text: String? = o["text"]?.stringValue
        val optionId: String? = o["option_id"]?.stringValue
        val validateWithAI: Boolean = o["validate_with_ai"]?.boolValue == true

        /** `"option_id" in answer && answer.option_id` */
        val choiceId: String? get() = optionId?.takeIf { it.isNotEmpty() }
    }

    private val o = json.objectValue ?: emptyMap()
    private val rationale = o["rationale"]?.objectValue

    val answer: Accepted? = o["answer"]?.takeIf { BdQuizScoring.truthy(it) }?.let(::Accepted)
    val noWrongAnswer: Boolean = BdQuizScoring.truthy(o["no_wrong_answer"])
    val additional: List<Accepted> = o["additional_accepted_answers"]?.arrayValue?.map(::Accepted) ?: emptyList()
    val whyRight: String? = rationale?.get("why_right")?.stringValue
    val whyWrong: String? = rationale?.get("why_wrong")?.stringValue
    val whyWrongByOptionId: Map<String, String> =
        rationale?.get("why_wrong_by_option_id")?.objectValue?.mapNotNull { (k, v) -> v.stringValue?.let { k to it } }?.toMap()
            ?: emptyMap()
    val reason: String? = o["reason"]?.stringValue
    val points: Double? = o["points"]?.doubleValue
    val passingGrade: Double? = o["passing_grade"]?.doubleValue
    val correctThreshold: Double? = o["correct_threshold"]?.doubleValue
    val partialThreshold: Double? = o["partially_correct_threshold"]?.doubleValue

    val accepted: List<Accepted> get() = listOfNotNull(answer) + additional
}

/** The quiz answer key, when this field is a graded question. */
internal val BdFormField.quizAnswerKey: BdQuizAnswerKey?
    get() = raw["quizAnswerKey"]?.takeIf { BdQuizScoring.truthy(it) }?.let(::BdQuizAnswerKey)

/** Stable ids of the options, in display order (graded quizzes only). */
internal val BdFormField.quizOptionIds: List<String>
    get() = raw["quizOptionIds"]?.arrayValue?.map { it.stringValue ?: BdJS.string(it) } ?: emptyList()

/** "Keep these choices in order": never shuffled. */
internal val BdFormField.quizKeepChoiceOrder: Boolean
    get() = raw["quizKeepChoiceOrder"]?.boolValue == true

public object BdQuizScoring {
    public const val DEFAULT_PASSING_GRADE: Double = 80.0
    public const val DEFAULT_CORRECT_THRESHOLD: Double = 85.0
    public const val DEFAULT_PARTIAL_THRESHOLD: Double = 50.0

    /** Layout, display and payment nodes, never graded. */
    public val nonQuestionTypes: Set<String> = setOf(
        "title", "subtitle", "separator", "flex_row", "input_group", "multi_populator",
        "condition_block", "or_condition", "image", "richtext", "body_text", "bullet_list",
        "table", "calculation", "credit_card",
    )

    private val tags = Regex("<[^>]*>")
    // JavaScript's `\s`, spelled out: Android's ICU regex rejects `(?U)`.
    private val spaces = Regex("[${BdJS.WS_CLASS}]+")

    /** JavaScript truthiness of a JSON value. */
    internal fun truthy(value: BdJson?): Boolean = when (value) {
        null, BdJson.Null -> false
        is BdJson.Bool -> value.value
        is BdJson.Num -> value.value != 0.0 && !value.value.isNaN()
        is BdJson.Str -> value.value.isNotEmpty()
        is BdJson.Arr, is BdJson.Obj -> true
    }

    internal fun stripTags(s: String): String = tags.replace(s, " ")

    internal fun isBlank(value: BdJson?): Boolean = when (value) {
        null, BdJson.Null -> true
        is BdJson.Arr -> value.items.isEmpty()
        is BdJson.Str -> value.value.isEmpty() || BdJS.trim(stripTags(value.value)).isEmpty()
        else -> false
    }

    /** Tags stripped, whitespace collapsed, lower-cased: how answers compare. */
    public fun normalizedText(value: BdJson?): String =
        spaces.replace(BdJS.trim(stripTags(BdJS.string(value))), " ").lowercase()

    internal fun normalizedText(value: String?): String = normalizedText(value?.let { BdJson.Str(it) })

    /** The visible choices of an option question, in order. */
    public fun optionLabels(field: BdFormField): List<String> =
        if (field.type == "choice_cards") field.choiceConfig?.options?.map { it.label } ?: emptyList()
        else field.options ?: emptyList()

    internal fun cleanRationale(value: String?): String? {
        val cleaned = BdJS.trim(value ?: return null)
        return if (cleaned.isEmpty()) null else cleaned.take(2000)
    }

    private fun acceptedLabel(field: BdFormField, answer: BdQuizAnswerKey.Accepted): String? {
        if (answer.hasText) return cleanRationale(answer.text)
        val optionId = answer.optionId ?: return null
        val index = field.quizOptionIds.indexOf(optionId)
        return cleanRationale(optionLabels(field).getOrNull(index) ?: optionId)
    }

    /** The accepted answers' labels, attached only to locked or submitted results. */
    public fun correctAnswers(field: BdFormField): List<String> {
        val key = field.quizAnswerKey ?: return emptyList()
        if (key.noWrongAnswer) return listOf("Any non-empty response")
        return key.accepted.mapNotNull { acceptedLabel(field, it) }
    }

    private fun selectedOptions(field: BdFormField, value: BdJson?): List<Pair<String, String>> {
        val labels = optionLabels(field)
        val ids = field.quizOptionIds
        val values: List<BdJson?> = value?.arrayValue ?: listOf(value)
        return values.mapNotNull { selected ->
            val normalized = normalizedText(selected)
            val index = labels.indices.firstOrNull { i ->
                normalizedText(labels[i]) == normalized || normalizedText(ids.getOrNull(i)) == normalized
            } ?: return@mapNotNull null
            val optionId = ids.getOrNull(index) ?: ""
            val option = labels[index]
            if (optionId.isEmpty() || option.isEmpty()) null else optionId to option
        }
    }

    private fun resultRationale(field: BdFormField, key: BdQuizAnswerKey, value: BdJson?, outcome: String): BdQuizQuestionRationale? {
        val whyRight = cleanRationale(key.whyRight ?: key.reason)
        val whyWrong = cleanRationale(key.whyWrong)
        val accepted = key.accepted.mapNotNull { it.choiceId }.toSet()
        fun explain(optionId: String, isAccepted: Boolean) =
            cleanRationale(if (isAccepted) whyRight else key.whyWrongByOptionId[optionId] ?: whyWrong)
        val selections = selectedOptions(field, value).map { (optionId, option) ->
            val isAccepted = optionId in accepted
            BdQuizOptionExplanation(optionId, option, isAccepted, explain(optionId, isAccepted))
        }
        val selectedExplanation = if (selections.size == 1) selections[0].explanation else null
        val ids = field.quizOptionIds
        val optionExplanations = optionLabels(field).mapIndexedNotNull { index, option ->
            val optionId = ids.getOrNull(index)?.takeIf { it.isNotEmpty() } ?: return@mapIndexedNotNull null
            val isAccepted = optionId in accepted
            explain(optionId, isAccepted)?.let { BdQuizOptionExplanation(optionId, option, isAccepted, it) }
        }
        val explanation = if (isBlank(value) || outcome == "correct") whyRight else selectedExplanation ?: whyWrong
        if (explanation == null && selections.none { it.explanation != null } && optionExplanations.isEmpty()) return null
        return BdQuizQuestionRationale(
            outcome = outcome,
            explanation = explanation,
            selectedOptions = selections.ifEmpty { null },
            optionExplanations = optionExplanations.ifEmpty { null },
        )
    }

    private fun matches(field: BdFormField, accepted: BdQuizAnswerKey.Accepted, value: BdJson?): Boolean {
        val optionId = accepted.choiceId ?: return normalizedText(value) == normalizedText(accepted.text)
        val label = optionLabels(field).getOrNull(field.quizOptionIds.indexOf(optionId))
        val wantLabel = normalizedText(label)
        val wantId = normalizedText(optionId)
        fun hit(item: BdJson?): Boolean = normalizedText(item).let { it == wantLabel || it == wantId }
        val items = value?.arrayValue
        return if (items != null) items.any { hit(it) } else hit(value)
    }

    /** Whether a result's accepted answers include this choice label. */
    public fun isAcceptedLabel(result: BdQuizQuestionResult, label: String): Boolean {
        val wanted = normalizedText(label)
        return result.correctAnswers.orEmpty().any { normalizedText(it) == wanted }
    }

    private fun conditionMatches(field: BdFormField, data: Map<String, BdJson>): Boolean {
        val rule = field.conditionRule ?: return true
        val fieldId = rule.fieldId?.takeIf { it.isNotEmpty() } ?: return true
        val current = data[fieldId]
        val clauses = rule.clauses?.takeIf { it.isNotEmpty() }?.map { it.operator to (it.value ?: "") }
            ?: listOf((rule.operator ?: "eq") to (rule.value ?: ""))
        return clauses.all { (op, expected) ->
            when (op) {
                "eq" -> BdJS.string(current) == expected
                "neq" -> BdJS.string(current) != expected
                "contains" -> normalizedText(current).contains(normalizedText(expected))
                "gt" -> BdJS.number(current) > BdJS.number(expected)
                "lt" -> BdJS.number(current) < BdJS.number(expected)
                "is_empty" -> isBlank(current)
                "is_not_empty" -> !isBlank(current)
                else -> true
            }
        }
    }

    private fun safePoints(value: Double?): Double =
        if (value == null || !value.isFinite()) 1.0 else value.coerceIn(0.0, 1000.0)

    private fun safePercent(value: Double?, fallback: Double): Double =
        if (value == null || !value.isFinite()) fallback else value.coerceIn(0.0, 100.0)

    /**
     * Deterministically score a submission. A free-text answer that a key lets
     * AI judge goes to `PENDING_AI` only when it doesn't already match an
     * accepted answer exactly; BD grades those, never the app.
     */
    public fun score(fields: List<BdFormField>, answers: Map<String, BdJson>, passingScore: Double): BdQuizScore {
        val results = mutableListOf<BdQuizQuestionResult>()

        fun grade(field: BdFormField, value: BdJson?, resultId: String) {
            if (field.type in nonQuestionTypes) return
            val label = field.label.ifEmpty { "Untitled question" }
            val key = field.quizAnswerKey
            if (key == null) {
                results += BdQuizQuestionResult(
                    fieldId = resultId, label = label, answer = value, status = BdQuizQuestionStatus.UNSCORED,
                    pointsPossible = 0.0, pointsEarned = 0.0,
                )
                return
            }
            val points = safePoints(key.points)
            val correctThreshold = safePercent(key.correctThreshold, DEFAULT_CORRECT_THRESHOLD)
            val passingGrade = safePercent(key.passingGrade, DEFAULT_PASSING_GRADE)
            val partialThreshold = minOf(correctThreshold, safePercent(key.partialThreshold, DEFAULT_PARTIAL_THRESHOLD))
            val accepted = key.accepted
            val correct = if (key.noWrongAnswer) !isBlank(value) else accepted.any { matches(field, it, value) }
            val pendingAi = !correct && !isBlank(value) && accepted.any { it.hasText && it.validateWithAI }
            val accuracy: Double? = if (pendingAi) null else if (correct) 100.0 else 0.0
            val status = when {
                accuracy == null -> BdQuizQuestionStatus.PENDING_AI
                accuracy >= correctThreshold -> BdQuizQuestionStatus.CORRECT
                accuracy >= partialThreshold -> BdQuizQuestionStatus.PARTIALLY_CORRECT
                else -> BdQuizQuestionStatus.INCORRECT
            }
            val correctAnswers = correctAnswers(field)
            results += BdQuizQuestionResult(
                fieldId = resultId,
                label = label,
                answer = value,
                status = status,
                pointsPossible = points,
                pointsEarned = accuracy?.let { points * (it / 100) } ?: 0.0,
                accuracyPercent = accuracy,
                passingGrade = passingGrade,
                correctThreshold = correctThreshold,
                partiallyCorrectThreshold = partialThreshold,
                passed = accuracy?.let { it >= passingGrade },
                correctAnswers = correctAnswers.ifEmpty { null },
                rationale = if (status == BdQuizQuestionStatus.PENDING_AI) null else resultRationale(field, key, value, status.wire),
                reason = key.reason?.let(BdJS::trim)?.takeIf { it.isNotEmpty() },
            )
        }

        fun walk(nodes: List<BdFormField>, scope: Map<String, BdJson>, prefix: String) {
            for (field in nodes) {
                when (field.type) {
                    "condition_block" -> if (conditionMatches(field, scope)) walk(field.children.orEmpty(), scope, prefix)
                    "input_group", "flex_row", "or_condition" -> walk(field.children.orEmpty(), scope, prefix)
                    "multi_populator" -> scope[field.id]?.arrayValue?.forEachIndexed { index, instance ->
                        instance.objectValue?.let { walk(field.children.orEmpty(), it, "$prefix${field.id}[$index].") }
                    }
                    else -> grade(field, scope[field.id], "$prefix${field.id}")
                }
            }
        }
        walk(fields, answers, "")

        val scorable = results.filter { it.pointsPossible > 0 }
        val possible = scorable.sumOf { it.pointsPossible }
        val earned = scorable.sumOf { it.pointsEarned }
        val provisional = if (possible == 0.0) 0.0 else (earned / possible) * 100
        val pending = scorable.any { it.status == BdQuizQuestionStatus.PENDING_AI }
        val percent = if (pending) null else provisional
        return BdQuizScore(
            status = if (pending) "pending_ai_review" else "scored",
            results = results,
            pointsEarned = earned,
            pointsPossible = possible,
            scorePercent = percent,
            provisionalScorePercent = provisional,
            passed = percent?.let { it >= passingScore },
        )
    }
}
