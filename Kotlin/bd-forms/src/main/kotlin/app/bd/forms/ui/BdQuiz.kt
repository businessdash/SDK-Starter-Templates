package app.bd.forms.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import app.bd.forms.BdFormsException
import app.bd.forms.BdJS
import app.bd.forms.BdJson
import app.bd.forms.BdQuizAction
import app.bd.forms.BdQuizActionId
import app.bd.forms.BdQuizChoice
import app.bd.forms.BdQuizChoiceState
import app.bd.forms.BdQuizCompletion
import app.bd.forms.BdQuizController
import app.bd.forms.BdQuizDone
import app.bd.forms.BdQuizFeedback
import app.bd.forms.BdQuizPage
import app.bd.forms.BdQuizPhase
import app.bd.forms.BdQuizQuestion
import app.bd.forms.BdQuizScreen
import app.bd.forms.BdQuizTimer
import app.bd.forms.BdQuizTone
import app.bd.forms.BdQuizWords
import app.bd.forms.BdQuizzes
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Which BD quiz a [BdQuiz] takes. */
public sealed interface BdQuizSource {
    /** An invited quiz: the token from the invite link (`/quiz-invite/{token}`). Graded and recorded by BD. */
    public data class Invitation(public val token: String) : BdQuizSource

    /**
     * A practice quiz the org lets apps run: graded by BD, never recorded, and
     * can be retaken. [seed] pins one order; null shuffles anew each run.
     * [questionLimit] asks only that many questions.
     */
    public data class Practice(
        public val slug: String,
        public val seed: String? = null,
        public val questionLimit: Int? = null,
    ) : BdQuizSource
}

/**
 * A BD quiz, drawn with native Material 3 controls: the page header (name,
 * time, attempts), the sign-in gate when the invitation needs the invited
 * account, then the quiz itself: lettered choices, typed answers, "I don't
 * know", a countdown that submits on its own, each answer's verdict and why
 * (immediate feedback) or the results at the end.
 *
 * ```kotlin
 * val quizzes = BdQuizzes.packageApi(BuildConfig.BD_PK, sessionToken = session?.sessionToken)
 * BdQuiz(BdQuizSource.Invitation(token), quizzes, onSignIn = { showSignIn = true })
 * ```
 *
 * It survives rotation, and a submit in flight finishes even if the screen
 * goes away. Signing in gives a new [quizzes] (`withSession`), which reloads
 * the invitation as the signed-in customer.
 *
 * @param onSignIn shows your sign-in screen. Without it the sign-in prompts
 *   have no button.
 * @param onSwitchAccount signs the customer out so the invited one can sign
 *   in (the invitation is for someone else's account).
 */
@Composable
public fun BdQuiz(
    source: BdQuizSource,
    quizzes: BdQuizzes,
    modifier: Modifier = Modifier,
    words: BdQuizWords = BdQuizWords(),
    style: BdFormStyle = BdFormStyle(),
    showsHeader: Boolean = true,
    scrollable: Boolean = true,
    onSignIn: (() -> Unit)? = null,
    onSwitchAccount: (() -> Unit)? = null,
    onDone: ((BdQuizCompletion) -> Unit)? = null,
) {
    val signInLinked = onSignIn != null
    val key = "$source|${quizzes.baseUrl}|${quizzes.sessionToken}|$signInLinked|${words.hashCode()}"
    val loader = rememberHeldLoader(key) { scope -> BdQuizLoader(scope) { loadQuiz(source, quizzes, words, signInLinked, it) } }
    val load by loader.state.collectAsState()

    BdQuizTheme(style) {
        when (val l = load) {
            BdQuizLoad.Loading -> BdQuizCentered(modifier, scrollable) {
                CircularProgressIndicator()
                Text(words.loading, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            is BdQuizLoad.Failed -> BdQuizCentered(modifier, scrollable) {
                Icon(Icons.Filled.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(40.dp))
                Text(words.loadFailed, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
                l.message?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center) }
                OutlinedButton(onClick = loader::reload) { Text(words.tryAgain) }
            }
            is BdQuizLoad.Ready -> BdQuizPageView(
                page = if (showsHeader) l.page else l.page.copy(header = null),
                controller = l.controller,
                modifier = modifier,
                style = style,
                scrollable = scrollable,
                onSignIn = onSignIn,
                onSwitchAccount = onSwitchAccount,
                onDone = onDone,
            )
        }
    }
}

/**
 * Draw a quiz you run yourself: a local quiz whose fields carry answer keys,
 * or one with your own [app.bd.forms.BdQuizBackend]. [page] adds a header
 * (or a gate) above it.
 *
 * ```kotlin
 * val scope = rememberCoroutineScope()
 * val quiz = remember { BdQuizController(BdQuizOptions(fields, feedbackMode = BdQuizFeedbackMode.IMMEDIATE), scope) }
 * BdQuiz(quiz)
 * ```
 */
@Composable
public fun BdQuiz(
    controller: BdQuizController,
    modifier: Modifier = Modifier,
    page: BdQuizPage = BdQuizPage(),
    style: BdFormStyle = BdFormStyle(),
    scrollable: Boolean = true,
    onSignIn: (() -> Unit)? = null,
    onDone: ((BdQuizCompletion) -> Unit)? = null,
) {
    BdQuizTheme(style) {
        BdQuizPageView(page, controller, modifier, style, scrollable, onSignIn, onSwitchAccount = null, onDone = onDone)
    }
}

// ── Loading ─────────────────────────────────────────────────────────────────

/** The sign-in action's href when the host handles sign-in (it never leaves the app). */
private const val SIGN_IN_HREF = "bd-quiz:sign-in"

internal sealed interface BdQuizLoad {
    data object Loading : BdQuizLoad

    data class Failed(val message: String?) : BdQuizLoad

    /** [controller] is null when a gate stands in for the quiz. */
    data class Ready(val page: BdQuizPage, val controller: BdQuizController?) : BdQuizLoad
}

private suspend fun loadQuiz(
    source: BdQuizSource,
    quizzes: BdQuizzes,
    words: BdQuizWords,
    signInLinked: Boolean,
    scope: CoroutineScope,
): BdQuizLoad.Ready = when (source) {
    is BdQuizSource.Invitation -> {
        val invitation = try {
            quizzes.invitation(source.token)
        } catch (e: BdFormsException) {
            if (e.status != 404) throw e
            null
        }
        val page = BdQuizPage.invitation(invitation, words)
        if (invitation == null || page.gate != null) {
            BdQuizLoad.Ready(page, null)
        } else {
            val options = invitation.options(signInHref = if (signInLinked) SIGN_IN_HREF else null, words = words)
            BdQuizLoad.Ready(page, BdQuizController(options, scope, quizzes.invitationBackend(source.token), invitation.initial()))
        }
    }
    is BdQuizSource.Practice -> {
        val practice = quizzes.practice(source.slug)
        val options = practice.options(seed = source.seed, questionLimit = source.questionLimit, words = words)
        BdQuizLoad.Ready(BdQuizPage.practice(practice, words), BdQuizController(options, scope, quizzes.practiceBackend(source.slug)))
    }
}

internal class BdQuizLoader(
    private val scope: CoroutineScope,
    private val load: suspend (CoroutineScope) -> BdQuizLoad.Ready,
) {
    private val _state = MutableStateFlow<BdQuizLoad>(BdQuizLoad.Loading)
    val state: StateFlow<BdQuizLoad> = _state.asStateFlow()
    private var job: Job? = null

    init {
        reload()
    }

    fun reload() {
        job?.cancel()
        (_state.value as? BdQuizLoad.Ready)?.controller?.stop()
        _state.value = BdQuizLoad.Loading
        job = scope.launch {
            _state.value = try {
                load(scope)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                BdQuizLoad.Failed(e.message?.takeIf { it.isNotEmpty() })
            }
        }
    }
}

internal class BdQuizHolder(make: (CoroutineScope) -> BdQuizLoader) : ViewModel() {
    val loader: BdQuizLoader = make(viewModelScope)
}

@Composable
private fun rememberHeldLoader(key: String, make: (CoroutineScope) -> BdQuizLoader): BdQuizLoader {
    val owner = LocalViewModelStoreOwner.current
    if (owner == null) {
        val scope = rememberCoroutineScope()
        return remember(key) { make(scope) }
    }
    return viewModel(viewModelStoreOwner = owner, key = "bd-quiz|$key") { BdQuizHolder(make) }.loader
}

// ── The page ────────────────────────────────────────────────────────────────

@Composable
private fun BdQuizTheme(style: BdFormStyle, content: @Composable () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    val tint = style.tint
    val colors = if (!tint.isSpecified) scheme else remember(scheme, tint) {
        scheme.copy(primary = tint, onPrimary = if (tint.luminance() > 0.5f) Color.Black else Color.White, surfaceTint = tint)
    }
    MaterialTheme(colorScheme = colors, typography = MaterialTheme.typography, shapes = MaterialTheme.shapes, content = content)
}

@Composable
private fun BdQuizCentered(modifier: Modifier, scrollable: Boolean, content: @Composable () -> Unit) {
    Column(
        modifier = modifier.fillMaxWidth().then(if (scrollable) Modifier.fillMaxSize() else Modifier).padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
    ) { content() }
}

@Composable
private fun BdQuizPageView(
    page: BdQuizPage,
    controller: BdQuizController?,
    modifier: Modifier,
    style: BdFormStyle,
    scrollable: Boolean,
    onSignIn: (() -> Unit)?,
    onSwitchAccount: (() -> Unit)?,
    onDone: ((BdQuizCompletion) -> Unit)?,
) {
    val scroll = rememberScrollState()
    val latestOnDone by rememberUpdatedState(onDone)
    if (controller != null) {
        DisposableEffect(controller) {
            controller.onDone = { latestOnDone?.invoke(it) }
            onDispose { controller.onDone = null }
        }
    }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .then(if (scrollable) Modifier.fillMaxSize().verticalScroll(scroll).imePadding() else Modifier)
            .padding(style.contentPadding),
        verticalArrangement = Arrangement.spacedBy(style.spacing),
    ) {
        page.header?.let { BdQuizHeader(it) }
        val gate = page.gate
        when {
            gate != null -> BdQuizGate(gate, style, onSignIn, onSwitchAccount)
            controller != null -> BdQuizBody(controller, style, if (scrollable) scroll else null, onSignIn)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BdQuizHeader(header: BdQuizPage.Header) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            header.eyebrow.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold,
        )
        Text(header.title, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
        header.description?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        if (header.facts.isNotEmpty()) {
            FlowRow(
                modifier = Modifier.padding(top = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                header.facts.forEach { fact ->
                    Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant) {
                        Text(fact, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun BdQuizGate(gate: BdQuizPage.Gate, style: BdFormStyle, onSignIn: (() -> Unit)?, onSwitchAccount: (() -> Unit)?) {
    val account = gate.kind == BdQuizPage.GateKind.SIGN_IN || gate.kind == BdQuizPage.GateKind.SWITCH_ACCOUNT
    val run = when (gate.action?.id) {
        BdQuizPage.GateKind.SIGN_IN -> onSignIn
        BdQuizPage.GateKind.SWITCH_ACCOUNT -> onSwitchAccount
        else -> null
    }
    Surface(
        shape = RoundedCornerShape(style.cornerRadius),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(
                if (account) Icons.Filled.Lock else Icons.Filled.Info,
                contentDescription = null,
                tint = if (account) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            gate.title?.let { Text(it, style = MaterialTheme.typography.titleMedium) }
            Text(gate.body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val action = gate.action
            if (action != null && run != null) Button(onClick = run) { Text(action.label) }
        }
    }
}

// ── The quiz ────────────────────────────────────────────────────────────────

@Composable
private fun BdQuizBody(controller: BdQuizController, style: BdFormStyle, scroll: ScrollState?, onSignIn: (() -> Unit)?) {
    val screen by controller.screen.collectAsState()
    val state by controller.state.collectAsState()
    val primary = screen.actions.firstOrNull { it.primary && it.enabled }?.id

    // A new question, or the results: back to the top. Not keyed on the
    // progress line: on the all-questions page it changes with every answer.
    val place = if (screen.phase == BdQuizPhase.ALL) -1 else state.index
    LaunchedEffect(place, screen.phase == BdQuizPhase.DONE) { scroll?.animateScrollTo(0) }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        when (screen.phase) {
            BdQuizPhase.EMPTY -> Text(screen.empty.orEmpty(), color = MaterialTheme.colorScheme.onSurfaceVariant)
            BdQuizPhase.READY -> screen.ready?.let { BdQuizReady(it) }
            BdQuizPhase.DONE -> screen.done?.let { BdQuizDoneView(it, style) }
            BdQuizPhase.QUESTION, BdQuizPhase.ALL, BdQuizPhase.FEEDBACK -> {
                screen.timer?.let { BdQuizTimerView(it, style) }
                screen.progress?.let { BdQuizProgress(it) }
                screen.notice?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                screen.questions.forEach { question ->
                    BdQuizQuestionView(question, controller, style, numbered = screen.phase == BdQuizPhase.ALL, primary = primary)
                }
                screen.feedback?.let { BdQuizFeedbackView(it, style) }
            }
        }
        screen.error?.let { message ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Warning, contentDescription = null, tint = style.resolvedError(), modifier = Modifier.size(18.dp))
                Text(message, color = style.resolvedError(), style = MaterialTheme.typography.bodyMedium)
            }
        }
        if (screen.actions.isNotEmpty()) BdQuizActions(screen, controller, onSignIn)
    }
}

/** An hourglass and a clock, drawn here: the core icon set has neither. */
private object BdQuizGlyphs {
    private fun glyph(name: String, path: String) = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        .addPath(addPathNodes(path), fill = SolidColor(Color.Black))
        .build()

    val hourglass: ImageVector by lazy {
        glyph(
            "hourglass",
            "M6,2v6h0.01L6,8.01 10,12l-4,4 0.01,0.01H6V22h12v-5.99h-0.01L18,16l-4,-4 4,-3.99 -0.01,-0.01H18V2H6z" +
                "M16,16.5V20H8v-3.5l4,-4 4,4zM12,11.5l-4,-4V4h8v3.5l-4,4z",
        )
    }
    val clock: ImageVector by lazy {
        glyph(
            "clock",
            "M11.99,2C6.47,2 2,6.48 2,12s4.47,10 9.99,10C17.52,22 22,17.52 22,12S17.52,2 11.99,2z" +
                "M12,20c-4.42,0 -8,-3.58 -8,-8s3.58,-8 8,-8 8,3.58 8,8 -3.58,8 -8,8zM12.5,7H11v6l5.25,3.15 0.75,-1.23 -4.5,-2.67z",
        )
    }
}

@Composable
private fun BdQuizReady(ready: BdQuizScreen.Ready) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier.size(64.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                if (ready.icon == "hourglass") BdQuizGlyphs.hourglass else BdQuizGlyphs.clock,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.size(32.dp),
            )
        }
        Text(ready.title, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Text(ready.body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}

@Composable
private fun BdQuizTimerView(timer: BdQuizTimer, style: BdFormStyle) {
    val warn = timer.warning
    Surface(
        shape = RoundedCornerShape(style.cornerRadius),
        color = if (warn) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
        contentColor = if (warn) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSurface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (timer.countdown) BdQuizGlyphs.hourglass else BdQuizGlyphs.clock,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Text(timer.label, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(start = 8.dp).weight(1f))
                if (timer.paused) {
                    Text(
                        timer.pausedLabel,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(end = 8.dp),
                    )
                }
                Text(
                    timer.value,
                    style = MaterialTheme.typography.titleMedium.copy(fontFeatureSettings = "tnum"),
                    fontWeight = FontWeight.SemiBold,
                )
            }
            timer.progress?.let { percent ->
                LinearProgressIndicator(
                    progress = { (percent / 100).toFloat() },
                    color = if (warn) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun BdQuizProgress(progress: BdQuizScreen.Progress) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(progress.position, style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
            progress.note?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        LinearProgressIndicator(progress = { (progress.percent / 100).toFloat() }, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun BdQuizQuestionView(
    question: BdQuizQuestion,
    controller: BdQuizController,
    style: BdFormStyle,
    numbered: Boolean,
    primary: BdQuizActionId?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            if (numbered) "${question.number}. ${question.label}" else question.label,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )
        val choices = question.choices
        if (choices != null) {
            choices.forEach { choice ->
                BdQuizChoiceRow(choice.letter, choice.label, choice.selected, choice.state, question.multiple, question.locked, style) {
                    controller.choose(question.field.id, choice.label)
                }
            }
        } else {
            BdQuizAnswerInput(question, controller, primary)
        }
        question.dontKnow?.let { dontKnow ->
            BdQuizChoiceRow("?", dontKnow.label, dontKnow.selected, dontKnow.state, multiple = false, locked = question.locked, style = style) {
                controller.chooseDontKnow(question.field.id)
            }
        }
        question.error?.let { Text(it, color = style.resolvedError(), style = MaterialTheme.typography.bodySmall) }
    }
}

private val darkCorrect = Color(0xFF81C995)
private val lightCorrect = Color(0xFF1E8E3E)
private val darkPartial = Color(0xFFFDD663)
private val lightPartial = Color(0xFFB06000)

@Composable
private fun isDark(): Boolean = MaterialTheme.colorScheme.surface.luminance() < 0.5f

@Composable
private fun BdQuizTone.color(): Color = when (this) {
    BdQuizTone.CORRECT -> if (isDark()) darkCorrect else lightCorrect
    BdQuizTone.PARTIAL -> if (isDark()) darkPartial else lightPartial
    BdQuizTone.INCORRECT -> MaterialTheme.colorScheme.error
    BdQuizTone.PENDING -> MaterialTheme.colorScheme.tertiary
    BdQuizTone.UNSCORED, BdQuizTone.UNSURE -> MaterialTheme.colorScheme.onSurfaceVariant
}

@Composable
private fun BdQuizChoiceRow(
    letter: String,
    label: String,
    selected: Boolean,
    state: BdQuizChoiceState,
    multiple: Boolean,
    locked: Boolean,
    style: BdFormStyle,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(style.cornerRadius)
    val accent = when (state) {
        BdQuizChoiceState.CORRECT -> BdQuizTone.CORRECT.color()
        BdQuizChoiceState.INCORRECT -> MaterialTheme.colorScheme.error
        BdQuizChoiceState.SELECTED -> MaterialTheme.colorScheme.primary
        BdQuizChoiceState.IDLE, BdQuizChoiceState.DIMMED -> MaterialTheme.colorScheme.outlineVariant
    }
    val marked = state == BdQuizChoiceState.CORRECT || state == BdQuizChoiceState.INCORRECT || state == BdQuizChoiceState.SELECTED
    val pick = if (multiple) {
        Modifier.toggleable(value = selected, enabled = !locked, role = Role.Checkbox) { onClick() }
    } else {
        Modifier.selectable(selected = selected, enabled = !locked, role = Role.RadioButton, onClick = onClick)
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .border(if (marked) 2.dp else 1.dp, accent, shape)
            .background(if (marked) accent.copy(alpha = 0.08f) else Color.Transparent)
            .then(pick)
            .padding(horizontal = 12.dp, vertical = 12.dp)
            .alpha(if (state == BdQuizChoiceState.DIMMED) 0.6f else 1f),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier.size(28.dp).clip(CircleShape).background(if (marked) accent else MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                letter,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = if (marked) (if (accent.luminance() > 0.5f) Color.Black else Color.White) else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
        when (state) {
            BdQuizChoiceState.CORRECT -> Icon(Icons.Filled.Check, contentDescription = null, tint = accent)
            BdQuizChoiceState.INCORRECT -> Icon(Icons.Filled.Close, contentDescription = null, tint = accent)
            else -> Unit
        }
    }
}

/** A typed answer: open questions, numbers, yes/no, a dropdown. */
@Composable
private fun BdQuizAnswerInput(question: BdQuizQuestion, controller: BdQuizController, primary: BdQuizActionId?) {
    val field = question.field
    val id = field.id
    val enabled = !question.locked
    val submit = KeyboardActions(onDone = { primary?.let(controller::launch) })
    val initial = when (val v = question.value) {
        is BdJson.Str -> v.value
        is BdJson.Num -> BdJS.string(v.value)
        else -> ""
    }
    // Typed text stays here, so the caret never jumps; the controller gets every change.
    var text by remember(id, controller.config) { mutableStateOf(initial) }

    when (field.type) {
        "textarea", "richtext" -> OutlinedTextField(
            value = text,
            onValueChange = {
                text = it
                controller.setAnswer(id, BdJson.Str(it))
            },
            enabled = enabled,
            isError = question.error != null,
            placeholder = field.placeholder?.let { p -> { Text(p) } },
            minLines = 4,
            maxLines = 12,
            modifier = Modifier.fillMaxWidth(),
        )
        "select" -> {
            var open by remember { mutableStateOf(false) }
            Box {
                OutlinedButton(onClick = { open = true }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                    Text(initial.ifEmpty { field.placeholder ?: "—" }, modifier = Modifier.weight(1f), textAlign = TextAlign.Start)
                    Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null)
                }
                DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                    field.options.orEmpty().forEach { option ->
                        DropdownMenuItem(text = { Text(option) }, onClick = {
                            controller.setAnswer(id, BdJson.Str(option))
                            open = false
                        })
                    }
                }
            }
        }
        "boolean" -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            val words = controller.config.words
            listOf(true to words.yes, false to words.no).forEach { (value, label) ->
                val picked = question.value?.boolValue == value
                val pick = { controller.setAnswer(id, BdJson.Bool(value)) }
                if (picked) {
                    FilledTonalButton(onClick = pick, enabled = enabled, modifier = Modifier.weight(1f)) { Text(label) }
                } else {
                    OutlinedButton(onClick = pick, enabled = enabled, modifier = Modifier.weight(1f)) { Text(label) }
                }
            }
        }
        "number", "currency", "slider" -> OutlinedTextField(
            value = text,
            onValueChange = { raw ->
                text = raw
                val trimmed = raw.trim()
                val n = trimmed.toDoubleOrNull()
                controller.setAnswer(
                    id,
                    when {
                        trimmed.isEmpty() -> BdJson.Str("")
                        n != null && n.isFinite() -> BdJson.Num(n)
                        else -> BdJson.Str(raw)
                    },
                )
            },
            enabled = enabled,
            isError = question.error != null,
            singleLine = true,
            placeholder = field.placeholder?.let { p -> { Text(p) } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done),
            keyboardActions = submit,
            modifier = Modifier.fillMaxWidth(),
        )
        else -> OutlinedTextField(
            value = text,
            onValueChange = {
                text = it
                controller.setAnswer(id, BdJson.Str(it))
            },
            enabled = enabled,
            isError = question.error != null,
            singleLine = true,
            placeholder = field.placeholder?.let { p -> { Text(p) } },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = submit,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun BdQuizBadge(badge: BdQuizFeedback.Badge) {
    val color = badge.tone.color()
    Text(
        badge.label,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        color = color,
        modifier = Modifier.clip(CircleShape).background(color.copy(alpha = 0.14f)).padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
private fun BdQuizLabeled(label: String, text: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun BdQuizFeedbackView(feedback: BdQuizFeedback, style: BdFormStyle) {
    val color = feedback.badge.tone.color()
    val shape = RoundedCornerShape(style.cornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .border(1.dp, color.copy(alpha = 0.3f), shape)
            .background(color.copy(alpha = 0.06f))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            BdQuizBadge(feedback.badge)
            feedback.accuracy?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        BdQuizLabeled(feedback.answerLabel, feedback.answer)
        feedback.accepted?.let { BdQuizLabeled(feedback.acceptedLabel, it) }
        feedback.why?.let { BdQuizLabeled(feedback.whyLabel, it) }
        feedback.selected.forEach { BdQuizLabeled(it.option, it.explanation) }
        feedback.others?.let { others ->
            Text(others.label, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 4.dp))
            others.items.forEach { BdQuizLabeled(it.option, it.explanation) }
        }
    }
}

@Composable
private fun BdQuizDoneView(done: BdQuizDone, style: BdFormStyle) {
    when (done) {
        is BdQuizDone.Results -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(done.eyebrow.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                Text(done.score, style = MaterialTheme.typography.displayMedium, fontWeight = FontWeight.Bold)
                done.tally?.let { Text(it, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                Text(
                    done.summary,
                    style = MaterialTheme.typography.titleMedium,
                    color = when (done.passed) {
                        true -> BdQuizTone.CORRECT.color()
                        false -> MaterialTheme.colorScheme.error
                        null -> MaterialTheme.colorScheme.onSurface
                    },
                    textAlign = TextAlign.Center,
                )
                done.message?.let { Text(it, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center) }
                done.timing?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            done.items.forEach { BdQuizResultRow(it, style) }
        }
        is BdQuizDone.Submitted -> BdQuizEndCard(Icons.Filled.CheckCircle, done.eyebrow, done.title, done.body)
        is BdQuizDone.Locked -> BdQuizEndCard(Icons.Filled.Lock, done.eyebrow, done.title, done.body)
    }
}

@Composable
private fun BdQuizResultRow(item: BdQuizDone.Results.Item, style: BdFormStyle) {
    var open by remember(item.number, item.label) { mutableStateOf(false) }
    val color = item.tone.color()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(style.cornerRadius))
                .clickable { open = !open }
                .padding(vertical = 8.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(Modifier.size(10.dp).clip(CircleShape).background(color))
            Text("${item.number}. ${item.label}", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            Text(item.feedback.badge.label, style = MaterialTheme.typography.labelMedium, color = color)
            Icon(if (open) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown, contentDescription = null)
        }
        AnimatedVisibility(open) { BdQuizFeedbackView(item.feedback, style) }
    }
}

@Composable
private fun BdQuizEndCard(icon: ImageVector, eyebrow: String, title: String, body: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier.size(72.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(40.dp))
        }
        Text(eyebrow.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        Text(title, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}

@Composable
private fun BdQuizActions(screen: BdQuizScreen, controller: BdQuizController, onSignIn: (() -> Unit)?) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        screen.actions.forEach { action ->
            val run: () -> Unit = {
                if (action.id == BdQuizActionId.SIGN_IN) onSignIn?.invoke() else controller.launch(action.id)
            }
            if (action.primary) {
                Button(onClick = run, enabled = action.enabled, modifier = Modifier.weight(1f)) { BdQuizActionLabel(action, screen.busy) }
            } else {
                OutlinedButton(onClick = run, enabled = action.enabled) { BdQuizActionLabel(action, busy = false) }
            }
        }
    }
}

@Composable
private fun BdQuizActionLabel(action: BdQuizAction, busy: Boolean) {
    if (busy && !action.enabled) {
        CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(16.dp).padding(end = 0.dp))
        Box(Modifier.size(8.dp))
    }
    Text(action.label)
}
