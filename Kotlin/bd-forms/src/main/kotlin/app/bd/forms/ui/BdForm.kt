package app.bd.forms.ui

import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalOnBackPressedDispatcherOwner
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import app.bd.forms.BdFormController
import app.bd.forms.BdFormField
import app.bd.forms.BdFormState
import app.bd.forms.BdFormsBackend
import app.bd.forms.BdPackageFormsBackend
import app.bd.forms.BdSubmitFailure
import app.bd.forms.BdSubmitOptions
import app.bd.forms.BdSubmitSuccess
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * A BD form, rendered with native Material 3 controls.
 *
 * Give it a form slug and your publishable key; it loads the form, shows each
 * element as the platform control for it, applies BD's conditions,
 * calculations and validation as the visitor answers, uploads files, and
 * submits. Answers survive rotation.
 *
 * ```kotlin
 * BdForm(
 *     form = "contact",
 *     publishableKey = BuildConfig.BD_PK,
 *     onSubmitted = { result -> Log.i("bd", "Submitted ${result.submissionId}") },
 * )
 * ```
 *
 * For your own UI over the same rules, use [BdFormController] directly.
 *
 * @param scrollable the form scrolls itself. Pass false to place it inside a
 *   screen that already scrolls (it then lays out at its full height).
 * @param successContent replaces the thank-you screen shown after a submit.
 */
@Composable
public fun BdForm(
    form: String,
    publishableKey: String,
    modifier: Modifier = Modifier,
    host: String = BD_DEFAULT_HOST,
    submitOptions: BdSubmitOptions = BdSubmitOptions(),
    style: BdFormStyle = BdFormStyle(),
    strings: BdFormStrings = BdFormStrings(),
    renderers: BdFieldRenderers = BdFieldRenderers(),
    scrollable: Boolean = true,
    onSubmitted: ((BdSubmitSuccess) -> Unit)? = null,
    successContent: (@Composable (BdSubmitSuccess) -> Unit)? = null,
) {
    val controller = rememberBdFormController(form, publishableKey, host, submitOptions)
    BdForm(
        controller = controller,
        modifier = modifier,
        style = style,
        strings = strings,
        renderers = renderers,
        scrollable = scrollable,
        iconBaseUrl = host,
        onSubmitted = onSubmitted,
        successContent = successContent,
    )
}

/** Load [form] from your own [BdFormsBackend] and render it. */
@Composable
public fun BdForm(
    form: String,
    backend: BdFormsBackend,
    modifier: Modifier = Modifier,
    submitOptions: BdSubmitOptions = BdSubmitOptions(),
    style: BdFormStyle = BdFormStyle(),
    strings: BdFormStrings = BdFormStrings(),
    renderers: BdFieldRenderers = BdFieldRenderers(),
    scrollable: Boolean = true,
    iconBaseUrl: String = BD_DEFAULT_HOST,
    onSubmitted: ((BdSubmitSuccess) -> Unit)? = null,
    successContent: (@Composable (BdSubmitSuccess) -> Unit)? = null,
) {
    val controller = rememberBdFormController(form, backend, submitOptions)
    BdForm(controller, modifier, style, strings, renderers, scrollable, iconBaseUrl, onSubmitted, successContent)
}

/**
 * Render a controller you own: to prefill, read values, set a payment
 * handler, or drive navigation from outside.
 */
@Composable
public fun BdForm(
    controller: BdFormController,
    modifier: Modifier = Modifier,
    style: BdFormStyle = BdFormStyle(),
    strings: BdFormStrings = BdFormStrings(),
    renderers: BdFieldRenderers = BdFieldRenderers(),
    scrollable: Boolean = true,
    iconBaseUrl: String = BD_DEFAULT_HOST,
    onSubmitted: ((BdSubmitSuccess) -> Unit)? = null,
    successContent: (@Composable (BdSubmitSuccess) -> Unit)? = null,
) {
    val state by controller.state.collectAsState()
    val latestOnSubmitted by rememberUpdatedState(onSubmitted)
    val scope = rememberCoroutineScope()

    SideEffect { controller.messages = strings.messages }
    // Chain rather than replace: an app may have set its own onSuccess.
    DisposableEffect(controller) {
        val previous = controller.onSuccess
        controller.onSuccess = { ok ->
            previous?.invoke(ok)
            latestOnSubmitted?.invoke(ok)
        }
        onDispose { controller.onSuccess = previous }
    }
    LaunchedEffect(controller) { controller.load() }

    MaterialTheme(colorScheme = tinted(style.tint), typography = MaterialTheme.typography, shapes = MaterialTheme.shapes) {
        CompositionLocalProvider(
            LocalBdController provides controller,
            LocalBdFormState provides state,
            LocalBdFormStyle provides style,
            LocalBdFormStrings provides strings,
            LocalBdFieldRenderers provides renderers,
            LocalBdIconBaseUrl provides iconBaseUrl.trimEnd('/'),
        ) {
            Box(modifier) {
                when (val phase = state.phase) {
                    BdFormState.Phase.Idle, BdFormState.Phase.Loading -> BdLoadingView(scrollable)
                    is BdFormState.Phase.Failed -> BdFailedView(phase.message, scrollable) { scope.launch { controller.load() } }
                    BdFormState.Phase.Ready -> {
                        val result = state.result
                        if (result is BdSubmitSuccess) {
                            if (successContent != null) successContent(result) else BdSuccessView(scrollable)
                        } else {
                            BdFormBody(scrollable)
                        }
                    }
                }
            }
        }
    }
}

/**
 * A controller for [form] loaded with a publishable key, kept in the nearest
 * ViewModel store so answers survive rotation.
 */
@Composable
public fun rememberBdFormController(
    form: String,
    publishableKey: String,
    host: String = BD_DEFAULT_HOST,
    submitOptions: BdSubmitOptions = BdSubmitOptions(),
): BdFormController = rememberHeldController("$form|$host|$publishableKey") { scope ->
    BdFormController(form, BdPackageFormsBackend(publishableKey, host), submitOptions, scope)
}

/** A controller for [form] on your own backend, kept in the nearest ViewModel store. */
@Composable
public fun rememberBdFormController(
    form: String,
    backend: BdFormsBackend,
    submitOptions: BdSubmitOptions = BdSubmitOptions(),
): BdFormController = rememberHeldController("$form|backend") { scope ->
    BdFormController(form, backend, submitOptions, scope)
}

internal class BdFormHolder(make: (CoroutineScope) -> BdFormController) : ViewModel() {
    val controller: BdFormController = make(viewModelScope)
}

@Composable
private fun rememberHeldController(key: String, make: (CoroutineScope) -> BdFormController): BdFormController {
    val owner = LocalViewModelStoreOwner.current
    if (owner == null) {
        // Outside any ViewModel store (a preview, a bare ComposeView): the
        // composition owns it, and it lasts as long as the composition.
        val scope = rememberCoroutineScope()
        return remember(key) { make(scope) }
    }
    return viewModel(viewModelStoreOwner = owner, key = "bd-form|$key") { BdFormHolder(make) }.controller
}

@Composable
private fun tinted(tint: Color): ColorScheme {
    val scheme = MaterialTheme.colorScheme
    if (!tint.isSpecified) return scheme
    return remember(scheme, tint) {
        scheme.copy(primary = tint, onPrimary = if (tint.luminance() > 0.5f) Color.Black else Color.White, surfaceTint = tint)
    }
}

// Phases

@Composable
private fun BdCentered(scrollable: Boolean, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().then(if (scrollable) Modifier.fillMaxSize() else Modifier).padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
    ) { content() }
}

@Composable
private fun BdLoadingView(scrollable: Boolean) {
    BdCentered(scrollable) {
        CircularProgressIndicator()
        Text(LocalBdFormStrings.current.loading, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun BdFailedView(message: String, scrollable: Boolean, retry: () -> Unit) {
    val strings = LocalBdFormStrings.current
    BdCentered(scrollable) {
        Icon(Icons.Filled.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(40.dp))
        Text(strings.loadFailed, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        OutlinedButton(onClick = retry) { Text(strings.retry) }
    }
}

/** The thank-you screen. */
@Composable
private fun BdSuccessView(scrollable: Boolean) {
    val controller = bdController()
    val strings = LocalBdFormStrings.current
    BdCentered(scrollable) {
        Box(
            Modifier.size(72.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(44.dp))
        }
        Text(
            strings.successTitle,
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        Text(strings.successMessage, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        OutlinedButton(onClick = { controller.reset() }) { Text(strings.submitAnother) }
    }
}

// Body

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BdFormBody(scrollable: Boolean) {
    val controller = bdController()
    val state = LocalBdFormState.current
    val style = LocalBdFormStyle.current
    val targets = remember { mutableMapOf<String, BringIntoViewRequester>() }
    val top = remember { BringIntoViewRequester() }
    val scroll = rememberScrollState()

    // An attempt that surfaced errors: bring the first one into view.
    LaunchedEffect(state.errorScrollToken) {
        if (state.errorScrollToken == 0) return@LaunchedEffect
        firstErrorKey(controller)?.let { targets[it]?.bringIntoView() }
    }
    // A new step starts at its top.
    val step = controller.currentStep
    var shownStep by remember { mutableIntStateOf(step) }
    LaunchedEffect(step) {
        if (step == shownStep) return@LaunchedEffect
        shownStep = step
        if (scrollable) scroll.animateScrollTo(0) else top.bringIntoView(Rect(0f, 0f, 1f, 1f))
    }

    BdExitConfirm()

    CompositionLocalProvider(LocalBdScrollTargets provides targets, LocalBdTreeSpacing provides style.spacing) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .then(if (scrollable) Modifier.fillMaxSize().imePadding().verticalScroll(scroll) else Modifier)
                .bringIntoViewRequester(top)
                .padding(style.contentPadding),
            verticalArrangement = Arrangement.spacedBy(style.spacing),
        ) {
            BdHeader()
            BdSteps()
            BdFooter()
        }
    }
}

/** The first field with an error, in the order the visitor sees them. */
private fun firstErrorKey(controller: BdFormController): String? {
    val order = mutableListOf<String>()
    fun walk(nodes: List<BdFormField>, prefix: String) {
        for (n in nodes) {
            order += prefix + n.id
            if (n.type == "multi_populator") {
                val count = controller.value(n.id)?.arrayValue?.size ?: 1
                for (i in 0 until maxOf(count, 1)) walk(n.children.orEmpty(), "$prefix${n.id}[$i].")
            } else {
                walk(n.children.orEmpty(), prefix)
            }
        }
    }
    walk(controller.visibleFields, "")
    val errors = controller.errors
    return order.firstOrNull { errors[it] != null }
}

@Composable
private fun BdHeader() {
    val controller = bdController()
    val style = LocalBdFormStyle.current
    val schema = controller.schema
    val title = if (style.showsTitle) schema?.title.nonEmpty() else null
    val description = if (style.showsDescription) schema?.description.nonEmpty() else null
    val showProgress = style.showsProgress && controller.isConsecutive &&
        controller.settings.showProgress != false && controller.stepCount > 1
    if (title == null && description == null && !showProgress) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (title != null) {
            Text(title, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
        }
        if (description != null) {
            Text(description, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (showProgress) BdProgress()
    }
}

@Composable
private fun BdProgress() {
    val controller = bdController()
    val strings = LocalBdFormStrings.current
    val current = controller.currentStep
    val count = controller.stepCount
    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.semantics(mergeDescendants = true) {}) {
        if (controller.settings.progressStyle == "steps") {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (i in 0 until count) {
                    Box(
                        Modifier.weight(1f).height(4.dp).clip(CircleShape).background(
                            if (i <= current) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                        ),
                    )
                }
            }
        } else {
            LinearProgressIndicator(progress = { controller.progress.toFloat() }, modifier = Modifier.fillMaxWidth())
        }
        Text(
            strings.format(strings.stepOf, current + 1, count) + " · " + controller.stepTitle(current),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun BdSteps() {
    val controller = bdController()
    val style = LocalBdFormStyle.current
    if (!style.animated || !controller.isConsecutive) {
        BdStepFields(controller.visibleFields)
        return
    }
    AnimatedContent(
        targetState = controller.currentStep,
        transitionSpec = {
            val forward = targetState > initialState
            (slideInHorizontally { w -> if (forward) w / 5 else -w / 5 } + fadeIn()) togetherWith
                (slideOutHorizontally { w -> if (forward) -w / 5 else w / 5 } + fadeOut()) using
                SizeTransform(clip = false)
        },
        label = "bd-step",
    ) { step ->
        BdStepFields(controller.steps.getOrNull(step).orEmpty())
    }
}

@Composable
private fun BdStepFields(nodes: List<BdFormField>) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(LocalBdFormStyle.current.spacing)) {
        BdFieldTree(nodes, emptyList())
    }
}

@Composable
private fun BdFooter() {
    val controller = bdController()
    val state = LocalBdFormState.current
    val style = LocalBdFormStyle.current
    val strings = LocalBdFormStrings.current
    val failure = (state.result as? BdSubmitFailure)?.takeIf { !state.isSubmitting }?.let { f ->
        when (f.reason) {
            BdSubmitFailure.Reason.ClientValidationFailed, BdSubmitFailure.Reason.ValidationFailed ->
                if (state.errors.isEmpty()) f.message else strings.errorNotice
            else -> f.message
        }
    }
    val coupon = controller.schema?.actions
        ?.firstOrNull { !it.coupon?.code.isNullOrEmpty() }?.coupon
        ?.takeIf { controller.isLastStep }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (failure != null) {
            val err = style.resolvedError()
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Warning, contentDescription = null, tint = err, modifier = Modifier.size(18.dp))
                Text(failure, color = err, style = MaterialTheme.typography.bodyMedium)
            }
        }
        if (coupon != null) {
            val code = coupon.code.orEmpty()
            val text = coupon.notice?.replace("{code}", code) ?: strings.format(strings.couponApplied, code)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BdGlyphIcon(BdGlyphs.tag, tint = MaterialTheme.colorScheme.primary, size = 18.dp)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(text, style = MaterialTheme.typography.bodyMedium)
                    coupon.finePrint.nonEmpty()?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        BdNavigationButtons()
    }
}

@Composable
private fun BdNavigationButtons() {
    val controller = bdController()
    val state = LocalBdFormState.current
    val style = LocalBdFormStyle.current
    val strings = LocalBdFormStrings.current
    val scope = rememberCoroutineScope()
    val submitting = state.isSubmitting
    val isSubmit = !controller.isConsecutive || controller.isLastStep

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        if (controller.isConsecutive && !controller.isFirstStep) {
            OutlinedButton(onClick = { controller.back() }, enabled = !submitting, modifier = Modifier.heightIn(min = 48.dp)) {
                Text(strings.back)
            }
        }
        val onClick: () -> Unit = {
            if (!submitting) {
                if (isSubmit) scope.launch { controller.submit() } else controller.next()
            }
        }
        val label: @Composable RowScope.() -> Unit = {
            if (submitting) {
                CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = LocalContentColor.current)
                Spacer(Modifier.width(8.dp))
            }
            Text(if (isSubmit) (if (submitting) strings.sending else strings.submit) else strings.next)
        }
        val m = Modifier.weight(1f).heightIn(min = 48.dp)
        when (style.submitButton) {
            BdFormStyle.ButtonProminence.Filled -> Button(onClick = onClick, modifier = m, content = label)
            BdFormStyle.ButtonProminence.Tonal -> FilledTonalButton(onClick = onClick, modifier = m, content = label)
            BdFormStyle.ButtonProminence.Outlined -> OutlinedButton(onClick = onClick, modifier = m, content = label)
        }
    }
}

/**
 * Back asks before discarding answers, when the form turns that on and the
 * visitor has typed something.
 */
@Composable
private fun BdExitConfirm() {
    val controller = bdController()
    val strings = LocalBdFormStrings.current
    val confirm = controller.settings.exitConfirm
    val guard = confirm?.enabled == true && controller.isDirty && !controller.isSubmitted
    var asking by remember { mutableStateOf(false) }
    var leaving by remember { mutableStateOf(false) }
    val dispatcher = LocalOnBackPressedDispatcherOwner.current?.onBackPressedDispatcher

    BackHandler(enabled = guard && !leaving) { asking = true }
    // Runs after the handler above has been disabled, so this back goes past it.
    LaunchedEffect(leaving) {
        if (leaving) {
            dispatcher?.onBackPressed()
            leaving = false
        }
    }
    if (asking) {
        AlertDialog(
            onDismissRequest = { asking = false },
            title = { Text(strings.exitTitle) },
            text = { Text(confirm?.message.nonEmpty() ?: strings.exitMessage) },
            confirmButton = {
                TextButton(onClick = {
                    asking = false
                    leaving = true
                }) { Text(strings.exitLeave) }
            },
            dismissButton = { TextButton(onClick = { asking = false }) { Text(strings.exitStay) } },
        )
    }
}
