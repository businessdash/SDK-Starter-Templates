@file:OptIn(ExperimentalSerializationApi::class)

package app.bd.forms

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonClassDiscriminator

// Exactly what a quiz screen shows, texts included: the TypeScript
// forms-core's `QuizView`. `BdQuiz` (in :bd-forms) draws it; a custom UI can
// draw it too.

@Serializable
public enum class BdQuizTone {
    @SerialName("correct") CORRECT,
    @SerialName("partial") PARTIAL,
    @SerialName("incorrect") INCORRECT,
    @SerialName("pending") PENDING,
    @SerialName("unscored") UNSCORED,
    @SerialName("unsure") UNSURE,
}

@Serializable
public enum class BdQuizChoiceState {
    @SerialName("idle") IDLE,
    @SerialName("selected") SELECTED,
    @SerialName("correct") CORRECT,
    @SerialName("incorrect") INCORRECT,
    @SerialName("dimmed") DIMMED,
}

@Serializable
public data class BdQuizChoice(
    public val letter: String,
    public val label: String,
    public val selected: Boolean,
    public val state: BdQuizChoiceState,
)

@Serializable
public data class BdQuizDontKnowChoice(
    public val label: String,
    public val selected: Boolean,
    public val state: BdQuizChoiceState,
)

/** Writes a field as its id, as the fixtures carry it. */
internal object FieldIdSerializer : KSerializer<BdFormField> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("BdFormFieldId", PrimitiveKind.STRING)
    override fun serialize(encoder: Encoder, value: BdFormField): Unit = encoder.encodeString(value.id)
    override fun deserialize(decoder: Decoder): BdFormField = error("A quiz screen is written, never read.")
}

@Serializable
public data class BdQuizQuestion(
    @Serializable(with = FieldIdSerializer::class)
    public val field: BdFormField,
    /** 1-based, in the order asked. */
    public val number: Int,
    public val label: String,
    public val value: BdJson? = null,
    public val error: String? = null,
    /** The answer can't change (locked, or the quiz is busy). */
    public val locked: Boolean,
    /** Lettered choices for multiple choice; null: render the field itself. */
    public val choices: List<BdQuizChoice>? = null,
    public val multiple: Boolean,
    public val dontKnow: BdQuizDontKnowChoice? = null,
)

@Serializable
public data class BdQuizOptionNote(public val option: String, public val explanation: String)

@Serializable
public data class BdQuizFeedback(
    public val fieldId: String,
    public val label: String,
    public val badge: Badge,
    public val accuracy: String? = null,
    public val answerLabel: String,
    public val answer: String,
    public val acceptedLabel: String,
    public val accepted: String? = null,
    public val whyLabel: String,
    public val why: String? = null,
    /** Explanations for each picked option, when several were picked. */
    public val selected: List<BdQuizOptionNote>,
    public val others: Others? = null,
) {
    @Serializable
    public data class Badge(public val label: String, public val tone: BdQuizTone)

    @Serializable
    public data class Others(public val label: String, public val items: List<BdQuizOptionNote>)
}

@Serializable
public data class BdQuizTimer(
    public val label: String,
    public val value: String,
    public val seconds: Int,
    public val countdown: Boolean,
    /** A minute or less left. */
    public val warning: Boolean,
    public val paused: Boolean,
    public val pausedLabel: String,
    /** Percent of time left, for a bar; null without a countdown. */
    public val progress: Double? = null,
)

@Serializable
public enum class BdQuizActionId {
    @SerialName("start") START,
    @SerialName("lock") LOCK,
    @SerialName("next") NEXT,
    @SerialName("back") BACK,
    @SerialName("submit") SUBMIT,
    @SerialName("finish") FINISH,
    @SerialName("retake") RETAKE,
    @SerialName("signIn") SIGN_IN,
}

@Serializable
public data class BdQuizAction(
    public val id: BdQuizActionId,
    public val label: String,
    public val enabled: Boolean,
    public val primary: Boolean,
    public val href: String? = null,
)

@Serializable
@JsonClassDiscriminator("kind")
public sealed class BdQuizDone {
    /** Score, tally and per-question feedback. */
    @Serializable
    @SerialName("results")
    public data class Results(
        public val eyebrow: String,
        public val score: String,
        public val tally: String? = null,
        public val summary: String,
        public val message: String? = null,
        public val timing: String? = null,
        public val passed: Boolean? = null,
        public val items: List<Item>,
    ) : BdQuizDone() {
        @Serializable
        public data class Item(
            public val number: Int,
            public val label: String,
            public val tone: BdQuizTone,
            public val feedback: BdQuizFeedback,
        )
    }

    /** Interview mode: a thank-you, never a score. */
    @Serializable
    @SerialName("submitted")
    public data class Submitted(public val eyebrow: String, public val title: String, public val body: String) : BdQuizDone()

    /** Results wait for the invited account. */
    @Serializable
    @SerialName("locked")
    public data class Locked(public val eyebrow: String, public val title: String, public val body: String) : BdQuizDone()
}

@Serializable
public enum class BdQuizPhase {
    @SerialName("empty") EMPTY,
    @SerialName("ready") READY,
    @SerialName("question") QUESTION,
    @SerialName("all") ALL,
    @SerialName("feedback") FEEDBACK,
    @SerialName("done") DONE,
}

@Serializable
public data class BdQuizScreen(
    public val phase: BdQuizPhase,
    public val empty: String? = null,
    public val ready: Ready? = null,
    public val timer: BdQuizTimer? = null,
    public val progress: Progress? = null,
    /** End feedback: when answers and rationale appear. */
    public val notice: String? = null,
    public val questions: List<BdQuizQuestion> = emptyList(),
    public val feedback: BdQuizFeedback? = null,
    public val done: BdQuizDone? = null,
    public val actions: List<BdQuizAction> = emptyList(),
    public val error: String? = null,
    public val busy: Boolean,
) {
    @Serializable
    public data class Ready(
        /** `hourglass` (a countdown) or `clock` (elapsed time). */
        public val icon: String,
        public val title: String,
        public val body: String,
    )

    @Serializable
    public data class Progress(public val position: String, public val note: String? = null, public val percent: Double)
}

// ── Building the screen ─────────────────────────────────────────────────────

private fun badge(w: BdQuizWords, result: BdQuizQuestionResult, dontKnow: Boolean): BdQuizFeedback.Badge {
    if (dontKnow && result.status != BdQuizQuestionStatus.CORRECT) return BdQuizFeedback.Badge(w.dontKnow, BdQuizTone.UNSURE)
    return when (result.status) {
        BdQuizQuestionStatus.CORRECT -> BdQuizFeedback.Badge(w.correct, BdQuizTone.CORRECT)
        BdQuizQuestionStatus.PARTIALLY_CORRECT -> BdQuizFeedback.Badge(w.partiallyCorrect, BdQuizTone.PARTIAL)
        BdQuizQuestionStatus.PENDING_AI -> BdQuizFeedback.Badge(w.pendingAi, BdQuizTone.PENDING)
        BdQuizQuestionStatus.UNSCORED -> BdQuizFeedback.Badge(w.unscored, BdQuizTone.UNSCORED)
        BdQuizQuestionStatus.INCORRECT -> BdQuizFeedback.Badge(w.incorrect, BdQuizTone.INCORRECT)
    }
}

/** One verdict as a feedback card. */
public fun BdQuizEngine.feedback(w: BdQuizWords, result: BdQuizQuestionResult, dontKnow: Boolean = false): BdQuizFeedback {
    val answer = result.answer
    val unanswered = when (answer) {
        null, BdJson.Null -> true
        is BdJson.Str -> answer.value.isEmpty()
        is BdJson.Arr -> answer.items.isEmpty()
        else -> false
    }
    val picked = result.rationale?.selectedOptions.orEmpty().mapNotNull { o -> o.explanation?.let { BdQuizOptionNote(o.option, it) } }
    val others = result.rationale?.optionExplanations.orEmpty()
        .mapNotNull { o -> if (o.accepted) null else o.explanation?.let { BdQuizOptionNote(o.option, it) } }
    return BdQuizFeedback(
        fieldId = result.fieldId,
        label = result.label,
        badge = badge(w, result, dontKnow),
        accuracy = result.accuracyPercent?.let { BdQuizWords.fill(w.accurate, mapOf("percent" to percent(it).toString())) },
        answerLabel = w.yourAnswer,
        answer = if (dontKnow && unanswered) w.dontKnow else answerText(answer, w),
        acceptedLabel = w.acceptedAnswer,
        accepted = result.correctAnswers?.takeIf { it.isNotEmpty() }?.joinToString(" · "),
        whyLabel = if (unanswered) w.whyAccepted else w.why,
        why = result.rationale?.explanation,
        selected = if (picked.size > 1) picked else emptyList(),
        others = if (others.isEmpty()) null else BdQuizFeedback.Others(w.whyOthers, others),
    )
}

/** The timer as shown, or null when the quiz has none or hasn't started. */
public fun BdQuizEngine.timer(config: BdQuizConfig, state: BdQuizState, now: Double): BdQuizTimer? {
    val startedAt = state.startedAt
    if (!config.timerEnabled || startedAt == null) return null
    val clock = clock(state, now)
    val deadline = effectiveDeadline(config, state, now)
    val seconds = if (deadline != null) max(0.0, ceil((deadline - clock) / 1000)).toInt()
    else max(0.0, floor((clock - startedAt) / 1000)).toInt()
    return BdQuizTimer(
        label = if (deadline != null) config.words.timeRemaining else config.words.elapsedTime,
        value = durationLabel(seconds.toDouble()),
        seconds = seconds,
        countdown = deadline != null,
        warning = deadline != null && seconds <= 60,
        paused = config.local && deadline != null && state.revealed,
        pausedLabel = config.words.paused,
        // Against the time allowed, not the stretched deadline: a local run's
        // pauses push the deadline out, and the bar holds still through them
        // instead of shrinking.
        progress = deadline?.let {
            val allowed = (state.deadlineAt ?: startedAt) - startedAt
            if (allowed > 0) clamp(((it - clock) / allowed) * 100, 0.0, 100.0) else 0.0
        },
    )
}

private fun choices(field: BdFormField, value: BdJson?, result: BdQuizQuestionResult?): List<BdQuizChoice> {
    val picked = (value?.arrayValue ?: listOf(value)).map { BdJS.string(it) }.toSet()
    val scored = !result?.correctAnswers.isNullOrEmpty()
    return BdQuizScoring.optionLabels(field).mapIndexed { index, label ->
        val selected = label in picked
        val state = when {
            result == null -> if (selected) BdQuizChoiceState.SELECTED else BdQuizChoiceState.IDLE
            scored && BdQuizScoring.isAcceptedLabel(result, label) -> BdQuizChoiceState.CORRECT
            selected -> if (scored) BdQuizChoiceState.INCORRECT else BdQuizChoiceState.SELECTED
            else -> BdQuizChoiceState.DIMMED
        }
        BdQuizChoice(BdQuizArrange.choiceLetter(index), label, selected, state)
    }
}

private fun question(config: BdQuizConfig, state: BdQuizState, field: BdFormField, index: Int): BdQuizQuestion {
    val value = state.answers[field.id]
    val result = if (config.feedbackMode == BdQuizFeedbackMode.IMMEDIATE) BdQuizEngine.result(state, field.id) else null
    val chosen = field.id in state.dontKnow
    return BdQuizQuestion(
        field = field,
        number = index + 1,
        label = field.label,
        value = value,
        error = state.fieldErrors[field.id],
        locked = result != null || BdQuizEngine.busy(state),
        choices = if (BdQuizArrange.isMultipleChoice(field)) choices(field, value, result) else null,
        multiple = BdQuizArrange.isMultiSelect(field),
        dontKnow = if (!BdQuizEngine.offersDontKnow(config, field)) null else BdQuizDontKnowChoice(
            label = config.words.dontKnow,
            selected = chosen,
            state = when {
                result != null -> if (chosen) BdQuizChoiceState.INCORRECT else BdQuizChoiceState.DIMMED
                else -> if (chosen) BdQuizChoiceState.SELECTED else BdQuizChoiceState.IDLE
            },
        ),
    )
}

private fun answered(config: BdQuizConfig, state: BdQuizState): Int =
    config.questions.count { !BdFormRules.isEmpty(it, state.answers[it.id]) || it.id in state.dontKnow }

private fun resultsMessage(w: BdQuizWords, percent: Int): String = when {
    percent >= 90 -> w.messageExcellent
    percent >= 75 -> w.messageSolid
    percent >= 50 -> w.messageGettingThere
    else -> w.messageKeepGoing
}

private fun done(config: BdQuizConfig, state: BdQuizState, completion: BdQuizCompletion): BdQuizDone {
    val w = config.words
    if (!config.showScore) return BdQuizDone.Submitted(w.submittedEyebrow, w.submittedTitle, w.submittedBody)
    if (config.resultsLocked) return BdQuizDone.Locked(w.lockedEyebrow, w.lockedTitle, w.lockedBody)
    val score = BdQuizEngine.percent(completion.scorePercent ?: completion.provisionalScorePercent ?: 0.0)
    val scorable = completion.results.filter { it.pointsPossible > 0 }
    val correct = scorable.count { it.status == BdQuizQuestionStatus.CORRECT }
    val pending = completion.status == "pending_ai_review"
    val timing = if (completion.timedOut == true || completion.durationSeconds != null) {
        val label = if (completion.timedOut == true) w.timeLimitReached else w.completed
        completion.durationSeconds?.let {
            BdQuizWords.fill(w.inDuration, mapOf("label" to label, "duration" to BdQuizEngine.durationLabel(it)))
        } ?: label
    } else {
        null
    }
    return BdQuizDone.Results(
        eyebrow = w.resultsEyebrow,
        score = "$score%",
        tally = if (scorable.isEmpty()) null else BdQuizWords.fill(w.tally, mapOf("correct" to "$correct", "total" to "${scorable.size}")),
        summary = if (pending) w.provisional else if (completion.passed == true) w.passed else w.notPassed,
        message = if (pending) null else resultsMessage(w, score),
        timing = timing,
        passed = completion.passed,
        items = completion.results.mapIndexed { index, result ->
            val card = BdQuizEngine.feedback(w, result, result.fieldId in state.dontKnow)
            BdQuizDone.Results.Item(index + 1, result.label, card.badge.tone, card)
        },
    )
}

/** Exactly what the quiz screen shows now. */
public fun BdQuizEngine.screen(config: BdQuizConfig, state: BdQuizState, now: Double): BdQuizScreen {
    val w = config.words
    val base = BdQuizScreen(phase = BdQuizPhase.EMPTY, error = state.error, busy = state.pending != null)
    val count = config.questions.size

    state.completion?.let { completion ->
        val done = done(config, state, completion)
        val isLocked = done is BdQuizDone.Locked
        val actions = buildList {
            if (isLocked && config.signInHref != null) {
                add(BdQuizAction(BdQuizActionId.SIGN_IN, w.lockedAction, enabled = true, primary = true, href = config.signInHref))
            }
            if (config.canRestart) add(BdQuizAction(BdQuizActionId.RETAKE, w.retake, enabled = true, primary = !isLocked))
        }
        return base.copy(phase = BdQuizPhase.DONE, done = done, actions = actions)
    }

    if (count == 0) return base.copy(empty = w.empty)

    if (config.timerEnabled && state.startedAt == null) {
        val limit = config.timeLimitMinutes
        val body = when (limit) {
            null -> w.readyElapsed
            1 -> w.readyLimitOne
            else -> BdQuizWords.fill(w.readyLimitMany, mapOf("minutes" to "$limit"))
        }
        return base.copy(
            phase = BdQuizPhase.READY,
            ready = BdQuizScreen.Ready(if (limit != null) "hourglass" else "clock", w.readyTitle, body),
            actions = listOf(
                BdQuizAction(
                    BdQuizActionId.START, if (state.pending == BdQuizPending.START) w.starting else w.start,
                    enabled = state.pending == null, primary = true,
                ),
            ),
        )
    }

    val timer = timer(config, state, now)
    val idle = state.pending == null
    val submit = BdQuizAction(
        BdQuizActionId.SUBMIT, if (state.pending == BdQuizPending.SUBMIT) w.submitting else w.submit, enabled = idle, primary = true,
    )

    if (config.feedbackMode == BdQuizFeedbackMode.END && config.layout == BdQuizLayout.ALL) {
        val done = answered(config, state)
        return base.copy(
            phase = BdQuizPhase.ALL,
            timer = timer,
            progress = BdQuizScreen.Progress(
                BdQuizWords.fill(w.answeredOf, mapOf("answered" to "$done", "total" to "$count")),
                null,
                done.toDouble() / count * 100,
            ),
            notice = if (config.showScore) w.endNotice else w.endNoticeHidden,
            questions = config.questions.mapIndexed { i, q -> question(config, state, q, i) },
            actions = listOf(submit),
        )
    }

    val field = config.questions[state.index.coerceIn(0, count - 1)]
    val last = state.index >= count - 1
    val position = BdQuizWords.fill(w.questionOf, mapOf("number" to "${state.index + 1}", "total" to "$count"))

    if (config.feedbackMode == BdQuizFeedbackMode.IMMEDIATE) {
        val result = result(state, field.id)
        val showing = state.revealed && result != null
        val percent = max((if (state.revealed) state.results.size else state.index).toDouble() / count * 100, 4.0)
        val finishLabel = if (config.showScore && !config.resultsLocked) w.seeResults else w.finish
        return base.copy(
            phase = if (showing) BdQuizPhase.FEEDBACK else BdQuizPhase.QUESTION,
            timer = timer,
            progress = BdQuizScreen.Progress(position, w.locksWhenChecked, percent),
            questions = listOf(question(config, state, field, state.index)),
            feedback = if (showing) feedback(w, result!!, field.id in state.dontKnow) else null,
            actions = listOf(
                if (showing) {
                    BdQuizAction(
                        if (last) BdQuizActionId.FINISH else BdQuizActionId.NEXT,
                        when {
                            state.pending == BdQuizPending.SUBMIT -> w.submitting
                            last -> finishLabel
                            else -> w.nextQuestion
                        },
                        enabled = idle, primary = true,
                    )
                } else {
                    BdQuizAction(
                        BdQuizActionId.LOCK,
                        when {
                            state.pending == BdQuizPending.LOCK -> w.checking
                            config.local -> w.checkAnswer
                            else -> w.lockAnswer
                        },
                        enabled = idle, primary = true,
                    )
                },
            ),
        )
    }

    val actions = buildList {
        if (state.index > 0) add(BdQuizAction(BdQuizActionId.BACK, w.back, enabled = idle, primary = false))
        add(if (last) submit else BdQuizAction(BdQuizActionId.NEXT, w.next, enabled = idle, primary = true))
    }
    return base.copy(
        phase = BdQuizPhase.QUESTION,
        timer = timer,
        progress = BdQuizScreen.Progress(position, null, max(state.index.toDouble() / count * 100, 4.0)),
        notice = if (config.showScore) w.endNotice else w.endNoticeHidden,
        questions = listOf(question(config, state, field, state.index)),
        actions = actions,
    )
}
