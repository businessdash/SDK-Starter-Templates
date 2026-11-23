package app.bd.forms.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bd.forms.BdFormRules
import app.bd.forms.BdFormField
import app.bd.forms.BdJS
import app.bd.forms.BdJson
import app.bd.forms.BdLoadState
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private fun strings(values: List<String>): BdJson = BdJson.Arr(values.map { BdJson.Str(it) })

private fun toggled(list: List<String>, item: String): List<String> = if (item in list) list - item else list + item

// Select, radio, checkbox

@Composable
internal fun BdSelectControl(ctx: BdFieldContext) {
    val f = ctx.field
    val strings = LocalBdFormStrings.current
    val options = f.options.orEmpty().map { BdOption(it, it, icon = f.optionIcons?.get(it)) }
    BdOptionPicker(
        title = f.label,
        placeholder = f.placeholder.nonEmpty() ?: strings.select,
        options = options,
        selection = listOfNotNull(ctx.value?.stringValue.nonEmpty()),
        onSelect = {
            ctx.setText(it.firstOrNull() ?: "")
            ctx.commit()
        },
        multi = false,
        searchable = BdFormRules.shouldSearch(options.size, f.display),
        allowCustom = f.allowCustom == true,
        isError = ctx.error != null,
    )
}

@Composable
internal fun BdRadioControl(ctx: BdFieldContext) {
    val current = ctx.value?.stringValue
    BdChoiceGroup(multi = false) {
        for (opt in ctx.field.options.orEmpty()) {
            BdChoiceRow(selected = current == opt, multi = false, onClick = {
                ctx.setText(opt)
                ctx.commit()
            }) { BdOptionLabel(BdOption(opt, opt, icon = ctx.field.optionIcons?.get(opt))) }
        }
    }
}

@Composable
internal fun BdCheckboxControl(ctx: BdFieldContext) {
    val f = ctx.field
    val strings = LocalBdFormStrings.current
    val selected = ctx.value?.stringArray.orEmpty()
    val opts = f.options.orEmpty()
    if (f.display == "dropdown" || BdFormRules.shouldSearch(opts.size, f.display)) {
        BdOptionPicker(
            title = f.label,
            placeholder = f.placeholder.nonEmpty() ?: strings.select,
            options = opts.map { BdOption(it, it, icon = f.optionIcons?.get(it)) },
            selection = selected,
            onSelect = {
                ctx.set(strings(it))
                ctx.commit()
            },
            multi = true,
            allowCustom = f.allowCustom == true,
            isError = ctx.error != null,
        )
    } else {
        BdChoiceGroup(multi = true) {
            for (opt in opts) {
                BdChoiceRow(selected = opt in selected, multi = true, onClick = {
                    ctx.set(strings(toggled(selected, opt)))
                    ctx.commit()
                }) { BdOptionLabel(BdOption(opt, opt, icon = f.optionIcons?.get(opt))) }
            }
        }
    }
}

// Choice cards

@Composable
internal fun BdChoiceCardsControl(ctx: BdFieldContext) {
    val cfg = ctx.field.choiceConfig
    val multi = cfg?.mode == "multi"
    val style = LocalBdFormStyle.current
    val picked = if (multi) ctx.value?.stringArray.orEmpty() else listOfNotNull(ctx.value?.stringValue.nonEmpty())
    val colors = MaterialTheme.colorScheme

    fun toggle(label: String) {
        if (multi) ctx.set(strings(toggled(picked, label))) else ctx.setText(if (picked.firstOrNull() == label) "" else label)
        ctx.commit()
    }

    Column(
        if (multi) Modifier else Modifier.selectableGroup(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        for (opt in cfg?.options.orEmpty()) {
            val on = opt.label in picked
            OutlinedCard(
                onClick = { toggle(opt.label) },
                shape = RoundedCornerShape(style.cornerRadius),
                border = BorderStroke(if (on) 2.dp else 1.dp, if (on) colors.primary else colors.outlineVariant),
                colors = CardDefaults.outlinedCardColors(
                    containerColor = if (on) colors.primary.copy(alpha = 0.06f).compositeOver(colors.surface) else colors.surface,
                ),
                modifier = Modifier.fillMaxWidth().semantics { selected = on },
            ) {
                BdChoiceCard(opt, on, multi)
            }
        }
    }
}

@Composable
private fun BdChoiceCard(opt: BdFormField.ChoiceConfig.Option, on: Boolean, multi: Boolean) {
    val strings = LocalBdFormStrings.current
    val uri = LocalUriHandler.current
    Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        val image = BdFormRules.safeHttpUrl(opt.imageUrl)
        if (image != null) {
            BdRemoteImage(image, contentDescription = null, modifier = Modifier.size(56.dp).clip(RoundedCornerShape(10.dp)))
        } else {
            opt.icon.nonEmpty()?.let { icon ->
                Box(Modifier.width(32.dp), contentAlignment = Alignment.Center) {
                    BdIcon(icon, size = 24.dp, tint = MaterialTheme.colorScheme.primary)
                }
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(opt.label, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                opt.price.nonEmpty()?.let {
                    Text(it, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            opt.description.nonEmpty()?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            BdFormRules.safeHttpUrl(opt.href)?.let { href ->
                TextButton(onClick = { uri.openUri(href) }, contentPadding = PaddingValues(0.dp)) { Text(strings.view) }
            }
        }
        if (multi) Checkbox(checked = on, onCheckedChange = null) else RadioButton(selected = on, onClick = null)
    }
}

// Boolean

@Composable
internal fun BdBooleanControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val on = ctx.value == BdJson.Bool(true)
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clip(RoundedCornerShape(8.dp))
            .toggleable(value = on, role = Role.Switch, onValueChange = {
                ctx.set(BdJson.Bool(it))
                ctx.commit()
            }),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(ctx.field.placeholder.nonEmpty() ?: strings.yesNo, modifier = Modifier.weight(1f))
        Switch(checked = on, onCheckedChange = null)
    }
}

// Icon select

@Composable
internal fun BdIconSelectControl(ctx: BdFieldContext) {
    val cfg = ctx.field.iconConfig
    val strings = LocalBdFormStrings.current
    val style = LocalBdFormStyle.current
    val base = LocalBdIconBaseUrl.current
    val curated = cfg?.allowedIcons.orEmpty()
    val current = ctx.value?.stringValue ?: ""
    var query by remember { mutableStateOf("") }
    val all by produceState(emptyList<String>(), curated.isEmpty(), base) {
        if (curated.isEmpty()) value = BdIconStore.allNames(base)
    }
    val q = BdJS.trim(query).lowercase()
    val names = (if (curated.isEmpty()) all else curated).let { src -> if (q.isEmpty()) src else src.filter { q in it } }.take(120)
    val columns = maxOf(cfg?.columns ?: 6, 2)
    val colors = MaterialTheme.colorScheme

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (curated.isEmpty()) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text(strings.searchIcons) },
                singleLine = true,
                keyboardOptions = BdKeyboard.Url.options(androidx.compose.ui.text.input.ImeAction.Search),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        // Not a lazy grid: the form already scrolls.
        for (row in names.chunked(columns)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (name in row) {
                    val on = name == current
                    Box(
                        Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(style.cornerRadius * 0.75f))
                            .background(if (on) colors.primary else colors.surfaceContainerHighest)
                            .clickable(role = Role.RadioButton) {
                                ctx.setText(if (on) "" else name)
                                ctx.commit()
                            }
                            .semantics {
                                contentDescription = name.replace('-', ' ')
                                selected = on
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        BdIcon(name, size = 22.dp, tint = if (on) colors.onPrimary else colors.onSurface)
                    }
                }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
        if (current.isNotEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(current, style = MaterialTheme.typography.labelMedium.copy(fontFamily = FontFamily.Monospace), color = colors.onSurfaceVariant, modifier = Modifier.weight(1f))
                TextButton(onClick = { ctx.setText("") }) { Text(strings.clear) }
            }
        }
    }
}

// Services

@Composable
internal fun BdServiceControl(ctx: BdFieldContext) {
    val cfg = ctx.field.serviceConfig
    val strings = LocalBdFormStrings.current
    val multi = cfg?.multi != false
    val picked = ctx.value?.stringArray.orEmpty()
    BdChoiceGroup(multi) {
        for (opt in cfg?.options.orEmpty()) {
            BdChoiceRow(selected = opt.id in picked, multi = multi, onClick = {
                val next = if (multi) toggled(picked, opt.id) else if (picked == listOf(opt.id)) emptyList() else listOf(opt.id)
                ctx.set(strings(next))
                ctx.commit()
            }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(opt.title, modifier = Modifier.weight(1f))
                    val h = opt.estimatedHours
                    if (h != null && h > 0) {
                        Text(
                            "${BdJS.string(h)} ${if (h == 1.0) strings.hour else strings.hours}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

// Collection records

@Composable
internal fun BdCollectionControl(ctx: BdFieldContext) {
    val f = ctx.field
    val strings = LocalBdFormStrings.current
    val multi = f.collectionSelectConfig?.multi == true
    val controller = ctx.controller
    val scope = rememberCoroutineScope()
    LaunchedEffect(f.id) { controller.loadCollectionOptions(f.id) }

    when (val state = LocalBdFormState.current.collectionOptions[f.id]) {
        is BdLoadState.Loaded -> {
            val options = state.value.map { BdOption(it.value, it.label, image = it.image) }
            val selection = if (multi) ctx.value?.stringArray.orEmpty() else listOfNotNull(ctx.value?.stringValue.nonEmpty())
            val write: (List<String>) -> Unit = { next ->
                ctx.set(if (multi) strings(next) else BdJson.Str(next.firstOrNull() ?: ""))
                ctx.commit()
            }
            if (options.size > BdFormRules.SEARCHABLE_THRESHOLD || f.display == "combobox") {
                BdOptionPicker(
                    title = f.label,
                    placeholder = f.placeholder.nonEmpty() ?: strings.select,
                    options = options,
                    selection = selection,
                    onSelect = write,
                    multi = multi,
                    searchable = true,
                    isError = ctx.error != null,
                )
            } else {
                BdChoiceGroup(multi) {
                    for (o in options) {
                        BdChoiceRow(selected = o.value in selection, multi = multi, onClick = {
                            write(if (multi) toggled(selection, o.value) else if (selection == listOf(o.value)) emptyList() else listOf(o.value))
                        }) { BdOptionLabel(o) }
                    }
                }
            }
        }
        is BdLoadState.Failed -> BdRetryRow(state.message) { scope.launch { controller.reloadCollectionOptions(f.id) } }
        else -> BdLoadingRow(strings.loadingOptions)
    }
}

@Composable
internal fun BdLoadingRow(text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.heightIn(min = 48.dp)) {
        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
internal fun BdRetryRow(message: String, retry: () -> Unit) {
    val err = LocalBdFormStyle.current.resolvedError()
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Filled.Warning, contentDescription = null, tint = err, modifier = Modifier.size(18.dp))
        Text(message, color = err, modifier = Modifier.weight(1f))
        TextButton(onClick = retry) { Text(LocalBdFormStrings.current.retry) }
    }
}

// Color

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun BdColorControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val colors = MaterialTheme.colorScheme
    val current = ctx.value?.stringValue ?: ""
    val presets = ctx.field.options.orEmpty()
    val isCustom = current.isNotEmpty() && presets.none { it.equals(current, ignoreCase = true) }
    var editing by remember { mutableStateOf(false) }

    FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        for (hex in presets) {
            val on = hex.equals(current, ignoreCase = true)
            BdSwatch(BdColor.parse(hex), on, hex) {
                ctx.setText(hex)
                ctx.commit()
            }
        }
        // Android has no system color picker: a hex entry, previewed live.
        Box(
            Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(if (isCustom) BdColor.parse(current) ?: colors.surfaceContainerHighest else colors.surfaceContainerHighest)
                .border(if (isCustom) 3.dp else 1.dp, if (isCustom) colors.primary else colors.outlineVariant, CircleShape)
                .clickable(role = Role.Button) { editing = true }
                .semantics { contentDescription = strings.customColor },
            contentAlignment = Alignment.Center,
        ) {
            if (!isCustom) Icon(Icons.Filled.Add, contentDescription = null, tint = colors.onSurfaceVariant)
        }
    }
    if (editing) {
        BdHexDialog(initial = if (isCustom) current else "#3B82F6", onDismiss = { editing = false }) { hex ->
            ctx.setText(hex)
            ctx.commit()
        }
    }
}

@Composable
private fun BdSwatch(color: Color?, on: Boolean, label: String, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Box(
        Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(color ?: Color.Transparent)
            .border(1.dp, colors.outlineVariant, CircleShape)
            .clickable(role = Role.RadioButton, onClick = onClick)
            .semantics {
                contentDescription = label
                selected = on
            },
        contentAlignment = Alignment.Center,
    ) {
        if (on) Icon(Icons.Filled.Check, contentDescription = null, tint = BdColor.contrasting(color), modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun BdHexDialog(initial: String, onDismiss: () -> Unit, onPick: (String) -> Unit) {
    val strings = LocalBdFormStrings.current
    var text by remember { mutableStateOf(initial) }
    val parsed = BdColor.parse(text)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.customColor) },
        text = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(40.dp).clip(CircleShape).background(parsed ?: Color.Transparent).border(1.dp, MaterialTheme.colorScheme.outlineVariant, CircleShape))
                OutlinedTextField(
                    value = text,
                    onValueChange = { t -> text = t.filter { it == '#' || it.isLetterOrDigit() }.take(7) },
                    label = { Text(strings.hexColor) },
                    singleLine = true,
                    isError = parsed == null,
                    keyboardOptions = BdKeyboard.Url.options(androidx.compose.ui.text.input.ImeAction.Done),
                )
            }
        },
        confirmButton = {
            TextButton(enabled = parsed != null, onClick = {
                onPick(BdColor.normalize(text) ?: text)
                onDismiss()
            }) { Text(strings.done) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
    )
}

internal object BdColor {
    fun components(hex: String): Triple<Int, Int, Int>? {
        var s = hex.trim().removePrefix("#")
        if (s.length == 3) s = s.map { "$it$it" }.joinToString("")
        if (s.length != 6) return null
        val v = s.toIntOrNull(16) ?: return null
        return Triple((v shr 16) and 0xFF, (v shr 8) and 0xFF, v and 0xFF)
    }

    fun parse(hex: String): Color? = components(hex)?.let { (r, g, b) -> Color(r, g, b) }

    /** `#RRGGBB`, uppercase, as BD stores colors. */
    fun normalize(hex: String): String? = components(hex)?.let { (r, g, b) -> String.format("#%02X%02X%02X", r, g, b) }

    fun contrasting(color: Color?): Color = if (color == null || color.luminance() > 0.45f) Color.Black else Color.White
}

// Slider, ratings, stepper

@Composable
internal fun BdSliderControl(ctx: BdFieldContext) {
    val cfg = ctx.field.sliderConfig
    val lo = cfg?.min ?: 0.0
    val hi = maxOf(cfg?.max ?: 100.0, lo + 1)
    val step = maxOf(cfg?.step ?: 1.0, Math.ulp(1.0))
    val v = ctx.value?.doubleValue ?: lo
    var dragging by remember { mutableStateOf<Double?>(null) }
    val shown = dragging ?: v
    fun fmt(n: Double): String = when (cfg?.unit) {
        "currency" -> "$" + BdJS.string(n)
        "percent" -> BdJS.string(n) + "%"
        else -> BdJS.string(n)
    }
    val stops = ((hi - lo) / step).roundToInt() - 1

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(fmt(lo), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                fmt(shown),
                style = MaterialTheme.typography.titleMedium.copy(fontFeatureSettings = "tnum"),
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
            Text(fmt(hi), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Slider(
            value = shown.toFloat(),
            onValueChange = { raw ->
                val snapped = Math.round(raw / step) * step
                dragging = snapped
                ctx.set(BdJson.Num(snapped))
            },
            onValueChangeFinished = {
                dragging = null
                ctx.commit()
            },
            valueRange = lo.toFloat()..hi.toFloat(),
            // Tick marks only when there are few enough to read.
            steps = if (stops in 1..20) stops else 0,
            modifier = Modifier.semantics {
                contentDescription = ctx.field.label
                stateDescription = fmt(shown)
            },
        )
    }
}

@Composable
internal fun BdStarsControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val max = maxOf(ctx.field.starRatingConfig?.maxStars ?: 5, 1)
    val v = ctx.value?.doubleValue?.toInt() ?: 0
    Row(
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        modifier = Modifier.selectableGroup(),
    ) {
        for (i in 1..max) {
            IconButton(
                onClick = {
                    ctx.set(BdJson.Num(i.toDouble()))
                    ctx.commit()
                },
                modifier = Modifier.semantics {
                    contentDescription = strings.format(strings.ratingOf, i, max)
                    selected = i == v
                },
            ) {
                Icon(
                    Icons.Filled.Star,
                    contentDescription = null,
                    tint = if (i <= v) Color(0xFFFFB300) else MaterialTheme.colorScheme.outlineVariant,
                    modifier = Modifier.size(32.dp),
                )
            }
        }
    }
}

@Composable
internal fun BdHappinessControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val faces = listOf("😞", "😕", "😐", "🙂", "😄")
    // 0 is a real answer (😞), so "unanswered" is null, not 0.
    val v = ctx.value?.doubleValue?.toInt() ?: -1
    val tint = MaterialTheme.colorScheme.primary
    Row(Modifier.fillMaxWidth().selectableGroup(), horizontalArrangement = Arrangement.SpaceEvenly) {
        faces.forEachIndexed { i, face ->
            val on = i == v
            Box(
                Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(if (on) tint.copy(alpha = 0.2f) else Color.Transparent)
                    .clickable(role = Role.RadioButton) {
                        ctx.set(BdJson.Num(i.toDouble()))
                        ctx.commit()
                    }
                    .semantics {
                        contentDescription = strings.happinessNames.getOrElse(i) { face }
                        selected = on
                    },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    face,
                    fontSize = 32.sp,
                    modifier = Modifier.scale(if (on) 1.15f else 1f).alpha(if (v < 0 || on) 1f else 0.5f),
                )
            }
        }
    }
}

@Composable
internal fun BdStepperControl(ctx: BdFieldContext) {
    val v = ctx.value?.doubleValue ?: 0.0
    val lo = ctx.field.validation?.min ?: -1_000_000.0
    val hi = maxOf(ctx.field.validation?.max ?: 1_000_000.0, lo)
    fun write(n: Double) {
        ctx.set(BdJson.Num(n.coerceIn(lo, hi)))
        ctx.commit()
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        val strings = LocalBdFormStrings.current
        OutlinedIconButton(
            onClick = { write(v - 1) },
            enabled = v - 1 >= lo,
            modifier = Modifier.semantics { contentDescription = strings.decrease },
        ) { Text("−", style = MaterialTheme.typography.titleLarge) }
        Text(
            BdJS.string(v),
            style = MaterialTheme.typography.titleLarge.copy(fontFeatureSettings = "tnum"),
            modifier = Modifier.semantics { contentDescription = "${ctx.field.label}, ${BdJS.string(v)}" },
        )
        OutlinedIconButton(onClick = { write(v + 1) }, enabled = v + 1 <= hi) { Icon(Icons.Filled.Add, contentDescription = strings.increase) }
    }
}
