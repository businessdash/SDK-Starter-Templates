package app.bd.forms

import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * A quiz being taken: the pure engine plus its async parts (BD calls, the
 * clock, autosave). `BdQuiz` (in :bd-forms) draws one; a custom UI can collect
 * [screen] and call the same methods.
 *
 * ```kotlin
 * // A local quiz: the fields carry answer keys, graded on the device.
 * val quiz = BdQuizController(BdQuizOptions(fields, feedbackMode = BdQuizFeedbackMode.IMMEDIATE), scope = scope)
 * ```
 *
 * Call it from one thread (the main one in an app). [scope] runs the clock and
 * autosave; cancel it, or call [stop], when the quiz goes away.
 *
 * @param backend BD's side ([BdQuizzes.invitationBackend] / `practiceBackend`).
 *   Null for a local run, graded here.
 * @param initial where a resumed quiz was left ([BdQuizInvitation.initial]).
 * @param clock this device's clock, epoch ms (a test hook).
 */
public class BdQuizController(
    options: BdQuizOptions,
    private val scope: CoroutineScope,
    private val backend: BdQuizBackend? = null,
    initial: BdQuizInitial = BdQuizInitial(),
    private val draftDelayMs: Long = 750,
    private val clock: () -> Double = { System.currentTimeMillis().toDouble() },
) {
    private val local: Boolean = options.local ?: (backend == null)
    private val options: BdQuizOptions = options.copy(local = local, canRestart = options.canRestart ?: local)

    public var config: BdQuizConfig = BdQuizConfig(this.options, options.seed ?: BdQuizArrange.randomSeed())
        private set

    private val _state = MutableStateFlow(BdQuizEngine.initialState(config, initial, clock()))
    public val state: StateFlow<BdQuizState> = _state.asStateFlow()

    private val _screen = MutableStateFlow(BdQuizEngine.screen(config, _state.value, clock()))

    /** Exactly what the quiz screen shows now. */
    public val screen: StateFlow<BdQuizScreen> = _screen.asStateFlow()

    /** Called once, when the quiz ends (scored, submitted, or timed out). */
    public var onDone: ((BdQuizCompletion) -> Unit)? = null

    private var ticker: Job? = null
    private var draftJob: Job? = null
    private var lastDraft: Map<String, BdJson> = _state.value.answers

    /** Bumped by a retake: replies to an earlier run are dropped. */
    private var generation = 0

    init {
        syncClock()
    }

    private val current: BdQuizState get() = _state.value

    // ── Taking the quiz ──

    public fun setAnswer(fieldId: String, value: BdJson) {
        val before = current
        set(BdQuizEngine.setAnswer(config, current, fieldId, value))
        if (current != before) scheduleDraft()
    }

    /** Pick or unpick a lettered choice: one answer, or toggled in a multi-select's list. */
    public fun choose(fieldId: String, label: String) {
        val field = config.questions.firstOrNull { it.id == fieldId } ?: return
        if (BdQuizArrange.isMultiSelect(field)) {
            val picked = current.answers[fieldId]?.arrayValue.orEmpty()
            val choice = BdJson.Str(label)
            setAnswer(fieldId, BdJson.Arr(if (choice in picked) picked - choice else picked + choice))
        } else {
            setAnswer(fieldId, BdJson.Str(label))
        }
    }

    public fun chooseDontKnow(fieldId: String) {
        val before = current
        set(BdQuizEngine.chooseDontKnow(config, current, fieldId))
        if (current != before) scheduleDraft()
    }

    /** Run a screen action by id ([BdQuizAction.id]). [BdQuizActionId.SIGN_IN] is the host's. */
    public suspend fun perform(action: BdQuizActionId) {
        when (action) {
            BdQuizActionId.START -> start()
            BdQuizActionId.LOCK, BdQuizActionId.NEXT, BdQuizActionId.SUBMIT, BdQuizActionId.FINISH -> advance()
            BdQuizActionId.BACK -> back()
            BdQuizActionId.RETAKE -> restart()
            BdQuizActionId.SIGN_IN -> Unit
        }
    }

    /**
     * [perform], run in the quiz's own scope: a submit or a lock carries on
     * when the screen that started it goes away (a rotation, a tab switch).
     */
    public fun launch(action: BdQuizActionId): Job = scope.launch { perform(action) }

    /** Start the clock (timed quizzes). */
    public suspend fun start() {
        if (current.startedAt != null || current.pending != null) return
        val run = generation
        set(current.copy(pending = BdQuizPending.START, error = null))
        try {
            val info = backend?.start?.invoke() ?: BdQuizEngine.localStart(config, clock())
            if (run == generation) set(BdQuizEngine.started(current, info, clock()))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (run == generation) set(BdQuizEngine.failed(current, message(e, config.words.startFailed)))
        }
    }

    /** The main button: lock and check, next, or submit. */
    public suspend fun advance() {
        val step = BdQuizEngine.advance(config, current, clock())
        set(step.state)
        when (step) {
            is BdQuizStep.Lock -> lock(step.fieldId, step.answer)
            is BdQuizStep.Submit -> submit(step.answers, config.words.submitFailed)
            is BdQuizStep.None -> Unit
        }
    }

    public fun back() {
        set(BdQuizEngine.back(config, current))
    }

    /** A fresh run (local quizzes): a new order when anything is shuffled. */
    public fun restart() {
        if (!local) return
        generation++
        draftJob?.cancel()
        draftJob = null
        config = BdQuizConfig(options, BdQuizArrange.randomSeed())
        _state.value = BdQuizEngine.initialState(config, BdQuizInitial(), clock())
        lastDraft = current.answers
        publish()
        syncClock()
    }

    /** Re-read the clock: update the timer, submit when time is up. Runs on its own every half second while timed. */
    public fun tick() {
        if (!BdQuizEngine.deadlinePassed(config, current, clock())) {
            publish()
            return
        }
        val answers = current.answers
        set(BdQuizEngine.timeUp(current))
        val saveDraft = if (config.feedbackMode == BdQuizFeedbackMode.END) backend?.saveDraft else null
        scope.launch {
            // The submission carries the answers anyway; the draft is a backstop.
            if (saveDraft != null) runCatching { saveDraft(answers) }
            submit(answers, config.words.timedSubmitFailed)
        }
    }

    /** Stop the clock and autosave, and drop any reply still on its way. */
    public fun stop() {
        generation++
        ticker?.cancel()
        draftJob?.cancel()
        ticker = null
        draftJob = null
    }

    // ── Internals ──

    private fun publish() {
        _screen.value = BdQuizEngine.screen(config, current, clock())
    }

    private fun set(next: BdQuizState) {
        if (next == current) {
            publish()
            return
        }
        val finished = current.completion == null && next.completion != null
        _state.value = next
        publish()
        syncClock()
        if (finished) next.completion?.let { onDone?.invoke(it) }
    }

    private fun syncClock() {
        val running = config.timerEnabled && current.startedAt != null && current.completion == null
        if (running && ticker == null) {
            ticker = scope.launch {
                while (isActive) {
                    delay(500)
                    tick()
                }
            }
        } else if (!running) {
            ticker?.cancel()
            ticker = null
        }
    }

    private fun scheduleDraft() {
        val saveDraft = backend?.saveDraft ?: return
        if (config.feedbackMode != BdQuizFeedbackMode.END) return
        if (config.timerEnabled && current.startedAt == null) return
        draftJob?.cancel()
        draftJob = scope.launch {
            delay(draftDelayMs)
            val answers = current.answers
            if (answers == lastDraft) return@launch
            lastDraft = answers
            try {
                saveDraft(answers)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                set(current.copy(error = message(e, config.words.draftFailed)))
            }
        }
    }

    private suspend fun submit(answers: Map<String, BdJson>, failure: String) {
        draftJob?.cancel()
        draftJob = null
        val run = generation
        try {
            var completion = if (backend != null) {
                backend.submit(answers, config.questions.map { it.id })
            } else {
                BdQuizEngine.localCompletion(config, current, answers, clock())
            }
            // Graded by BD but timed here (a practice run): add the timing.
            if (backend != null && config.local) {
                val (timedOut, duration) = BdQuizEngine.localTiming(current, clock())
                completion = completion.copy(
                    timedOut = completion.timedOut ?: timedOut,
                    durationSeconds = completion.durationSeconds ?: duration,
                )
            }
            if (run == generation) set(BdQuizEngine.completed(current, completion))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (run == generation) set(BdQuizEngine.failed(current, message(e, failure)))
        }
    }

    private suspend fun lock(fieldId: String, answer: BdJson) {
        val run = generation
        try {
            val result = if (backend != null) {
                val lockAnswer = backend.lockAnswer ?: throw BdFormsException(0, config.words.unscorable)
                lockAnswer(fieldId, answer)
            } else {
                BdQuizEngine.localResult(config, fieldId, answer) ?: throw BdFormsException(0, config.words.unscorable)
            }
            if (run == generation) set(BdQuizEngine.locked(config, current, fieldId, answer, result, clock()))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (run == generation) set(BdQuizEngine.failed(current, message(e, config.words.lockFailed)))
        }
    }

    private companion object {
        /** BD's own words when it sent some (not a transport failure); otherwise the quiz's. */
        fun message(e: Exception, fallback: String): String =
            (e as? BdFormsException)?.takeIf { it.status != 0 }?.message?.takeIf { it.isNotEmpty() } ?: fallback
    }
}
