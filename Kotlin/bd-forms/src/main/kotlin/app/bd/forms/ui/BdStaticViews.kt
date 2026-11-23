package app.bd.forms.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import app.bd.forms.BdCalculation
import app.bd.forms.BdFormField
import app.bd.forms.BdFormRules
import app.bd.forms.BdJson

/** Display-only elements: headings, copy, lists, tables, images. */
@Composable
internal fun BdStaticContent(field: BdFormField) {
    val type = MaterialTheme.typography
    when (field.type) {
        "title" -> Text(
            field.label.ifEmpty { "Untitled" },
            style = type.titleLarge.copy(fontWeight = FontWeight.Bold),
            modifier = Modifier.semantics { heading() },
        )
        "subtitle" -> Text(
            field.label,
            style = type.titleMedium.copy(fontWeight = FontWeight.SemiBold),
            modifier = Modifier.semantics { heading() },
        )
        "separator" -> HorizontalDivider()
        "richtext" -> field.content.nonEmpty()?.let { BdHtmlText(it, Modifier.fillMaxWidth()) }
        "body_text" -> field.content.nonEmpty()?.let { Text(it, style = type.bodyLarge, modifier = Modifier.fillMaxWidth()) }
        "bullet_list" -> BdBulletList(field.listConfig)
        "table" -> BdTable(field.tableConfig)
        "image" -> BdStaticImage(field.imageConfig)
    }
}

/** Server-sanitized HTML drawn as native text, links included. */
@Composable
internal fun BdHtmlText(html: String, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    val text = remember(html, colors.primary, colors.onSurfaceVariant) { BdHtml.annotated(html, colors.primary, colors.onSurfaceVariant) }
    Text(text, style = MaterialTheme.typography.bodyLarge, modifier = modifier)
}

@Composable
private fun BdStaticImage(cfg: BdFormField.ImageConfig?) {
    val url = BdFormRules.safeHttpUrl(cfg?.src) ?: return
    val radius = LocalBdFormStyle.current.cornerRadius * 0.5f
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        BdRemoteImage(
            url,
            contentDescription = cfg?.alt.nonEmpty(),
            contentScale = ContentScale.Fit,
            placeholderHeight = (cfg?.height ?: 160.0).dp,
            modifier = Modifier
                .then(cfg?.width?.let { Modifier.widthIn(max = it.dp) } ?: Modifier.fillMaxWidth())
                .then(cfg?.height?.let { Modifier.height(it.dp) } ?: Modifier)
                .clip(RoundedCornerShape(radius)),
        )
    }
}

@Composable
private fun BdBulletList(config: BdFormField.ListConfig?) {
    val items = config?.items.orEmpty()
    val details = config?.variant == "details"
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (!details && !config?.title.isNullOrEmpty()) {
            Text(config?.title.orEmpty(), style = MaterialTheme.typography.titleMedium)
        }
        for (item in items) {
            if (details) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    item.icon.nonEmpty()?.let {
                        BdIcon(it, size = 20.dp, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 2.dp))
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(item.text, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold))
                        item.description.nonEmpty()?.let {
                            Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("•", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(item.text, style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}

/** Full width when it fits; scrolls sideways when it doesn't. */
@Composable
private fun BdTable(config: BdFormField.TableConfig?) {
    val columns = config?.columns.orEmpty()
    if (columns.isEmpty()) return
    val rows = config?.rows.orEmpty()
    val highlight = config?.highlightColumn
    val colors = MaterialTheme.colorScheme
    val band = colors.primary.copy(alpha = 0.12f)
    val rule = colors.outlineVariant

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val available = constraints.maxWidth
        Box(Modifier.horizontalScroll(rememberScrollState())) {
            BdTableLayout(columnCount = columns.size, minWidth = available) {
                columns.forEachIndexed { ci, col ->
                    BdTableCell(col.align, if (ci == highlight) band else Color.Transparent, Modifier.drawBehind {
                        val y = size.height - 0.5f
                        drawLine(rule, Offset(0f, y), Offset(size.width, y), strokeWidth = 1.dp.toPx())
                    }) {
                        Text(col.header, style = MaterialTheme.typography.labelLarge)
                    }
                }
                for (row in rows) {
                    columns.forEachIndexed { ci, col ->
                        val text = row.cells?.getOrNull(ci) ?: ""
                        BdTableCell(col.align, if (ci == highlight) band else Color.Transparent) {
                            when (if (col.type == "check") BdFormRules.tableCheckState(text) else "text") {
                                "yes" -> Icon(Icons.Filled.Check, contentDescription = "Yes", tint = colors.primary, modifier = Modifier.size(18.dp))
                                "no" -> Text("–", color = colors.onSurfaceVariant, modifier = Modifier.semantics { contentDescription = "No" })
                                else -> Text(text, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BdTableCell(align: String?, background: Color, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val alignment = when (align) {
        "center" -> Alignment.Center
        "right" -> Alignment.CenterEnd
        else -> Alignment.CenterStart
    }
    // No gaps between cells, so a highlighted column reads as one band.
    Box(modifier.background(background).padding(horizontal = 8.dp, vertical = 7.dp), contentAlignment = alignment) { content() }
}

/**
 * Cells in row-major order. Each column is as wide as its widest cell, and
 * the columns stretch to [minWidth] when they'd leave it unfilled; each row
 * is as tall as its tallest cell.
 */
@Composable
private fun BdTableLayout(columnCount: Int, minWidth: Int, content: @Composable () -> Unit) {
    Layout(content) { measurables, _ ->
        val cols = columnCount
        val rowCount = measurables.size / cols
        val widths = IntArray(cols)
        for (r in 0 until rowCount) {
            for (c in 0 until cols) {
                widths[c] = maxOf(widths[c], measurables[r * cols + c].maxIntrinsicWidth(Constraints.Infinity))
            }
        }
        val natural = widths.sum()
        if (natural in 1 until minWidth) {
            var extra = minWidth - natural
            for (c in 0 until cols) {
                val add = if (c == cols - 1) extra else (minWidth - natural) * widths[c] / natural
                widths[c] += add
                extra -= add
            }
        }
        val heights = IntArray(rowCount) { r ->
            (0 until cols).maxOf { c -> measurables[r * cols + c].minIntrinsicHeight(widths[c]) }
        }
        val placeables = measurables.mapIndexed { i, m ->
            val r = i / cols
            val c = i % cols
            if (r < rowCount) m.measure(Constraints.fixed(widths[c], heights[r])) else m.measure(Constraints.fixed(0, 0))
        }
        layout(widths.sum(), heights.sum()) {
            var y = 0
            for (r in 0 until rowCount) {
                var x = 0
                for (c in 0 until cols) {
                    placeables[r * cols + c].place(x, y)
                    x += widths[c]
                }
                y += heights[r]
            }
        }
    }
}

/** A live calculation result, read-only. */
@Composable
internal fun BdCalculationView(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val cfg = ctx.field.calculationConfig
    val value = ctx.value
    val hasValue = !(value == null || value.isNull || value == BdJson.Str(""))
    Surface(
        shape = RoundedCornerShape(LocalBdFormStyle.current.cornerRadius),
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            if (cfg?.sensitive == true && !hasValue) {
                Text(strings.calculatedOnSubmit, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                SelectionContainer {
                    Text(
                        if (hasValue) BdCalculation.format(value, cfg?.display) else "—",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold, fontFeatureSettings = "tnum"),
                    )
                }
            }
        }
    }
}
