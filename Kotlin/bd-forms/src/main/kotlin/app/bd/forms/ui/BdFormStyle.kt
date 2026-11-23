package app.bd.forms.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.takeOrElse
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.bd.forms.BdFieldPath
import app.bd.forms.BdFormController
import app.bd.forms.BdFormField
import app.bd.forms.BdFormMessages
import app.bd.forms.BdFormState
import app.bd.forms.BdJson

/**
 * How a [BdForm] looks. Everything defaults to the app's Material theme
 * (typography, shapes, colors, dynamic color), so a form looks like the rest
 * of the app. Change what you want and the rest stays native.
 *
 * ```kotlin
 * BdForm(form = "contact", publishableKey = "pk_live_…", style = BdFormStyle(layout = BdFormStyle.Layout.Grouped))
 * ```
 */
@Immutable
public data class BdFormStyle(
    val layout: Layout = Layout.Plain,
    /** Tint for controls, selections and the submit button. [Color.Unspecified] = the theme's primary. */
    val tint: Color = Color.Unspecified,
    /** [Color.Unspecified] = the theme's error color. */
    val errorColor: Color = Color.Unspecified,
    val showsTitle: Boolean = true,
    val showsDescription: Boolean = true,
    /** Appended to required labels. Empty to hide. */
    val requiredMarker: String = " *",
    /** Space between questions. */
    val spacing: Dp = 24.dp,
    /** Corner radius of cards, chips and grouped rows. */
    val cornerRadius: Dp = 12.dp,
    val submitButton: ButtonProminence = ButtonProminence.Filled,
    /** Step changes, reveals and errors animate. */
    val animated: Boolean = true,
    /** Show the step progress when the form asks for it. */
    val showsProgress: Boolean = true,
    /** Padding around the form's content. */
    val contentPadding: PaddingValues = PaddingValues(16.dp),
) {
    public enum class Layout {
        /** Questions stacked on the screen's background, like a Material form. */
        Plain,

        /** Each question on its own rounded surface, like grouped settings. */
        Grouped,
    }

    public enum class ButtonProminence { Filled, Tonal, Outlined }
}

/**
 * Every word the renderer shows that isn't from the form itself. Replace any
 * to reword or localize; validation messages go through [messages].
 *
 * Templates use `String.format` placeholders (`%d`, `%s`).
 */
@Immutable
public data class BdFormStrings(
    val next: String = "Next",
    val back: String = "Back",
    val submit: String = "Submit",
    val sending: String = "Sending…",
    val successTitle: String = "Thank you",
    val successMessage: String = "Thanks — your response was received.",
    val submitAnother: String = "Submit another response",
    val errorNotice: String = "Please complete the highlighted field(s).",
    val loading: String = "Loading form…",
    val loadFailed: String = "This form couldn't be loaded.",
    val retry: String = "Try again",
    val stepOf: String = "Step %d of %d",
    val select: String = "Select…",
    val search: String = "Search",
    val noResults: String = "No matches",
    val useCustom: String = "Use “%s”",
    val done: String = "Done",
    val clear: String = "Clear",
    val cancel: String = "Cancel",
    val addAnother: String = "Add another",
    val entry: String = "Entry",
    val removeEntry: String = "Remove entry",
    val fillOneSide: String = "Fill at least one side",
    val or: String = "OR",
    val yesNo: String = "Yes / No",
    val addDate: String = "Add date",
    val addTime: String = "Add time",
    val start: String = "Start",
    val end: String = "End",
    val date: String = "Date",
    val time: String = "Time",
    val selectTime: String = "Select time",
    val month: String = "Month",
    val year: String = "Year",
    val namePrefix: String = "Title",
    val firstName: String = "First name",
    val middleName: String = "Middle name",
    val lastName: String = "Last name",
    val nameSuffix: String = "Suffix",
    val nicknames: String = "Nicknames",
    val nicknamesPlaceholder: String = "Johnny, JM — separate with commas",
    val addressLine1: String = "Address Line 1",
    val addressLine2: String = "Address Line 2",
    val city: String = "City",
    val state: String = "State",
    val selectState: String = "Select state",
    val zip: String = "Zip",
    val customColor: String = "Custom color",
    val hexColor: String = "Hex color",
    val chooseFiles: String = "Choose files",
    val choosePhotos: String = "Choose photos",
    val uploadsOnSubmit: String = "Uploads on submit",
    val upload: String = "Upload",
    val pasteURL: String = "Paste URL",
    val removeFile: String = "Remove",
    val addTag: String = "Add a tag",
    val removeTag: String = "Remove %s",
    val asap: String = "As soon as possible",
    val preferredDays: String = "Preferred days",
    val preferredTimes: String = "Preferred times",
    val schedulingNotes: String = "Anything we should know about timing?",
    val loadingTimes: String = "Loading available times…",
    val noOpenTimes: String = "No open times in the next few weeks.",
    val loadingOptions: String = "Loading options…",
    val calculatedOnSubmit: String = "Calculated on submit.",
    val cardOnFile: String = "Card on file",
    val deposit: String = "Deposit",
    val addCard: String = "Add card",
    val cardSaved: String = "Card saved",
    val searchIcons: String = "Search icons…",
    val view: String = "View",
    val hour: String = "hr",
    val hours: String = "hrs",
    val ratingOf: String = "%d of %d",
    val increase: String = "Increase",
    val decrease: String = "Decrease",
    val couponApplied: String = "Coupon %s will be applied to this submission.",
    val exitTitle: String = "Leave this form?",
    val exitMessage: String = "Your answers haven't been sent.",
    val exitLeave: String = "Leave",
    val exitStay: String = "Keep editing",
    val bold: String = "Bold",
    val italic: String = "Italic",
    val strikethrough: String = "Strikethrough",
    val bulletList: String = "Bulleted list",
    val numberedList: String = "Numbered list",
    val dayNames: Map<String, String> = mapOf(
        "mon" to "Mon", "tue" to "Tue", "wed" to "Wed", "thu" to "Thu", "fri" to "Fri", "sat" to "Sat", "sun" to "Sun",
    ),
    val timeWindowNames: Map<String, String> = mapOf(
        "morning" to "Morning", "afternoon" to "Afternoon", "evening" to "Evening",
        "morning_8_10" to "8–10 AM", "morning_10_12" to "10 AM–12 PM",
        "afternoon_12_2" to "12–2 PM", "afternoon_2_4" to "2–4 PM",
        "evening_4_6" to "4–6 PM", "evening_6_8" to "6–8 PM",
    ),
    val happinessNames: List<String> = listOf("Very unhappy", "Unhappy", "Neutral", "Happy", "Very happy"),
    /** Validation messages, by reason (`required`, `format`, `max`, …). */
    val messages: (reason: String, label: String, field: BdFormField?) -> String = BdFormMessages::message,
) {
    public fun format(template: String, vararg args: Any): String = String.format(template, *args)
}

/**
 * What a custom renderer gets: the field, its value and error, and the
 * controller to write through.
 *
 * A new context is made each time the form's state changes, so a renderer
 * that reads [value] or [error] redraws with it.
 */
public class BdFieldContext internal constructor(
    public val field: BdFormField,
    public val path: BdFieldPath,
    public val controller: BdFormController,
) {
    public val value: BdJson? get() = controller.value(path)
    public val error: String? get() = controller.error(path)

    /** The value as text, for string-valued fields. */
    public val text: String get() = value?.stringValue ?: ""

    public fun set(value: BdJson?) {
        controller.setValue(value, path)
    }

    public fun setText(text: String) {
        set(BdJson.Str(text))
    }

    /** Call when the visitor leaves the control, to show a format problem. */
    public fun commit() {
        controller.validate(path)
    }

    /** Write one key of an object-valued field (an address, a URL, a range). */
    internal fun setKey(key: String, v: BdJson) {
        val next = LinkedHashMap(value?.objectValue ?: emptyMap())
        next[key] = v
        set(BdJson.Obj(next))
    }
}

/** Draws one field. The field's label, help and error are still drawn around it. */
public typealias BdFieldRenderer = @Composable (BdFieldContext) -> Unit

/**
 * Replace how an element type, or one specific field, is drawn.
 *
 * ```kotlin
 * val renderers = BdFieldRenderers()
 *     .forType("star_rating") { ctx -> MyStars(ctx.value?.doubleValue ?: 0.0) { ctx.set(BdJson.of(it)) } }
 * BdForm(form = "feedback", publishableKey = key, renderers = renderers)
 * ```
 */
@Immutable
public class BdFieldRenderers private constructor(
    private val byType: Map<String, BdFieldRenderer>,
    private val byField: Map<String, BdFieldRenderer>,
) {
    public constructor() : this(emptyMap(), emptyMap())

    /** Draw every field of [type] with [render]. */
    public fun forType(type: String, render: BdFieldRenderer): BdFieldRenderers =
        BdFieldRenderers(byType + (type to render), byField)

    /** Draw one field, by id or output key, with [render]. */
    public fun forField(idOrKey: String, render: BdFieldRenderer): BdFieldRenderers =
        BdFieldRenderers(byType, byField + (idOrKey to render))

    internal fun renderer(field: BdFormField): BdFieldRenderer? =
        byField[field.id] ?: field.key?.let { byField[it] } ?: byType[field.type]
}

// Environment

internal val LocalBdFormStyle = staticCompositionLocalOf { BdFormStyle() }
internal val LocalBdFormStrings = staticCompositionLocalOf { BdFormStrings() }
internal val LocalBdFieldRenderers = staticCompositionLocalOf { BdFieldRenderers() }

/** Where element icons come from (`{base}/api/icons/{name}.svg`). */
public val LocalBdIconBaseUrl: androidx.compose.runtime.ProvidableCompositionLocal<String> =
    staticCompositionLocalOf { BD_DEFAULT_HOST }

internal const val BD_DEFAULT_HOST = "https://businessdash.us"

internal val LocalBdController = staticCompositionLocalOf<BdFormController> { error("No BdForm above this composable.") }

/** The form's current snapshot. Reading it subscribes a composable to every change. */
internal val LocalBdFormState = compositionLocalOf { BdFormState() }

/** Rows register here so an attempt with errors can scroll to the first one. */
@OptIn(ExperimentalFoundationApi::class)
internal val LocalBdScrollTargets = staticCompositionLocalOf<MutableMap<String, BringIntoViewRequester>> { mutableMapOf() }

/** True inside a surface (a repeater entry, an either/or box): rows don't draw their own. */
internal val LocalBdInCard = staticCompositionLocalOf { false }

/** The controller, subscribing the caller to state changes. */
@Composable
internal fun bdController(): BdFormController {
    LocalBdFormState.current
    return LocalBdController.current
}

@Composable
internal fun BdFormStyle.resolvedError(): Color = errorColor.takeOrElse { MaterialTheme.colorScheme.error }

internal fun String?.nonEmpty(): String? = this?.takeIf { it.isNotEmpty() }
