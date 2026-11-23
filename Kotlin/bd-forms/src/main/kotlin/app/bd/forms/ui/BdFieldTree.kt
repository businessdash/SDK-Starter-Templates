package app.bd.forms.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.bd.forms.BdFieldPath
import app.bd.forms.BdFieldType
import app.bd.forms.BdFormField

/** Space between the nodes a tree lays out in the current container. */
internal val LocalBdTreeSpacing = staticCompositionLocalOf<Dp> { 24.dp }

/**
 * Walks a list of elements: containers apply their conditions and lay out
 * their children; everything else becomes a [BdFieldRow]. Emits into the
 * caller's column, so a hidden branch leaves no gap.
 */
@Composable
internal fun BdFieldTree(nodes: List<BdFormField>, entries: List<BdFieldPath.Entry>) {
    for (node in nodes) {
        key(node.id) { BdNodeView(node, entries) }
    }
}

@Composable
private fun BdNodeView(node: BdFormField, entries: List<BdFieldPath.Entry>) {
    val controller = bdController()
    when (node.type) {
        "condition_block", "flex_row" -> BdReveal(controller.isVisible(node, entries)) {
            BdFieldTree(node.children.orEmpty(), entries)
        }
        "input_group" -> BdReveal(controller.isVisible(node, entries)) {
            val children = node.children.orEmpty().take(controller.revealCount(node, entries))
            if (node.showGroupLabel == true && node.label.isNotEmpty()) {
                Text(node.label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
            }
            BdFieldTree(children, entries)
        }
        "or_condition" -> BdReveal(controller.isVisible(node, entries)) { BdEitherOr(node, entries) }
        "multi_populator" -> BdRepeater(node, entries)
        "reference_value" -> Unit
        else -> {
            if (node.type == "calculation" && node.calculationConfig?.display?.show == false) return
            BdFieldRow(node, BdFieldPath(node.id, entries))
        }
    }
}

/** A conditional branch: grows in when it starts to apply, folds away when it stops. */
@Composable
private fun BdReveal(visible: Boolean, content: @Composable ColumnScope.() -> Unit) {
    val spacing = LocalBdTreeSpacing.current
    if (!LocalBdFormStyle.current.animated) {
        if (visible) Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(spacing), content = content)
        return
    }
    AnimatedVisibility(
        visible = visible,
        enter = expandVertically(expandFrom = Alignment.Top) + fadeIn(),
        exit = shrinkVertically(shrinkTowards = Alignment.Top) + fadeOut(),
    ) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(spacing), content = content)
    }
}

/** Registers a row so a failed attempt can scroll to it. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun rememberScrollTarget(key: String): BringIntoViewRequester {
    val targets = LocalBdScrollTargets.current
    val requester = remember { BringIntoViewRequester() }
    DisposableEffect(key, targets) {
        targets[key] = requester
        onDispose { if (targets[key] === requester) targets.remove(key) }
    }
    return requester
}

/** Label, control, error and help for one field. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun BdFieldRow(field: BdFormField, path: BdFieldPath) {
    val controller = bdController()
    val style = LocalBdFormStyle.current
    val renderers = LocalBdFieldRenderers.current
    val inCard = LocalBdInCard.current
    val ctx = BdFieldContext(field, path, controller)
    val requester = rememberScrollTarget(path.key)
    val isStatic = field.type in BdFieldType.noLabel || field.type == "image"
    val grouped = style.layout == BdFormStyle.Layout.Grouped && !inCard

    // In the grouped layout the cards already separate questions.
    if (grouped && field.type == "separator") return

    val control: @Composable () -> Unit = {
        val custom = renderers.renderer(field)
        if (custom != null) custom(ctx) else BdFieldControl(ctx)
    }
    val surface = grouped && !(isStatic && field.type in setOf("title", "subtitle"))
    BdRowSurface(surface, Modifier.bringIntoViewRequester(requester)) {
        if (isStatic) {
            control()
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                BdFieldLabel(field)
                control()
                BdFootnotes(error = ctx.error, help = field.helpText)
            }
        }
    }
}

@Composable
private fun BdRowSurface(surface: Boolean, modifier: Modifier, content: @Composable () -> Unit) {
    if (surface) {
        Surface(
            modifier = modifier.fillMaxWidth(),
            shape = RoundedCornerShape(LocalBdFormStyle.current.cornerRadius),
            color = MaterialTheme.colorScheme.surfaceContainerLow,
        ) {
            Box(Modifier.padding(16.dp)) { content() }
        }
    } else {
        Box(modifier.fillMaxWidth()) { content() }
    }
}

@Composable
internal fun BdFieldLabel(field: BdFormField) {
    if (field.label.isEmpty()) return
    val required = (field.required || field.mustBeTrue == true) && field.type !in BdFieldType.staticOrLayout
    BdRequiredLabel(field.label, required)
}

@Composable
internal fun BdRequiredLabel(text: String, required: Boolean) {
    val style = LocalBdFormStyle.current
    val err = style.resolvedError()
    Text(
        buildAnnotatedString {
            append(text)
            if (required && style.requiredMarker.isNotEmpty()) withStyle(SpanStyle(color = err)) { append(style.requiredMarker) }
        },
        style = MaterialTheme.typography.titleSmall,
        modifier = Modifier.semantics { contentDescription = text + if (required) ", required" else "" },
    )
}

@Composable
internal fun BdFootnotes(error: String?, help: String?) {
    if (error == null && help.isNullOrEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (error != null) BdErrorText(error)
        if (!help.isNullOrEmpty()) {
            Text(help, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
internal fun BdErrorText(error: String) {
    Text(
        error,
        style = MaterialTheme.typography.bodySmall,
        color = LocalBdFormStyle.current.resolvedError(),
        // TalkBack reads a new problem out as it appears.
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
    )
}

@Composable
private fun BdInnerSurface(error: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val style = LocalBdFormStyle.current
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(style.cornerRadius),
        color = if (LocalBdInCard.current) MaterialTheme.colorScheme.surfaceContainer else MaterialTheme.colorScheme.surfaceContainerLow,
        border = if (error) BorderStroke(1.dp, style.resolvedError()) else null,
    ) {
        CompositionLocalProvider(LocalBdInCard provides true, LocalBdTreeSpacing provides 16.dp) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
        }
    }
}

// Either/or

private val containerTypes = setOf("condition_block", "flex_row", "input_group", "or_condition", "multi_populator")

/** Two (or more) alternatives where at least one must be filled. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BdEitherOr(node: BdFormField, entries: List<BdFieldPath.Entry>) {
    val controller = bdController()
    val strings = LocalBdFormStrings.current
    val path = BdFieldPath(node.id, entries)
    val error = controller.error(path)
    val branches = node.children.orEmpty()

    fun sideLabel(i: Int, child: BdFormField): String {
        if (i == 0) node.orConditionConfig?.leftLabel.nonEmpty()?.let { return it }
        if (i == 1) node.orConditionConfig?.rightLabel.nonEmpty()?.let { return it }
        if (child.label.isNotEmpty()) return child.label
        return listOf("Option A", "Option B", "Option C").getOrNull(i) ?: "Option ${i + 1}"
    }

    Column(
        Modifier.fillMaxWidth().bringIntoViewRequester(rememberScrollTarget(path.key)),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (node.label.isNotEmpty()) Text(node.label, style = MaterialTheme.typography.titleSmall)
        Text(strings.fillOneSide, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        BdInnerSurface(error = error != null) {
            branches.forEachIndexed { i, child ->
                key(child.id) {
                    if (i > 0) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            HorizontalDivider(Modifier.weight(1f))
                            Spacer(Modifier.width(12.dp))
                            Text(strings.or, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.width(12.dp))
                            HorizontalDivider(Modifier.weight(1f))
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        val side = sideLabel(i, child)
                        val showsOwnLabel = child.type !in containerTypes && child.type !in BdFieldType.noLabel && child.label.isNotEmpty()
                        // A plain field already shows its own label; don't say it twice.
                        if (!(showsOwnLabel && side == child.label)) Text(side, style = MaterialTheme.typography.labelLarge)
                        BdFieldTree(listOf(child), entries)
                    }
                }
            }
        }
        if (error != null) BdErrorText(error)
    }
}

// Repeater

/** A `multi_populator`: the same fields once per entry, with add and remove. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BdRepeater(node: BdFormField, entries: List<BdFieldPath.Entry>) {
    val controller = bdController()
    val strings = LocalBdFormStrings.current
    val path = BdFieldPath(node.id, entries)
    val list = controller.entries(path)
    val cfg = node.populatorConfig
    val max = cfg?.maxInstances ?: 10
    val itemLabel = cfg?.itemLabel.nonEmpty() ?: node.label.nonEmpty() ?: strings.entry
    val error = controller.error(path)

    Column(
        Modifier.fillMaxWidth().bringIntoViewRequester(rememberScrollTarget(path.key)),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (node.label.isNotEmpty()) BdRequiredLabel(node.label, node.required)
        for (index in list.indices) {
            key(index) {
                BdInnerSurface {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("$itemLabel ${index + 1}", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                        if (list.size > 1) {
                            IconButton(onClick = { controller.removeEntry(index, path) }) {
                                Icon(Icons.Filled.Close, contentDescription = "${strings.removeEntry} ${index + 1}")
                            }
                        }
                    }
                    BdFieldTree(node.children.orEmpty(), path.entry(index))
                }
            }
        }
        if (list.size < max) {
            OutlinedButton(onClick = { controller.addEntry(path) }) {
                Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(cfg?.addButtonLabel.nonEmpty() ?: strings.addAnother)
            }
        }
        if (error != null) BdErrorText(error)
    }
}
