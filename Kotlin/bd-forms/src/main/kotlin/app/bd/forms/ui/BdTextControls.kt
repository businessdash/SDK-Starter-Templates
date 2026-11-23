package app.bd.forms.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import app.bd.forms.BdFormRules
import app.bd.forms.BdJS
import app.bd.forms.BdJson
import app.bd.forms.BdUnits
import kotlin.math.truncate

@Composable
internal fun BdTextControl(ctx: BdFieldContext, email: Boolean) {
    val f = ctx.field
    BdTextInput(
        value = ctx.text,
        onValueChange = ctx::setText,
        placeholder = f.placeholder.nonEmpty() ?: if (email) "you@example.com" else null,
        keyboard = if (email) BdKeyboard.Email else keyboardFor(BdFormRules.autocompleteToken(f)),
        isError = ctx.error != null,
        onCommit = ctx::commit,
    )
}

@Composable
internal fun BdTextAreaControl(ctx: BdFieldContext) {
    val cfg = ctx.field.textareaConfig
    val rows = maxOf(cfg?.rows ?: 4, 1)
    BdTextInput(
        value = ctx.text,
        onValueChange = ctx::setText,
        placeholder = ctx.field.placeholder.nonEmpty(),
        singleLine = false,
        minLines = rows,
        maxLines = rows + if (cfg?.resizable == true) 12 else 4,
        isError = ctx.error != null,
        onCommit = ctx::commit,
    )
}

@Composable
internal fun BdPhoneControl(ctx: BdFieldContext) {
    val cfg = ctx.field.phoneConfig
    val intl = cfg?.international == true
    BdTextInput(
        value = ctx.text,
        onValueChange = ctx::setText,
        transform = { BdFormRules.formatPhone(it, international = intl) },
        placeholder = ctx.field.placeholder.nonEmpty() ?: if (intl) "+1 (555) 000-0000" else "(555) 000-0000",
        keyboard = BdKeyboard.Phone,
        leading = if (cfg?.showFlags == true) ({ Text("🇺🇸") }) else null,
        isError = ctx.error != null,
        onCommit = ctx::commit,
    )
}

@Composable
internal fun BdUrlControl(ctx: BdFieldContext) {
    BdTextInput(
        value = ctx.value?.get("url")?.stringValue ?: "",
        onValueChange = { ctx.setKey("url", BdJson.Str(it)) },
        placeholder = ctx.field.placeholder.nonEmpty() ?: "https://example.com",
        keyboard = BdKeyboard.Url,
        isError = ctx.error != null,
        onCommit = ctx::commit,
    )
}

// Numbers

/**
 * A number typed as text: keeps what the visitor typed ("1.", "-") while
 * the value stays a number, and filters out what the field doesn't allow.
 */
@Composable
internal fun BdNumericInput(
    value: Double?,
    onChange: (Double?) -> Unit,
    modifier: Modifier = Modifier,
    allowDecimal: Boolean = true,
    allowNegative: Boolean = true,
    placeholder: String? = null,
    leading: (@Composable () -> Unit)? = null,
    isError: Boolean = false,
    onCommit: () -> Unit = {},
) {
    var field by remember { mutableStateOf(TextFieldValue(BdNumeric.format(value))) }
    val sent = remember { arrayOf(value) }
    val wasFocused = remember { booleanArrayOf(false) }
    val focus = LocalFocusManager.current
    // Same frame as the composition: see BdTextInput.
    SideEffect {
        if (value != sent[0]) {
            sent[0] = value
            if (BdNumeric.parse(field.text) != value) {
                val t = BdNumeric.format(value)
                field = TextFieldValue(t, TextRange(t.length))
            }
        }
    }
    OutlinedTextField(
        value = field,
        onValueChange = { next ->
            val clean = BdNumeric.sanitize(next.text, allowDecimal, allowNegative)
            field = if (clean == next.text) next else TextFieldValue(clean, TextRange(clean.length))
            val n = BdNumeric.parse(clean)
            if (n != sent[0]) {
                sent[0] = n
                onChange(n)
            }
        },
        modifier = modifier.fillMaxWidth().onFocusChanged { s ->
            if (wasFocused[0] && !s.isFocused) onCommit()
            wasFocused[0] = s.isFocused
        },
        placeholder = placeholder?.let { { Text(it) } },
        leadingIcon = leading,
        isError = isError,
        singleLine = true,
        textStyle = LocalTextStyle.current.copy(fontFeatureSettings = "tnum"),
        keyboardOptions = (if (allowDecimal) BdKeyboard.Decimal else BdKeyboard.Integer).options(ImeAction.Next),
        keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
    )
}

internal object BdNumeric {
    fun sanitize(s: String, allowDecimal: Boolean, allowNegative: Boolean): String {
        val out = StringBuilder()
        var sawDot = false
        s.forEachIndexed { i, c ->
            when {
                c in '0'..'9' -> out.append(c)
                (c == '.' || c == ',') && allowDecimal && !sawDot -> {
                    out.append('.')
                    sawDot = true
                }
                c == '-' && allowNegative && i == 0 -> out.append(c)
            }
        }
        // A zero in front of another digit means nothing: typing after the
        // seeded "0" gives "40", not "040". "0.5" and "0" stay.
        val start = if (out.startsWith('-')) 1 else 0
        while (out.length > start + 1 && out[start] == '0' && out[start + 1].isDigit()) out.deleteCharAt(start)
        return out.toString()
    }

    fun parse(s: String): Double? {
        if (s.isEmpty() || s == "-" || s == "." || s == "-.") return null
        return s.toDoubleOrNull()
    }

    fun format(v: Double?): String = if (v == null || !v.isFinite()) "" else BdJS.string(v)
}

@Composable
internal fun BdNumberControl(ctx: BdFieldContext) {
    val f = ctx.field
    val allowDecimal = f.allowDecimal != false
    BdNumericInput(
        value = ctx.value?.doubleValue,
        onChange = { n -> ctx.set(if (n == null) BdJson.Null else BdJson.Num(if (allowDecimal) n else truncate(n))) },
        allowDecimal = allowDecimal,
        allowNegative = f.allowNegative != false,
        placeholder = f.placeholder.nonEmpty(),
        isError = ctx.error != null,
        onCommit = ctx::commit,
    )
}

@Composable
internal fun BdCurrencyControl(ctx: BdFieldContext) {
    val cfg = ctx.field.currencyConfig
    val allowDecimal = cfg?.allowDecimal != false
    BdNumericInput(
        value = ctx.value?.doubleValue,
        onChange = { n -> ctx.set(if (n == null) BdJson.Null else BdJson.Num(if (allowDecimal) n else truncate(n))) },
        allowDecimal = allowDecimal,
        allowNegative = cfg?.allowNegative == true,
        placeholder = ctx.field.placeholder.nonEmpty() ?: if (allowDecimal) "0.00" else "0",
        leading = { Text(cfg?.symbol.nonEmpty() ?: "$", color = MaterialTheme.colorScheme.onSurfaceVariant) },
        isError = ctx.error != null,
        onCommit = ctx::commit,
    )
}

@Composable
internal fun BdMeasurementControl(ctx: BdFieldContext) {
    val cfg = ctx.field.unitConfig
    val cat = BdUnits.category(cfg?.category) ?: BdUnits.category("length") ?: return
    val units = cfg?.units?.takeIf { it.isNotEmpty() } ?: cat.units.map { it.symbol }
    val unit = ctx.value?.get("unit")?.stringValue ?: cfg?.defaultUnit ?: units.firstOrNull() ?: cat.baseUnit
    val number = ctx.value?.get("value")?.doubleValue
    val allowDecimal = cfg?.allowDecimal != false

    fun emit(n: Double?, u: String) {
        val o = linkedMapOf<String, BdJson>("unit" to BdJson.Str(u), "baseUnit" to BdJson.Str(cat.baseUnit))
        if (n != null) {
            o["value"] = BdJson.Num(n)
            BdUnits.convertToBase(n, u, cat)?.let { o["base"] = BdJson.Num(it) }
        } else {
            o["value"] = BdJson.Str("")
        }
        ctx.set(BdJson.Obj(o))
    }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BdNumericInput(
                value = number,
                onChange = { n -> emit(n?.let { if (allowDecimal) it else truncate(it) }, unit) },
                modifier = Modifier.weight(1f),
                allowDecimal = allowDecimal,
                allowNegative = cat.isAffine,
                placeholder = ctx.field.placeholder.nonEmpty() ?: "0",
                isError = ctx.error != null,
                onCommit = ctx::commit,
            )
            if (cfg?.mode == "fixed") {
                Text(unit, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                var open by remember { mutableStateOf(false) }
                Box {
                    TextButton(onClick = { open = true }) {
                        Text(unit)
                        Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                    }
                    DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                        for (u in units) {
                            DropdownMenuItem(text = { Text(u) }, onClick = {
                                emit(number, u)
                                open = false
                            })
                        }
                    }
                }
            }
        }
        if (number != null) {
            Text(
                "≈ " + BdUnits.format(number, unit, cat),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

// Name & address

/** One part of an object-valued field (first name, city…), with a floating label. */
@Composable
private fun BdPartField(
    ctx: BdFieldContext,
    key: String,
    label: String,
    keyboard: BdKeyboard = BdKeyboard.Words,
    placeholder: String? = null,
    filter: (String) -> String = { it },
) {
    val v = ctx.value?.get(key)
    BdTextInput(
        value = v?.stringValue ?: v?.arrayValue?.mapNotNull { it.stringValue }?.joinToString(", ") ?: "",
        onValueChange = { ctx.setKey(key, BdJson.Str(it)) },
        transform = filter,
        label = label,
        placeholder = placeholder,
        keyboard = keyboard,
        isError = ctx.error != null,
        onCommit = ctx::commit,
    )
}

@Composable
internal fun BdNameControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val cfg = ctx.field.nameConfig
    val kb = if (ctx.field.autocomplete == "off") BdKeyboard.Text else BdKeyboard.Words
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (cfg?.prefix == true) BdPartField(ctx, "prefix", strings.namePrefix, kb, "Dr.")
        BdPartField(ctx, "first", strings.firstName, kb, "Jane")
        if (cfg?.middle == true) BdPartField(ctx, "middle", strings.middleName, kb, "Quinn")
        BdPartField(ctx, "last", strings.lastName, kb, "Doe")
        if (cfg?.suffix == true) BdPartField(ctx, "suffix", strings.nameSuffix, kb, "Jr.")
        if (cfg?.nicknames == true) BdPartField(ctx, "nicknames", strings.nicknames, kb, strings.nicknamesPlaceholder)
    }
}

@Composable
internal fun BdAddressControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BdPartField(ctx, "line1", strings.addressLine1)
        BdPartField(ctx, "line2", strings.addressLine2)
        BdPartField(ctx, "city", strings.city)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BdOptionPicker(
                title = strings.state,
                placeholder = strings.selectState,
                options = BdFormRules.usStates.map { (name, abbr) -> BdOption(abbr, name) },
                selection = listOfNotNull(ctx.value?.get("state")?.stringValue.nonEmpty()),
                onSelect = { picked ->
                    ctx.setKey("state", BdJson.Str(picked.firstOrNull() ?: ""))
                    ctx.commit()
                },
                multi = false,
                label = strings.state,
                isError = ctx.error != null,
                modifier = Modifier.weight(1.4f),
            )
            Box(Modifier.weight(1f)) {
                BdPartField(ctx, "zip", strings.zip, BdKeyboard.Integer, "90210") { s -> s.filter { it in '0'..'9' || it == '-' } }
            }
        }
    }
}

// Tags

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun BdTagsControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    var draft by remember { mutableStateOf("") }
    val tags = ctx.value?.stringArray.orEmpty()

    fun add(text: String) {
        val parts = text.split(',').map { BdJS.trim(it) }.filter { it.isNotEmpty() }
        draft = ""
        if (parts.isEmpty()) return
        val next = tags.toMutableList()
        for (p in parts) if (p !in next) next += p
        ctx.set(BdJson.Arr(next.map { BdJson.Str(it) }))
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        BdTagEntry(
            value = draft,
            placeholder = ctx.field.placeholder.nonEmpty() ?: strings.addTag,
            isError = ctx.error != null,
            onValueChange = { t -> if (t.endsWith(",")) add(t) else draft = t },
            onAdd = {
                add(draft)
                ctx.commit()
            },
        )
        if (tags.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (tag in tags) {
                    InputChip(
                        selected = false,
                        onClick = { ctx.set(BdJson.Arr(tags.filter { it != tag }.map { BdJson.Str(it) })) },
                        label = { Text(tag) },
                        trailingIcon = {
                            Icon(Icons.Filled.Close, contentDescription = strings.format(strings.removeTag, tag), modifier = Modifier.size(18.dp))
                        },
                    )
                }
            }
        }
    }
}

/** The draft box for tags: Enter (or a comma) adds what was typed. */
@Composable
private fun BdTagEntry(value: String, placeholder: String, isError: Boolean, onValueChange: (String) -> Unit, onAdd: () -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder) },
        isError = isError,
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { onAdd() }),
        modifier = Modifier.fillMaxWidth().onFocusChanged { if (!it.isFocused && value.isNotBlank()) onAdd() },
    )
}
