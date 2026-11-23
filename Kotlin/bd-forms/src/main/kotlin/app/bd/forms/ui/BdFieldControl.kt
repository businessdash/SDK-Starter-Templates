package app.bd.forms.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import app.bd.forms.BdFormRules
import app.bd.forms.BdJS
import app.bd.forms.BdJson
import kotlinx.coroutines.launch

/** The native control for one element, by type. Custom renderers can fall back to it. */
@Composable
public fun BdFieldControl(ctx: BdFieldContext) {
    when (ctx.field.type) {
        // Static
        "title", "subtitle", "separator", "richtext", "body_text", "bullet_list", "table", "image" -> BdStaticContent(ctx.field)
        "calculation" -> BdCalculationView(ctx)
        // Text
        "textarea" -> BdTextAreaControl(ctx)
        "email" -> BdTextControl(ctx, email = true)
        "phone" -> BdPhoneControl(ctx)
        "url" -> BdUrlControl(ctx)
        "number" -> BdNumberControl(ctx)
        "currency" -> BdCurrencyControl(ctx)
        "measurement" -> BdMeasurementControl(ctx)
        "name" -> BdNameControl(ctx)
        "address" -> BdAddressControl(ctx)
        "tags" -> BdTagsControl(ctx)
        "rich_text_input" -> BdRichTextControl(ctx)
        // Choices
        "select" -> BdSelectControl(ctx)
        "radio" -> BdRadioControl(ctx)
        "checkbox" -> BdCheckboxControl(ctx)
        "choice_cards" -> BdChoiceCardsControl(ctx)
        "boolean" -> BdBooleanControl(ctx)
        "icon_select" -> BdIconSelectControl(ctx)
        "service_selector" -> BdServiceControl(ctx)
        "collection_select" -> BdCollectionControl(ctx)
        "color_picker" -> BdColorControl(ctx)
        "slider" -> BdSliderControl(ctx)
        "star_rating" -> BdStarsControl(ctx)
        "happiness_rating" -> BdHappinessControl(ctx)
        "stepper" -> BdStepperControl(ctx)
        // Dates
        "date" -> BdDateControl(ctx)
        "date_range" -> BdDateRangeControl(ctx)
        "time_picker" -> BdTimeControl(ctx)
        "month_year" -> BdMonthYearControl(ctx)
        "schedule" -> if (ctx.field.scheduleConfig?.mode == "auto") BdBookingControl(ctx) else BdAvailabilityControl(ctx)
        // Media & payment
        "file_upload" -> BdFileControl(ctx)
        "image_input" -> BdImageInputControl(ctx)
        "credit_card" -> BdCardControl(ctx)
        else -> BdTextControl(ctx, email = false)
    }
}

// Keyboards

internal enum class BdKeyboard { Text, Words, Email, Phone, Url, Decimal, Integer }

internal fun BdKeyboard.options(ime: ImeAction): KeyboardOptions = when (this) {
    BdKeyboard.Text -> KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ime)
    BdKeyboard.Words -> KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ime)
    BdKeyboard.Email -> KeyboardOptions(keyboardType = KeyboardType.Email, autoCorrectEnabled = false, imeAction = ime)
    BdKeyboard.Phone -> KeyboardOptions(keyboardType = KeyboardType.Phone, imeAction = ime)
    BdKeyboard.Url -> KeyboardOptions(keyboardType = KeyboardType.Uri, autoCorrectEnabled = false, imeAction = ime)
    BdKeyboard.Decimal -> KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ime)
    BdKeyboard.Integer -> KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ime)
}

/** The keyboard for a field's autofill token (HTML `autocomplete` vocabulary). */
internal fun keyboardFor(token: String?): BdKeyboard = when (token) {
    "email" -> BdKeyboard.Email
    "tel", "tel-national" -> BdKeyboard.Phone
    "url" -> BdKeyboard.Url
    "one-time-code" -> BdKeyboard.Integer
    "name", "given-name", "additional-name", "family-name", "nickname", "honorific-prefix", "honorific-suffix",
    "organization", "organization-title", "street-address", "address-line1", "address-line2",
    "address-level1", "address-level2", "country-name",
    -> BdKeyboard.Words
    else -> BdKeyboard.Text
}

/**
 * A text field that keeps what the visitor is typing as its own state and
 * writes it through, so a keystroke never waits on the form's state to come
 * back round. Adopts the value when it changes from outside (a reset, a
 * prefill). Reports when the visitor leaves it.
 *
 * @param transform rewrites what was typed (filtering, phone formatting);
 *   the caret moves to the end when it changes the text.
 */
@Composable
internal fun BdTextInput(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String? = null,
    keyboard: BdKeyboard = BdKeyboard.Text,
    singleLine: Boolean = true,
    minLines: Int = 1,
    maxLines: Int = if (singleLine) 1 else Int.MAX_VALUE,
    isError: Boolean = false,
    transform: (String) -> String = { it },
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    textStyle: TextStyle = LocalTextStyle.current,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    onCommit: () -> Unit = {},
) {
    var field by remember { mutableStateOf(TextFieldValue(value, TextRange(value.length))) }
    val pushed = remember { arrayOf(value) }
    val wasFocused = remember { booleanArrayOf(false) }
    val focus = LocalFocusManager.current
    // Adopt a value set from outside (a prefill, a reset, a removed repeater
    // entry). This runs in the same frame as the composition that read
    // `value`, so no keystroke can land in between: `value` is either what
    // the field last pushed or a real outside change. A LaunchedEffect runs
    // later, after typing that `value` hasn't seen, and would undo it.
    SideEffect {
        if (value != pushed[0]) {
            pushed[0] = value
            if (value != field.text) field = TextFieldValue(value, TextRange(value.length))
        }
    }
    OutlinedTextField(
        value = field,
        onValueChange = { next ->
            val t = transform(next.text)
            field = if (t == next.text) next else TextFieldValue(t, TextRange(t.length))
            if (t != pushed[0]) {
                pushed[0] = t
                onValueChange(t)
            }
        },
        modifier = modifier.fillMaxWidth().onFocusChanged { s ->
            if (wasFocused[0] && !s.isFocused) onCommit()
            wasFocused[0] = s.isFocused
        },
        label = label?.let { { Text(it) } },
        placeholder = placeholder?.let { { Text(it) } },
        leadingIcon = leading,
        trailingIcon = trailing,
        isError = isError,
        singleLine = singleLine,
        minLines = minLines,
        maxLines = maxLines,
        textStyle = textStyle,
        visualTransformation = visualTransformation,
        keyboardOptions = keyboard.options(if (singleLine) ImeAction.Next else ImeAction.Default),
        keyboardActions = KeyboardActions(
            onNext = { if (!focus.moveFocus(FocusDirection.Down)) focus.clearFocus() },
            onDone = { focus.clearFocus() },
        ),
    )
}

/**
 * A field that opens a picker (a sheet, a menu, a date dialog) instead of
 * taking typing. Looks like the text fields around it; reads to TalkBack as
 * one button with its value.
 */
@Composable
internal fun BdPickerField(
    text: String,
    placeholder: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    description: String? = null,
    isError: Boolean = false,
    trailingIcon: (@Composable () -> Unit)? = { Icon(Icons.Filled.ArrowDropDown, contentDescription = null) },
    onClear: (() -> Unit)? = null,
) {
    val colors = MaterialTheme.colorScheme
    val err = LocalBdFormStyle.current.resolvedError()
    val clearable = onClear != null && text.isNotEmpty()
    val strings = LocalBdFormStrings.current
    Box(modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = text,
            onValueChange = {},
            enabled = false,
            readOnly = true,
            singleLine = true,
            label = label?.let { { Text(it) } },
            placeholder = placeholder?.let { { Text(it) } },
            trailingIcon = if (clearable) ({ Spacer(Modifier.size(24.dp)) }) else trailingIcon,
            isError = isError,
            // Enabled colors on a field that only takes taps.
            colors = OutlinedTextFieldDefaults.colors(
                disabledTextColor = colors.onSurface,
                disabledBorderColor = if (isError) err else colors.outline,
                disabledLabelColor = if (isError) err else colors.onSurfaceVariant,
                disabledPlaceholderColor = colors.onSurfaceVariant,
                disabledTrailingIconColor = colors.onSurfaceVariant,
                disabledLeadingIconColor = colors.onSurfaceVariant,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        val spoken = listOfNotNull(description ?: label, text.ifEmpty { placeholder }).joinToString(", ")
        val open = onClick
        Box(
            Modifier
                .matchParentSize()
                .padding(top = if (label != null) 8.dp else 0.dp)
                .clip(OutlinedTextFieldDefaults.shape)
                .clickable(role = Role.Button, onClick = open)
                .clearAndSetSemantics {
                    contentDescription = spoken
                    role = Role.Button
                    onClick(action = { open(); true })
                },
        )
        if (clearable) {
            IconButton(
                onClick = { onClear?.invoke() },
                modifier = Modifier.align(Alignment.CenterEnd).padding(top = if (label != null) 8.dp else 0.dp, end = 4.dp),
            ) {
                Icon(Icons.Filled.Close, contentDescription = "${strings.clear} ${description ?: label ?: ""}".trim())
            }
        }
    }
}

// Options

internal data class BdOption(
    val value: String,
    val label: String,
    val image: String? = null,
    val icon: String? = null,
    val detail: String? = null,
)

/**
 * A single or multiple choice from a list: a dropdown menu for a short single
 * choice, a searchable bottom sheet for a long list, many picks, or a custom
 * answer.
 */
@Composable
internal fun BdOptionPicker(
    title: String,
    placeholder: String,
    options: List<BdOption>,
    selection: List<String>,
    onSelect: (List<String>) -> Unit,
    multi: Boolean,
    modifier: Modifier = Modifier,
    searchable: Boolean? = null,
    allowCustom: Boolean = false,
    label: String? = null,
    isError: Boolean = false,
    startAt: String? = null,
) {
    val search = (searchable ?: BdFormRules.shouldSearch(options.size, null)) || allowCustom
    // A menu taller than the screen is hard to use; past a dozen, a sheet.
    val useSheet = multi || search || options.size > MENU_MAX
    val summary = selection.joinToString(", ") { v -> options.firstOrNull { it.value == v }?.label ?: v }
    var open by remember { mutableStateOf(false) }
    var width by remember { mutableIntStateOf(0) }
    val density = LocalDensity.current

    Box(modifier.fillMaxWidth().onSizeChanged { width = it.width }) {
        BdPickerField(
            text = summary,
            placeholder = placeholder,
            label = label,
            description = title,
            isError = isError,
            onClick = { open = true },
            trailingIcon = {
                Icon(if (useSheet) Icons.Filled.KeyboardArrowRight else Icons.Filled.ArrowDropDown, contentDescription = null)
            },
        )
        if (!useSheet) {
            DropdownMenu(
                expanded = open,
                onDismissRequest = { open = false },
                modifier = if (width > 0) Modifier.width(with(density) { width.toDp() }) else Modifier,
            ) {
                DropdownMenuItem(
                    text = { Text(placeholder, color = MaterialTheme.colorScheme.onSurfaceVariant) },
                    onClick = {
                        onSelect(emptyList())
                        open = false
                    },
                )
                for (o in options) {
                    val on = o.value in selection
                    DropdownMenuItem(
                        text = { BdOptionLabel(o) },
                        onClick = {
                            onSelect(listOf(o.value))
                            open = false
                        },
                        trailingIcon = if (on) ({ Icon(Icons.Filled.Check, contentDescription = null) }) else null,
                    )
                }
            }
        }
    }
    if (useSheet && open) {
        BdOptionSheet(title, options, selection, onSelect, multi, allowCustom, search, startAt) { open = false }
    }
}

/** The most options a dropdown menu shows; more open in a sheet. */
private const val MENU_MAX = 12

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BdOptionSheet(
    title: String,
    options: List<BdOption>,
    selection: List<String>,
    onSelect: (List<String>) -> Unit,
    multi: Boolean,
    allowCustom: Boolean,
    search: Boolean,
    startAt: String?,
    onDismiss: () -> Unit,
) {
    val strings = LocalBdFormStrings.current
    var query by remember { mutableStateOf("") }
    // Open on the answer, or on [startAt], with a little of the list above it.
    val list = rememberLazyListState(
        initialFirstVisibleItemIndex = maxOf(
            0,
            options.indexOfFirst { it.value == (selection.firstOrNull() ?: startAt) } - 2,
        ),
    )
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = options.size > 8)
    val scope = rememberCoroutineScope()

    fun close() {
        scope.launch { sheet.hide() }.invokeOnCompletion { onDismiss() }
    }

    fun choose(value: String) {
        if (multi) {
            onSelect(if (value in selection) selection - value else selection + value)
        } else {
            onSelect(if (selection == listOf(value)) emptyList() else listOf(value))
            close()
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                if (selection.isNotEmpty()) TextButton(onClick = { onSelect(emptyList()) }) { Text(strings.clear) }
                TextButton(onClick = { close() }) { Text(strings.done) }
            }
            if (search) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text(strings.search) },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            val q = BdJS.trim(query)
            val filtered = if (q.isEmpty()) options else options.filter { it.label.contains(q, ignoreCase = true) || it.value.contains(q, ignoreCase = true) }
            val offerCustom = allowCustom && q.isNotEmpty() && options.none { it.label.equals(q, ignoreCase = true) }
            LazyColumn(
                Modifier.fillMaxWidth().heightIn(max = 520.dp).then(if (multi) Modifier else Modifier.selectableGroup()),
                state = list,
            ) {
                if (offerCustom) {
                    item {
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(8.dp)).clickable { choose(q) },
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Icon(Icons.Filled.Add, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Text(strings.format(strings.useCustom, q))
                        }
                    }
                }
                items(filtered) { o ->
                    BdChoiceRow(selected = o.value in selection, multi = multi, onClick = { choose(o.value) }) { BdOptionLabel(o) }
                }
                if (filtered.isEmpty() && !offerCustom) {
                    item {
                        Text(strings.noResults, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 16.dp))
                    }
                }
            }
            Spacer(Modifier.size(16.dp))
        }
    }
}

/** One selectable row: a radio button for one answer, a checkbox for many. */
@Composable
internal fun BdChoiceRow(
    selected: Boolean,
    multi: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val select = if (multi) {
        Modifier.toggleable(value = selected, role = Role.Checkbox, onValueChange = { onClick() })
    } else {
        Modifier.selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
    }
    Row(
        modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(8.dp)).then(select).padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (multi) Checkbox(checked = selected, onCheckedChange = null) else RadioButton(selected = selected, onClick = null)
        Box(Modifier.weight(1f)) { content() }
    }
}

@Composable
internal fun BdOptionLabel(option: BdOption) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        val image = BdFormRules.safeHttpUrl(option.image)
        if (image != null) {
            BdRemoteImage(image, contentDescription = null, modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)))
        } else if (!option.icon.isNullOrEmpty()) {
            BdIcon(option.icon, size = 20.dp, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Column {
            Text(option.label, style = MaterialTheme.typography.bodyLarge)
            if (!option.detail.isNullOrEmpty()) {
                Text(option.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

/** A list of choice rows read as one group. */
@Composable
internal fun BdChoiceGroup(multi: Boolean, content: @Composable () -> Unit) {
    Column(if (multi) Modifier else Modifier.selectableGroup()) { content() }
}

/** `String(value)` for display, empty for null. */
internal val BdJson?.displayText: String get() = if (this == null || isNull) "" else BdJS.string(this)
