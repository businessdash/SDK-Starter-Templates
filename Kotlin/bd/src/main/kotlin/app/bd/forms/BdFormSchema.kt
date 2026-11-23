package app.bd.forms

import java.util.UUID
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull

/** The JSON settings the forms engine decodes with. */
internal val formsJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
}

/**
 * Decode one block leniently: a malformed config on one element must not take
 * the whole form down, so it reads as absent and the element falls back to its
 * defaults.
 */
internal fun <T> lenient(element: JsonElement?, strategy: DeserializationStrategy<T>): T? {
    if (element == null || element is JsonNull) return null
    return runCatching { formsJson.decodeFromJsonElement(strategy, element) }.getOrNull()
}

/**
 * A Live form as BD publishes it: `GET /api/package/v1/forms/{slug}`.
 *
 * The full builder tree, not a flattened field list: layout containers,
 * condition blocks, either/or branches, repeaters, and each field's own
 * configuration. The renderer needs all of it to show the form the way the BD
 * builder previews it.
 */
public class BdFormSchema(
    public val id: String,
    public val slug: String,
    /** The form's name. BD publishes `name`; older payloads used `title`. */
    public val title: String? = null,
    public val description: String? = null,
    public val fields: List<BdFormField>,
    public val settings: BdFormSettings = BdFormSettings(),
    /** The org's avatar, present only when the form opts into showing it. */
    public val orgIcon: String? = null,
    public val actions: List<BdFormAction> = emptyList(),
    /**
     * Non-sensitive business functions, published so `calculation` fields
     * compute live. Sensitive ones are computed by the server on submit.
     */
    public val businessFunctions: List<BdBusinessFunction> = emptyList(),
) {
    public companion object {
        public fun fromJson(element: JsonElement): BdFormSchema {
            val o = element as? JsonObject ?: JsonObject(emptyMap())
            return BdFormSchema(
                id = o.string("id") ?: "",
                slug = o.string("slug") ?: "",
                title = o.string("name") ?: o.string("title"),
                description = o.string("description"),
                fields = (o["fields"] as? JsonArray)?.mapNotNull { (it as? JsonObject)?.let(BdFormField::fromJson) }
                    ?: emptyList(),
                settings = lenient(o["settings"], BdFormSettings.serializer()) ?: BdFormSettings(),
                orgIcon = o.string("orgIcon"),
                actions = lenient(o["actions"], ListSerializer(BdFormAction.serializer())) ?: emptyList(),
                businessFunctions = lenient(o["businessFunctions"], ListSerializer(BdBusinessFunction.serializer()))
                    ?: emptyList(),
            )
        }

        public fun fromJson(text: String): BdFormSchema = fromJson(formsJson.parseToJsonElement(text))
    }
}

@Serializable
public data class BdFormSettings(
    /** `"none" | "fade" | "slide" | "scale" | "scroll"`. */
    public val animation: String? = null,
    /** One top-level element per step, with Next/Back. */
    public val isConsecutive: Boolean? = null,
    public val showProgress: Boolean? = null,
    /** `"bar" | "steps"`. */
    public val progressStyle: String? = null,
    public val exitConfirm: ExitConfirm? = null,
    /** The org is entitled to link-safety checks on `url` fields. */
    public val urlSafety: Boolean? = null,
) {
    @Serializable
    public data class ExitConfirm(public val enabled: Boolean? = null, public val message: String? = null)
}

/** A post-submit action, previewed so a form can say "you'll get coupon X". */
@Serializable
public data class BdFormAction(public val type: String, public val coupon: Coupon? = null) {
    @Serializable
    public data class Coupon(
        public val code: String? = null,
        public val notice: String? = null,
        public val finePrint: String? = null,
    )
}

@Serializable
public data class BdBusinessFunction(
    public val id: String,
    public val slug: String,
    public val inputs: List<Input>,
    public val outputs: List<Output>,
) {
    @Serializable
    public data class Input(
        public val key: String,
        public val label: String? = null,
        /** `number | text | boolean | date | object | any` */
        public val type: String,
        public val required: Boolean? = null,
        public val default: BdJson? = null,
    )

    @Serializable
    public data class Output(
        public val key: String,
        public val label: String? = null,
        public val type: String,
        public val formula: String,
        public val fallback: BdJson? = null,
    )
}

/**
 * A visibility rule on a `condition_block`, or on an `input_group` (which
 * makes a whole page conditional in a stepped form).
 */
@Serializable
public data class BdConditionRule(
    public val fieldId: String? = null,
    /** Legacy single clause, read as the first clause. */
    public val operator: String? = null,
    public val value: String? = null,
    public val clauses: List<Clause>? = null,
    /** `"all"` (default) or `"any"`. */
    public val match: String? = null,
    /**
     * For a `collection_select` source: compare this column of the chosen
     * record (`"__label__"` = its label) instead of the stored record id.
     */
    public val matchField: String? = null,
) {
    @Serializable
    public data class Clause(public val operator: String, public val value: String? = null)
}

/**
 * One node of the form tree: an input, a static block, or a container.
 *
 * `type` stays a string. A form built tomorrow can use an element this build
 * has never heard of, and the right behaviour then is to decode it, keep its
 * value, and fall back to a plain text input, not to fail the whole form.
 */
public class BdFormField private constructor(
    /** The element as received; equality compares it. */
    public val raw: BdJson,
    o: JsonObject,
) {
    public val id: String = o.string("id") ?: UUID.randomUUID().toString()
    public val type: String = o.string("type") ?: "text"
    public val label: String = o.string("label") ?: ""
    public val required: Boolean = o.bool("required") ?: false

    /** The published output key: what the submission sends this value under. */
    public val key: String? = o.string("key")
    public val outputKey: String? = o.string("outputKey")
    public val content: String? = o.string("content")
    public val moreContent: String? = o.string("moreContent")
    public val placeholder: String? = o.string("placeholder")
    public val helpText: String? = o.string("helpText")
    public val stepTitle: String? = o.string("stepTitle")
    public val regexPattern: String? = o.string("regexPattern")
    public val options: List<String>? = (o["options"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }
    public val optionIcons: Map<String, String>? = lenient(o["optionIcons"], MapSerializer(String.serializer(), String.serializer()))
    public val defaultValue: BdJson? = o["defaultValue"]?.takeIf { it !is JsonNull }?.let { BdJson.from(it) }

    /**
     * Render variant: `"checkbox"` on a boolean, `"dropdown"` on a checkbox
     * group, `"combobox"` on a select. Never changes the value's shape.
     */
    public val display: String? = o.string("display")
    public val allowCustom: Boolean? = o.bool("allowCustom")
    public val allowDecimal: Boolean? = o.bool("allowDecimal")
    public val allowNegative: Boolean? = o.bool("allowNegative")

    /** Consent: the value must be `true` to submit. */
    public val mustBeTrue: Boolean? = o.bool("mustBeTrue")
    public val autocomplete: String? = o.string("autocomplete")
    public val concurrentReveal: Boolean? = o.bool("concurrentReveal")
    public val showGroupLabel: Boolean? = o.bool("showGroupLabel")
    public val explodeOptions: Boolean? = o.bool("explodeOptions")
    public val explodeMonthYear: Boolean? = o.bool("explodeMonthYear")
    public val referenceFieldId: String? = o.string("referenceFieldId")
    public val conditionRule: BdConditionRule? = lenient(o["conditionRule"], BdConditionRule.serializer())
    public val validation: Validation? = lenient(o["validation"], Validation.serializer())
    public val children: List<BdFormField>? =
        (o["children"] as? JsonArray)?.mapNotNull { (it as? JsonObject)?.let(::fromJson) }

    public val emailConfig: EmailConfig? = lenient(o["emailConfig"], EmailConfig.serializer())
    public val nameConfig: NameConfig? = lenient(o["nameConfig"], NameConfig.serializer())
    public val phoneConfig: PhoneConfig? = lenient(o["phoneConfig"], PhoneConfig.serializer())
    public val textareaConfig: TextareaConfig? = lenient(o["textareaConfig"], TextareaConfig.serializer())
    public val richTextConfig: RichTextConfig? = lenient(o["richTextConfig"], RichTextConfig.serializer())
    public val sliderConfig: SliderConfig? = lenient(o["sliderConfig"], SliderConfig.serializer())
    public val imageConfig: ImageConfig? = lenient(o["imageConfig"], ImageConfig.serializer())
    public val fileConfig: FileConfig? = lenient(o["fileConfig"], FileConfig.serializer())
    public val iconConfig: IconConfig? = lenient(o["iconConfig"], IconConfig.serializer())
    public val imageInputConfig: ImageInputConfig? = lenient(o["imageInputConfig"], ImageInputConfig.serializer())
    public val flexConfig: FlexConfig? = lenient(o["flexConfig"], FlexConfig.serializer())
    public val starRatingConfig: StarRatingConfig? = lenient(o["starRatingConfig"], StarRatingConfig.serializer())
    public val dateRangeConfig: DateRangeConfig? = lenient(o["dateRangeConfig"], DateRangeConfig.serializer())
    public val orConditionConfig: OrConditionConfig? = lenient(o["orConditionConfig"], OrConditionConfig.serializer())
    public val timeConfig: TimeConfig? = lenient(o["timeConfig"], TimeConfig.serializer())
    public val choiceConfig: ChoiceConfig? = lenient(o["choiceConfig"], ChoiceConfig.serializer())
    public val listConfig: ListConfig? = lenient(o["listConfig"], ListConfig.serializer())
    public val populatorConfig: PopulatorConfig? = lenient(o["populatorConfig"], PopulatorConfig.serializer())
    public val unitConfig: UnitConfig? = lenient(o["unitConfig"], UnitConfig.serializer())
    public val currencyConfig: CurrencyConfig? = lenient(o["currencyConfig"], CurrencyConfig.serializer())
    public val tableConfig: TableConfig? = lenient(o["tableConfig"], TableConfig.serializer())
    public val calculationConfig: CalculationConfig? = lenient(o["calculationConfig"], CalculationConfig.serializer())
    public val paymentConfig: PaymentConfig? = lenient(o["paymentConfig"], PaymentConfig.serializer())
    public val serviceConfig: ServiceConfig? = lenient(o["serviceConfig"], ServiceConfig.serializer())
    public val scheduleConfig: ScheduleConfig? = lenient(o["scheduleConfig"], ScheduleConfig.serializer())
    public val collectionSelectConfig: CollectionSelectConfig? =
        lenient(o["collectionSelectConfig"], CollectionSelectConfig.serializer())
    public val monthYearConfig: MonthYearConfig? = lenient(o["monthYearConfig"], MonthYearConfig.serializer())

    /** The key this value is submitted under. */
    public val submissionKey: String get() = key ?: id

    override fun equals(other: Any?): Boolean =
        this === other || (other is BdFormField && other.id == id && other.raw == raw)

    override fun hashCode(): Int = id.hashCode()

    override fun toString(): String = "BdFormField($type $id)"

    @Serializable public data class Validation(public val min: Double? = null, public val max: Double? = null)

    @Serializable public data class EmailConfig(public val businessOnly: Boolean? = null)

    @Serializable
    public data class NameConfig(
        public val prefix: Boolean? = null,
        public val middle: Boolean? = null,
        public val suffix: Boolean? = null,
        public val nicknames: Boolean? = null,
    )

    @Serializable
    public data class PhoneConfig(
        public val format: String? = null,
        public val international: Boolean? = null,
        public val showFlags: Boolean? = null,
    )

    @Serializable
    public data class TextareaConfig(public val rows: Int? = null, public val resizable: Boolean? = null)

    @Serializable public data class RichTextConfig(public val minHeight: Double? = null)

    @Serializable
    public data class SliderConfig(
        public val min: Double? = null,
        public val max: Double? = null,
        public val step: Double? = null,
        /** `"currency" | "percent"` or absent. */
        public val unit: String? = null,
    )

    @Serializable
    public data class ImageConfig(
        public val src: String? = null,
        public val alt: String? = null,
        public val width: Double? = null,
        public val height: Double? = null,
    )

    @Serializable
    public data class FileConfig(
        public val allowedTypes: List<String>? = null,
        public val maxFiles: Int? = null,
        /** Megabytes. */
        public val maxSize: Double? = null,
    )

    @Serializable
    public data class IconConfig(
        public val set: String? = null,
        public val allowedIcons: List<String>? = null,
        public val columns: Int? = null,
    )

    @Serializable
    public data class ImageInputConfig(
        public val allowedTypes: List<String>? = null,
        /** Megabytes; 5 when absent. */
        public val maxSize: Double? = null,
        public val showPreview: Boolean? = null,
        /** `"both" | "upload" | "url"`. */
        public val sources: String? = null,
    )

    @Serializable
    public data class FlexConfig(
        public val justify: String? = null,
        public val align: String? = null,
        public val gap: Double? = null,
    )

    @Serializable
    public data class StarRatingConfig(public val maxStars: Int? = null, public val defaultValue: Double? = null)

    @Serializable public data class DateRangeConfig(public val allowSameDay: Boolean? = null)

    @Serializable
    public data class OrConditionConfig(public val leftLabel: String? = null, public val rightLabel: String? = null)

    @Serializable
    public data class TimeConfig(
        /** `"simple" | "time_block" | "appointment"`. */
        public val mode: String? = null,
        /** `"12h" | "24h"`. */
        public val format: String? = null,
        public val stepMinutes: Int? = null,
    )

    @Serializable
    public data class ChoiceConfig(
        /** `"single" | "multi"`. */
        public val mode: String? = null,
        public val options: List<Option>? = null,
    ) {
        @Serializable
        public data class Option(
            public val label: String,
            public val icon: String? = null,
            public val imageUrl: String? = null,
            public val price: String? = null,
            public val description: String? = null,
            public val productId: String? = null,
            public val href: String? = null,
        )
    }

    @Serializable
    public data class ListConfig(
        /** `"bullets" | "details"`. */
        public val variant: String? = null,
        public val title: String? = null,
        public val items: List<Item>? = null,
    ) {
        @Serializable
        public data class Item(
            public val text: String,
            public val description: String? = null,
            public val icon: String? = null,
        )
    }

    @Serializable
    public data class PopulatorConfig(
        public val maxInstances: Int? = null,
        public val minInstances: Int? = null,
        public val addButtonLabel: String? = null,
        public val itemLabel: String? = null,
    )

    @Serializable
    public data class UnitConfig(
        public val category: String? = null,
        public val units: List<String>? = null,
        /** `"select" | "fixed"`. */
        public val mode: String? = null,
        public val defaultUnit: String? = null,
        public val outputUnit: String? = null,
        public val allowDecimal: Boolean? = null,
    )

    @Serializable
    public data class CurrencyConfig(
        public val currency: String? = null,
        public val symbol: String? = null,
        public val allowNegative: Boolean? = null,
        public val allowDecimal: Boolean? = null,
    )

    @Serializable
    public data class TableConfig(
        public val columns: List<Column>? = null,
        public val rows: List<Row>? = null,
        public val highlightColumn: Int? = null,
    ) {
        @Serializable
        public data class Column(
            public val header: String,
            /** `"text" | "check"`. */
            public val type: String? = null,
            /** `"left" | "center" | "right"`. */
            public val align: String? = null,
        )

        @Serializable public data class Row(public val cells: List<String>? = null)
    }

    @Serializable
    public data class CalculationConfig(
        /** `"formula" | "function"`. */
        public val mode: String? = null,
        public val formula: String? = null,
        public val functionId: String? = null,
        public val outputKey: String? = null,
        public val inputMap: List<Binding>? = null,
        public val display: Display? = null,
        /** Computed by the server only; no value until submit. */
        public val sensitive: Boolean? = null,
    ) {
        @Serializable public data class Binding(public val variable: String, public val fieldId: String)

        @Serializable
        public data class Display(
            public val show: Boolean? = null,
            public val prefix: String? = null,
            public val suffix: String? = null,
            public val decimals: Int? = null,
        )
    }

    @Serializable
    public data class PaymentConfig(
        /** `"card_on_file" | "deposit"`. */
        public val mode: String? = null,
        public val amountCents: Int? = null,
        public val currency: String? = null,
        public val buttonLabel: String? = null,
        public val description: String? = null,
    )

    @Serializable
    public data class ServiceConfig(public val options: List<Option>? = null, public val multi: Boolean? = null) {
        @Serializable
        public data class Option(
            public val id: String,
            public val title: String,
            public val estimatedHours: Double? = null,
        )
    }

    @Serializable
    public data class ScheduleConfig(
        /** `"availability"` (default) or `"auto"` (instant booking). */
        public val mode: String? = null,
        public val allowAsap: Boolean? = null,
        public val days: List<String>? = null,
        public val timeWindows: List<String>? = null,
        public val granularTimes: Boolean? = null,
        public val allowNotes: Boolean? = null,
        public val durationMinutes: Double? = null,
    )

    @Serializable
    public data class CollectionSelectConfig(
        public val collectionKey: String? = null,
        public val labelField: String? = null,
        public val imageField: String? = null,
        public val valueMode: String? = null,
        public val valueField: String? = null,
        public val multi: Boolean? = null,
    )

    @Serializable
    public data class MonthYearConfig(public val minYear: Int? = null, public val maxYear: Int? = null)

    public companion object {
        public fun fromJson(o: JsonObject): BdFormField = BdFormField(BdJson.from(o), o)

        /** Build a field in code: previews, tests, or a form defined in the app. */
        public fun make(json: BdJson): BdFormField =
            fromJson(json.toJsonElement() as? JsonObject ?: JsonObject(emptyMap()))
    }
}

/** Element type names, as BD stores them. */
public object BdFieldType {
    public val staticTypes: Set<String> = setOf(
        "title", "subtitle", "separator", "image", "richtext", "body_text", "bullet_list", "table",
    )
    public val containerTypes: Set<String> = setOf("input_group", "flex_row", "condition_block", "or_condition")

    /**
     * Never required-checked: layout, static copy, and values the visitor
     * doesn't type (a calculation, a hidden reference, a stepper's count).
     * Mirrors `STATIC_OR_LAYOUT` in the server's validator.
     */
    public val staticOrLayout: Set<String> = setOf(
        "title", "subtitle", "separator", "flex_row", "input_group", "condition_block",
        "or_condition", "image", "richtext", "body_text", "bullet_list", "table",
        "stepper", "calculation", "reference_value",
    )

    /** Carry no submitted value at all. Mirrors the server's `LAYOUT_ONLY`. */
    public val layoutOnly: Set<String> = setOf(
        "title", "subtitle", "separator", "flex_row", "input_group", "condition_block",
        "or_condition", "image", "richtext", "body_text", "bullet_list", "table", "reference_value",
    )

    /** Static/no-label elements: the field row draws no heading for them. */
    public val noLabel: Set<String> = setOf(
        "title", "subtitle", "separator", "richtext", "body_text", "bullet_list", "table",
    )
}

private fun JsonObject.string(key: String): String? =
    (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun JsonObject.bool(key: String): Boolean? =
    (this[key] as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull
