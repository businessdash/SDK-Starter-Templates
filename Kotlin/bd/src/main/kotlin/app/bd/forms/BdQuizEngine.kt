package app.bd.forms

import java.security.SecureRandom
import java.time.Instant
import java.time.OffsetDateTime
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Quizzes: the forms engine taking a graded assessment.
//
// A port of the TypeScript forms-core's `quiz.ts`. A BD quiz IS a form: its
// questions are ordinary fields carrying an answer key, and the quiz adds how
// it's taken: immediate or end-of-quiz feedback, an elapsed or countdown
// timer, choices and questions as written or in a seeded shuffle, "I don't
// know", and results (or a thank-you, or "sign in to see your results").
//
// Everything here is pure: a [BdQuizState] in, a new one out, and
// [BdQuizEngine.screen] turns it into exactly what a screen shows, texts
// included. [BdQuizController] adds the async parts (BD calls, the clock,
// autosave) and `:bd-forms`' `BdQuiz` draws it in Compose. Times are epoch
// milliseconds, as in JavaScript, so a state travels to and from a server
// unchanged.

public enum class BdQuizFeedbackMode {
    /** Each answer locks and its verdict shows before moving on. */
    IMMEDIATE,

    /** Every verdict shows after the whole quiz is submitted. */
    END,
}

public enum class BdQuizLayout {
    /** One question at a time. */
    SINGLE,

    /** Every question on one page (end feedback only). */
    ALL,
}

/** How a quiz is shown and taken. */
public data class BdQuizOptions(
    /** The quiz's fields: the question document. */
    public val fields: List<BdFormField>,
    /** Which fields are questions. Null: every field with an answer key. */
    public val questionFieldIds: List<String>? = null,
    public val feedbackMode: BdQuizFeedbackMode = BdQuizFeedbackMode.END,
    /** Percent needed to pass (local runs; BD decides for invited quizzes). */
    public val passingScore: Double? = null,
    public val showTimer: Boolean = false,
    /** A countdown; the quiz submits itself at zero. */
    public val timeLimitMinutes: Double? = null,
    /** False = interview mode: the taker gets a thank-you, never a score. */
    public val showScore: Boolean = true,
    /** Results wait for the invited account: show a sign-in prompt instead. */
    public val resultsLocked: Boolean = false,
    /** Where that prompt sends the taker. `BdQuiz` sets one when given `onSignIn`. */
    public val signInHref: String? = null,
    /** Multiple-choice options in a shuffled order (off: as written). */
    public val shuffleChoices: Boolean = false,
    /** Questions in a shuffled order (off: as written). */
    public val shuffleQuestions: Boolean = false,
    /**
     * What the shuffle is built from: one taker, one order. An invitation uses
     * its id. Null: a new order each time a local run starts.
     */
    public val seed: String? = null,
    /** Local runs: ask only this many questions (after any shuffle). */
    public val questionLimit: Int? = null,
    /** Offer "I don't know" on multiple-choice questions that aren't required. */
    public val allowDontKnow: Boolean = false,
    /** End feedback only: one question at a time, or all on one page. */
    public val layout: BdQuizLayout = BdQuizLayout.SINGLE,
    /** Graded here: the fields carry answer keys (or a practice run). */
    public val local: Boolean? = null,
    /** Offer "Retake" when it ends. Null: local runs can. */
    public val canRestart: Boolean? = null,
    public val words: BdQuizWords = BdQuizWords(),
) {
    public companion object {
        /** Reads the TypeScript `QuizOptions` JSON (words aside), as leniently as it does. */
        public fun fromJson(json: BdJson): BdQuizOptions {
            val o = json.objectValue ?: emptyMap()
            fun bool(key: String) = o[key]?.boolValue
            return BdQuizOptions(
                fields = o["fields"]?.arrayValue?.map { BdFormField.make(it) } ?: emptyList(),
                questionFieldIds = o["questionFieldIds"]?.arrayValue?.mapNotNull { it.stringValue },
                feedbackMode = if (o["feedbackMode"]?.stringValue == "immediate") BdQuizFeedbackMode.IMMEDIATE else BdQuizFeedbackMode.END,
                passingScore = o["passingScore"]?.doubleValue,
                showTimer = bool("showTimer") ?: false,
                timeLimitMinutes = o["timeLimitMinutes"]?.doubleValue,
                showScore = bool("showScore") ?: true,
                resultsLocked = bool("resultsLocked") ?: false,
                signInHref = o["signInHref"]?.stringValue,
                shuffleChoices = bool("shuffleChoices") ?: false,
                shuffleQuestions = bool("shuffleQuestions") ?: false,
                seed = o["seed"]?.stringValue,
                questionLimit = o["questionLimit"]?.doubleValue?.takeIf { it.isFinite() }?.let { floor(it).toInt() },
                allowDontKnow = bool("allowDontKnow") ?: false,
                layout = if (o["layout"]?.stringValue == "all") BdQuizLayout.ALL else BdQuizLayout.SINGLE,
                local = bool("local"),
                canRestart = bool("canRestart"),
            )
        }
    }
}

/** [BdQuizOptions], resolved: questions arranged, defaults filled in. */
public class BdQuizConfig(options: BdQuizOptions, seed: String) {
    public val local: Boolean = options.local ?: false
    public val questions: List<BdFormField> = BdQuizArrange.questions(options, seed, local)
    public val feedbackMode: BdQuizFeedbackMode = options.feedbackMode
    public val passingScore: Double = options.passingScore?.takeIf { it.isFinite() } ?: BdQuizScoring.DEFAULT_PASSING_GRADE
    public val timeLimitMinutes: Int? = options.timeLimitMinutes?.takeIf { it.isFinite() && it > 0 }?.let { floor(it).toInt() }
    public val timerEnabled: Boolean = options.showTimer || timeLimitMinutes != null
    public val showScore: Boolean = options.showScore
    public val resultsLocked: Boolean = options.resultsLocked
    public val signInHref: String? = options.signInHref
    public val allowDontKnow: Boolean = options.allowDontKnow
    public val layout: BdQuizLayout =
        if (options.feedbackMode == BdQuizFeedbackMode.END && options.layout == BdQuizLayout.ALL) BdQuizLayout.ALL else BdQuizLayout.SINGLE
    public val canRestart: Boolean = options.canRestart ?: false
    public val words: BdQuizWords = options.words
}

// ── Questions, choices and order ────────────────────────────────────────────

public object BdQuizArrange {
    /** Field types asked as multiple choice: lettered cards, shuffle-able. */
    public val multipleChoiceTypes: Set<String> = setOf("radio", "checkbox", "multi_select", "choice_cards")

    public fun isMultipleChoice(field: BdFormField): Boolean =
        field.type in multipleChoiceTypes && BdQuizScoring.optionLabels(field).isNotEmpty()

    /** Several answers may be picked. */
    public fun isMultiSelect(field: BdFormField): Boolean =
        field.type == "checkbox" || field.type == "multi_select" ||
            (field.type == "choice_cards" && field.choiceConfig?.mode == "multi")

    /** A, B, C … Z, then 27, 28 … */
    public fun choiceLetter(index: Int): String = if (index < 26) ('A' + index).toString() else (index + 1).toString()

    /** The questions in document order: listed ids, or fields with answer keys. */
    public fun questionFields(fields: List<BdFormField>, ids: List<String>?): List<BdFormField> {
        val explicit = ids?.toSet()
        val out = mutableListOf<BdFormField>()
        fun walk(nodes: List<BdFormField>) {
            for (field in nodes) {
                val id = field.raw["id"]?.stringValue ?: ""
                if (id.isNotEmpty() && (explicit?.contains(id) ?: BdQuizScoring.truthy(field.raw["quizAnswerKey"]))) out += field
                field.children?.let(::walk)
            }
        }
        walk(fields)
        return out
    }

    /** FNV-1a over the text's UTF-8 bytes: the shuffle's seed (unsigned 32-bit). */
    public fun seedHash(text: String): Long {
        var hash = 0x811C9DC5.toInt()
        for (byte in text.toByteArray(Charsets.UTF_8)) {
            hash = (hash xor (byte.toInt() and 0xFF)) * 0x01000193
        }
        return hash.toLong() and 0xFFFFFFFFL
    }

    /**
     * A shuffled order of `0 until count` (Fisher–Yates over mulberry32), the
     * same for the same seed in every port.
     */
    public fun seededOrder(count: Int, seed: String): List<Int> {
        val order = MutableList(count) { it }
        var state = seedHash(seed).toInt()
        fun next(): Long {
            state += 0x6D2B79F5
            var t = state
            t = (t xor (t ushr 15)) * (t or 1)
            t = t xor (t + (t xor (t ushr 7)) * (t or 61))
            return (t xor (t ushr 14)).toLong() and 0xFFFFFFFFL
        }
        for (i in count - 1 downTo 1) {
            val j = ((next() * (i + 1)) ushr 32).toInt()
            val held = order[i]
            order[i] = order[j]
            order[j] = held
        }
        return order
    }

    private fun reorder(items: List<BdJson>, order: List<Int>): List<BdJson> =
        if (items.size == order.size) order.map { items[it] } else items

    /**
     * One question with its options shuffled: labels, card content and the
     * grading ids move together, so answers still score the same. A question
     * marked "keep these choices in order" stays as written.
     */
    public fun shuffledChoices(field: BdFormField, seed: String): BdFormField {
        if (!isMultipleChoice(field) || field.quizKeepChoiceOrder) return field
        val raw = field.raw.objectValue?.let { LinkedHashMap(it) } ?: return field
        val order = seededOrder(BdQuizScoring.optionLabels(field).size, "$seed:${field.id}")
        val config = raw["choiceConfig"]?.objectValue
        val cards = config?.get("options")?.arrayValue
        if (field.type == "choice_cards" && config != null && cards != null) {
            raw["choiceConfig"] = BdJson.Obj(LinkedHashMap(config).apply { put("options", BdJson.Arr(reorder(cards, order))) })
        } else {
            raw["options"]?.arrayValue?.let { raw["options"] = BdJson.Arr(reorder(it, order)) }
        }
        raw["quizOptionIds"]?.arrayValue?.let { raw["quizOptionIds"] = BdJson.Arr(reorder(it, order)) }
        return BdFormField.make(BdJson.Obj(raw))
    }

    /** A seed for a run that wasn't given one. */
    public fun randomSeed(): String {
        val bytes = ByteArray(8).also { SecureRandom().nextBytes(it) }
        return bytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
    }

    /**
     * The questions as this taker gets them: picked, ordered (shuffled when
     * asked), limited (local runs), with options shuffled when asked.
     */
    public fun questions(options: BdQuizOptions, seed: String, local: Boolean): List<BdFormField> {
        var questions = questionFields(options.fields, options.questionFieldIds)
        if (options.shuffleQuestions) {
            val shuffled = questions
            questions = seededOrder(shuffled.size, "$seed:questions").map { shuffled[it] }
        }
        val limit = options.questionLimit
        if (local && limit != null && limit > 0) questions = questions.take(limit)
        return if (options.shuffleChoices) questions.map { shuffledChoices(it, seed) } else questions
    }
}

// ── State ───────────────────────────────────────────────────────────────────

@Serializable
public enum class BdQuizPending {
    @SerialName("start") START,
    @SerialName("lock") LOCK,
    @SerialName("submit") SUBMIT,
}

/**
 * A finished attempt as the taker sees it. The numbers are null when BD
 * withheld them (scores hidden, or results waiting for the invited account).
 */
@Serializable
public data class BdQuizCompletion(
    /** `scored` or `pending_ai_review`. */
    public val status: String,
    public val results: List<BdQuizQuestionResult>,
    public val pointsEarned: Double? = null,
    public val pointsPossible: Double? = null,
    public val scorePercent: Double? = null,
    public val provisionalScorePercent: Double? = null,
    public val passed: Boolean? = null,
    public val id: String? = null,
    /** An ISO string from BD, or epoch ms. */
    public val submittedAt: BdJson? = null,
    public val timedOut: Boolean? = null,
    public val durationSeconds: Double? = null,
)

/** BD's answer to "start the clock". Times are ISO strings or epoch ms. */
@Serializable
public data class BdQuizStartInfo(
    public val startedAt: BdJson,
    public val deadlineAt: BdJson? = null,
    public val serverNow: Double,
)

/** What a resumed quiz already has (from BD's invitation, or a saved run). */
@Serializable
public data class BdQuizInitial(
    public val answers: Map<String, BdJson>? = null,
    public val results: List<BdQuizQuestionResult>? = null,
    public val completion: BdQuizCompletion? = null,
    public val startedAt: BdJson? = null,
    public val deadlineAt: BdJson? = null,
    public val serverNow: Double? = null,
    public val dontKnow: List<String>? = null,
)

/** Everything that changes while a quiz is taken. Plain JSON: a server can keep it between requests. */
@Serializable
public data class BdQuizState(
    /** The question on screen (single layout). */
    public val index: Int,
    public val answers: Map<String, BdJson>,
    /** Questions answered "I don't know". */
    public val dontKnow: List<String>,
    /** Locked answers' verdicts (immediate feedback), in question order. */
    public val results: List<BdQuizQuestionResult>,
    /** Immediate feedback: the current question's verdict is on screen. */
    public val revealed: Boolean,
    public val completion: BdQuizCompletion?,
    /** Server-clock ms. */
    public val startedAt: Double?,
    public val deadlineAt: Double?,
    /** Server clock minus this device's clock, ms. */
    public val clockOffset: Double,
    /** Local runs: time verdicts have been on screen (the clock stops). */
    public val pausedMs: Double,
    public val revealStartedAt: Double?,
    public val pending: BdQuizPending?,
    public val error: String?,
    /** Field id → message, for required questions left empty. */
    public val fieldErrors: Map<String, String>,
    /** The deadline was reached and the quiz is (being) submitted. */
    public val timeUp: Boolean,
)

/** What `advance` asks of the host: nothing, a lock, or a submission. */
public sealed class BdQuizStep {
    public abstract val state: BdQuizState

    public data class None(override val state: BdQuizState) : BdQuizStep()

    public data class Lock(override val state: BdQuizState, public val fieldId: String, public val answer: BdJson) : BdQuizStep()

    public data class Submit(override val state: BdQuizState, public val answers: Map<String, BdJson>) : BdQuizStep()
}

// ── Steps ───────────────────────────────────────────────────────────────────

public object BdQuizEngine {
    /** Epoch ms from an ISO string or epoch ms; null when missing or bad. */
    public fun timestamp(value: BdJson?): Double? = when (value) {
        is BdJson.Num -> value.value.takeIf { it.isFinite() }
        is BdJson.Str -> value.value.takeIf { it.isNotEmpty() }?.let { s ->
            runCatching { Instant.parse(s).toEpochMilli().toDouble() }.getOrNull()
                ?: runCatching { OffsetDateTime.parse(s).toInstant().toEpochMilli().toDouble() }.getOrNull()
        }
        else -> null
    }

    internal fun result(state: BdQuizState, fieldId: String): BdQuizQuestionResult? =
        state.results.firstOrNull { it.fieldId == fieldId }

    /** A fresh (or resumed) quiz. `now` is this device's clock, epoch ms. */
    public fun initialState(config: BdQuizConfig, initial: BdQuizInitial = BdQuizInitial(), now: Double): BdQuizState {
        val results = initial.results ?: emptyList()
        val locked = results.map { it.fieldId }.toSet()
        val count = config.questions.size
        val firstOpen = config.questions.indexOfFirst { it.id !in locked }
        val allLocked = count > 0 && firstOpen == -1
        return BdQuizState(
            index = if (allLocked) count - 1 else max(firstOpen, 0),
            answers = initial.answers ?: emptyMap(),
            dontKnow = initial.dontKnow ?: emptyList(),
            results = results,
            revealed = config.feedbackMode == BdQuizFeedbackMode.IMMEDIATE && allLocked,
            completion = initial.completion,
            startedAt = timestamp(initial.startedAt),
            deadlineAt = timestamp(initial.deadlineAt),
            clockOffset = initial.serverNow?.let { it - now } ?: 0.0,
            pausedMs = 0.0,
            revealStartedAt = null,
            pending = null,
            error = null,
            fieldErrors = emptyMap(),
            timeUp = false,
        )
    }

    /** The server clock now. */
    public fun clock(state: BdQuizState, now: Double): Double = now + state.clockOffset

    internal fun busy(state: BdQuizState): Boolean = state.pending != null || state.completion != null

    private fun isLocked(config: BdQuizConfig, state: BdQuizState, fieldId: String) =
        config.feedbackMode == BdQuizFeedbackMode.IMMEDIATE && result(state, fieldId) != null

    internal fun emptyAnswer(field: BdFormField): BdJson =
        if (BdQuizArrange.isMultiSelect(field)) BdJson.Arr(emptyList()) else BdJson.Str("")

    /** The taker answered (or changed) a question. */
    public fun setAnswer(config: BdQuizConfig, state: BdQuizState, fieldId: String, value: BdJson): BdQuizState {
        if (busy(state) || isLocked(config, state, fieldId)) return state
        if (config.questions.none { it.id == fieldId }) return state
        return state.copy(
            answers = state.answers + (fieldId to value),
            dontKnow = state.dontKnow - fieldId,
            fieldErrors = state.fieldErrors - fieldId,
            error = null,
        )
    }

    /** Whether "I don't know" is offered on this question. */
    public fun offersDontKnow(config: BdQuizConfig, field: BdFormField): Boolean =
        config.allowDontKnow && BdQuizArrange.isMultipleChoice(field) && !field.required

    /** "I don't know": the answer is left empty and marked as such. */
    public fun chooseDontKnow(config: BdQuizConfig, state: BdQuizState, fieldId: String): BdQuizState {
        val field = config.questions.firstOrNull { it.id == fieldId } ?: return state
        if (!offersDontKnow(config, field) || busy(state) || isLocked(config, state, fieldId)) return state
        return state.copy(
            answers = state.answers + (fieldId to emptyAnswer(field)),
            dontKnow = state.dontKnow.filter { it != fieldId } + fieldId,
            fieldErrors = state.fieldErrors - fieldId,
            error = null,
        )
    }

    /** Required questions in `fields` left empty → field id → message. */
    public fun missing(config: BdQuizConfig, state: BdQuizState, fields: List<BdFormField>): Map<String, String> =
        fields.filter { it.required && BdFormRules.isEmpty(it, state.answers[it.id]) }.associate {
            it.id to BdQuizWords.fill(config.words.required, mapOf("label" to it.label.ifEmpty { "This question" }))
        }

    /**
     * The main button. Immediate: lock the answer, then move on (or finish).
     * End, single: next question (or submit). End, all: submit.
     */
    public fun advance(config: BdQuizConfig, state: BdQuizState, now: Double): BdQuizStep {
        if (busy(state) || (config.timerEnabled && state.startedAt == null)) return BdQuizStep.None(state)
        val count = config.questions.size
        val question = config.questions.getOrNull(state.index) ?: return BdQuizStep.None(state)
        val last = state.index >= count - 1

        if (config.feedbackMode == BdQuizFeedbackMode.IMMEDIATE) {
            if (state.revealed) {
                val resumed = endRevealPause(state, now)
                return if (last) BdQuizStep.Submit(resumed.copy(pending = BdQuizPending.SUBMIT, error = null), state.answers)
                else BdQuizStep.None(resumed.copy(index = state.index + 1, revealed = false))
            }
            val errors = missing(config, state, listOf(question))
            if (errors.isNotEmpty()) return BdQuizStep.None(state.copy(fieldErrors = errors))
            val answer = state.answers[question.id]?.takeIf { !it.isNull } ?: emptyAnswer(question)
            return BdQuizStep.Lock(state.copy(pending = BdQuizPending.LOCK, error = null, fieldErrors = emptyMap()), question.id, answer)
        }

        val checking = if (config.layout == BdQuizLayout.ALL) config.questions else listOf(question)
        val errors = missing(config, state, checking)
        if (errors.isNotEmpty()) return BdQuizStep.None(state.copy(fieldErrors = errors))
        if (config.layout == BdQuizLayout.SINGLE && !last) {
            return BdQuizStep.None(state.copy(index = state.index + 1, fieldErrors = emptyMap(), error = null))
        }
        return BdQuizStep.Submit(state.copy(pending = BdQuizPending.SUBMIT, error = null, fieldErrors = emptyMap()), state.answers)
    }

    /** End feedback, one at a time: the previous question. */
    public fun back(config: BdQuizConfig, state: BdQuizState): BdQuizState {
        if (busy(state) || config.feedbackMode != BdQuizFeedbackMode.END || config.layout != BdQuizLayout.SINGLE) return state
        return if (state.index > 0) state.copy(index = state.index - 1, fieldErrors = emptyMap(), error = null) else state
    }

    /** The clock was started (from BD, or a local start). */
    public fun started(state: BdQuizState, info: BdQuizStartInfo, now: Double): BdQuizState = state.copy(
        pending = null,
        error = null,
        clockOffset = info.serverNow - now,
        startedAt = timestamp(info.startedAt),
        deadlineAt = timestamp(info.deadlineAt),
    )

    /** A local start: now, with the deadline the time limit sets. */
    public fun localStart(config: BdQuizConfig, now: Double): BdQuizStartInfo = BdQuizStartInfo(
        startedAt = BdJson.Num(now),
        deadlineAt = config.timeLimitMinutes?.let { BdJson.Num(now + it * 60_000.0) },
        serverNow = now,
    )

    /** A locked answer's verdict arrived: show it (and stop a local clock). */
    public fun locked(
        config: BdQuizConfig,
        state: BdQuizState,
        fieldId: String,
        answer: BdJson,
        result: BdQuizQuestionResult,
        now: Double,
    ): BdQuizState = state.copy(
        pending = null,
        error = null,
        answers = state.answers + (fieldId to answer),
        results = state.results.filter { it.fieldId != fieldId } + result,
        revealed = true,
        revealStartedAt = if (config.local) clock(state, now) else state.revealStartedAt,
    )

    /** The verdict is closing: a local clock runs again. */
    public fun endRevealPause(state: BdQuizState, now: Double): BdQuizState {
        val since = state.revealStartedAt ?: return state
        return state.copy(revealStartedAt = null, pausedMs = state.pausedMs + max(0.0, clock(state, now) - since))
    }

    public fun completed(state: BdQuizState, completion: BdQuizCompletion): BdQuizState =
        state.copy(pending = null, error = null, completion = completion)

    public fun failed(state: BdQuizState, message: String): BdQuizState = state.copy(pending = null, error = message)

    /** How long a run took and whether it ran out of time (local runs). */
    public fun localTiming(state: BdQuizState, now: Double): Pair<Boolean, Double?> {
        val clock = clock(state, now)
        return Pair(
            state.deadlineAt?.let { clock >= it + state.pausedMs } ?: false,
            state.startedAt?.let { max(0.0, jsRound((clock - it) / 1000)) },
        )
    }

    /** Grade a local run: every question, with timing. */
    public fun localCompletion(config: BdQuizConfig, state: BdQuizState, answers: Map<String, BdJson>, now: Double): BdQuizCompletion {
        val score = BdQuizScoring.score(config.questions, answers, config.passingScore)
        val (timedOut, duration) = localTiming(state, now)
        return BdQuizCompletion(
            status = score.status, results = score.results,
            pointsEarned = score.pointsEarned, pointsPossible = score.pointsPossible,
            scorePercent = score.scorePercent, provisionalScorePercent = score.provisionalScorePercent,
            passed = score.passed, timedOut = timedOut, durationSeconds = duration,
        )
    }

    /** Grade one question locally (immediate feedback, local run). */
    public fun localResult(config: BdQuizConfig, fieldId: String, answer: BdJson): BdQuizQuestionResult? {
        val field = config.questions.firstOrNull { it.id == fieldId } ?: return null
        return BdQuizScoring.score(listOf(field), mapOf(fieldId to answer), config.passingScore).results.firstOrNull()
    }

    private fun revealPauseNow(config: BdQuizConfig, state: BdQuizState, now: Double): Double {
        val since = state.revealStartedAt
        return if (!config.local || since == null) 0.0 else max(0.0, clock(state, now) - since)
    }

    /** The deadline everything counts down to; a local run adds paused time. */
    public fun effectiveDeadline(config: BdQuizConfig, state: BdQuizState, now: Double): Double? {
        val deadline = state.deadlineAt ?: return null
        return if (config.local) deadline + state.pausedMs + revealPauseNow(config, state, now) else deadline
    }

    /** Time's up: the host should submit now. True once, until [timeUp] records it. */
    public fun deadlinePassed(config: BdQuizConfig, state: BdQuizState, now: Double): Boolean {
        val deadline = effectiveDeadline(config, state, now) ?: return false
        return clock(state, now) >= deadline && state.completion == null && state.pending == null && !state.timeUp
    }

    public fun timeUp(state: BdQuizState): BdQuizState = state.copy(timeUp = true, pending = BdQuizPending.SUBMIT, error = null)

    // ── Display helpers ──

    /** `m:ss`, or `h:mm:ss` from an hour. */
    public fun durationLabel(totalSeconds: Double): String {
        val seconds = max(0.0, floor(totalSeconds)).toLong()
        val hours = seconds / 3600
        val minutes = (seconds % 3600) / 60
        val rest = seconds % 60
        fun pad(n: Long) = n.toString().padStart(2, '0')
        return if (hours > 0) "$hours:${pad(minutes)}:${pad(rest)}" else "$minutes:${pad(rest)}"
    }

    /** An answer as one line of text. */
    public fun answerText(value: BdJson?, words: BdQuizWords = BdQuizWords()): String = when (value) {
        is BdJson.Arr -> if (value.items.isEmpty()) words.noAnswer else value.items.joinToString(", ") { answerText(it, words) }
        null, BdJson.Null -> words.noAnswer
        is BdJson.Bool -> if (value.value) words.yes else words.no
        is BdJson.Obj -> value.fields.values.mapNotNull { part ->
            when (part) {
                is BdJson.Str -> part.value.takeIf { BdJS.trim(it).isNotEmpty() }
                is BdJson.Num -> BdJS.string(part.value)
                else -> null
            }
        }.let { if (it.isEmpty()) words.noAnswer else it.joinToString(", ") }
        else -> BdJS.trim(BdQuizScoring.stripTags(BdJS.string(value))).ifEmpty { words.noAnswer }
    }

    /** JavaScript's `Math.round`: half rounds up, toward +∞. */
    internal fun jsRound(value: Double): Double = floor(value + 0.5)

    /** Whole percent, rounded half up. */
    public fun percent(value: Double): Int = jsRound(value).toInt()

    internal fun ceilSeconds(ms: Double): Int = ceil(ms / 1000).toInt()

    internal fun clamp(value: Double, low: Double, high: Double): Double = min(high, max(low, value))
}
