package app.bd.forms

import java.net.URI

/** A required field with no answer, found by the required-field walk. */
public data class BdMissingField(
    /** The field's id. */
    val id: String,
    val label: String,
    /** Unique per instance: the id at the top level, `repeater[2].child` inside a repeater. Errors are keyed by this. */
    val path: String,
)

/** A value problem found by the client-side validation walk. */
public data class BdInvalidField(val id: String, val label: String, val path: String, val reason: String)

/** Resolves a rule's compared value for a `collection_select` source with `matchField`. */
public typealias BdMatchResolver = (BdConditionRule, BdJson?) -> BdJson?

/**
 * BD's form rules, ported from the server validator
 * (`apps/web/src/server/forms/validate.ts`) and the shared condition module.
 *
 * The server is the authority: it re-runs all of this on submit. The point of
 * running it here first is that a visitor learns "this is required" or "that
 * isn't an email" next to the field, before a round trip, and is never told
 * something the server would then contradict. So these functions follow the
 * server line for line, including its quirks.
 */
public object BdFormRules {
    // Limits (server `validate.ts`)

    internal const val MAX_STRING_LEN = 50_000
    internal const val MAX_TEXTAREA_LEN = 200_000
    internal const val MAX_ARRAY_LEN = 500
    internal const val MAX_PHONE_LEN = 64
    internal const val MAX_DATE_LEN = 64
    internal const val MAX_ADDRESS_FIELD_LEN = 512
    internal const val MAX_NAME_PART_LEN = 128
    internal const val MAX_NAME_STRING_LEN = 1024
    internal const val MAX_NICKNAMES = 20
    internal const val MAX_FILE_FIELD_LEN = 4096
    internal const val MAX_ICON_NAME_LEN = 64
    internal const val MAX_RICH_TEXT_LEN = 20_000
    internal const val MAX_KEYS = 500
    private val nameValueKeys = setOf("prefix", "first", "middle", "last", "suffix", "nicknames", "full", "short")

    // JS `\s` / `\S`, spelled out: Java's own `\s` is ASCII-only.
    private const val WS = BdJS.WS_CLASS
    private val emailRegex = Regex("^[^$WS@]+@[^$WS@]+\\.[^$WS@]{2,}$")
    private val urlRegex = Regex(
        "^(https?://)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,}(?::[0-9]{1,5})?(?:[/?#][^$WS]*)?$",
        RegexOption.IGNORE_CASE,
    )
    private val hexColorRegex = Regex("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
    private val iconNameRegex = Regex("^[a-z0-9]+(?:-[a-z0-9]+)*$")
    private val monthYearRegex = Regex("^[0-9]{4}-(0[1-9]|1[0-2])$")
    private val usZipRegex = Regex("^[0-9]{5}(-[0-9]{4})?$")
    private val regexLiteral = Regex("/(.*)/([dgimsuvy]*)", RegexOption.DOT_MATCHES_ALL)
    private val htmlTag = Regex("<[^>]*>")

    // Author regex

    /**
     * Compile an author's pattern: a bare source or a `/source/flags` literal.
     * A broken pattern compiles to null and never blocks a submission.
     */
    public fun compileFieldRegex(raw: String): Regex? {
        val trimmed = BdJS.trim(raw)
        var source = trimmed
        var flags = ""
        regexLiteral.matchEntire(trimmed)?.let {
            source = it.groupValues[1]
            flags = it.groupValues[2]
        }
        val options = buildSet {
            if ('i' in flags) add(RegexOption.IGNORE_CASE)
            if ('m' in flags) add(RegexOption.MULTILINE)
            if ('s' in flags) add(RegexOption.DOT_MATCHES_ALL)
        }
        return runCatching { Regex(source, options) }.getOrNull() ?: runCatching { Regex(raw) }.getOrNull()
    }

    // Conditions

    public fun evalClause(value: BdJson?, op: String, target: String): Boolean = when (op) {
        "eq" -> BdJS.string(value) == target
        "neq" -> BdJS.string(value) != target
        "contains" -> BdJS.string(value).lowercase().contains(target.lowercase()) || target.isEmpty()
        "gt" -> BdJS.number(value) > BdJS.number(target)
        "lt" -> BdJS.number(value) < BdJS.number(target)
        "is_empty" -> BdJson.isBlank(value)
        "is_not_empty" -> !BdJson.isBlank(value)
        else -> true
    }

    public fun clauses(rule: BdConditionRule?): List<BdConditionRule.Clause> {
        rule?.clauses?.takeIf { it.isNotEmpty() }?.let { return it }
        rule?.operator?.let { return listOf(BdConditionRule.Clause(it, rule.value)) }
        return emptyList()
    }

    /**
     * Evaluate a rule. [resolve] returns the value the rule compares, which is
     * usually `data[rule.fieldId]` but resolves a collection record's column
     * when `matchField` is set.
     */
    public fun evalCondition(rule: BdConditionRule?, resolve: (BdConditionRule) -> BdJson?): Boolean {
        if (rule?.fieldId == null) return true
        val all = clauses(rule)
        if (all.isEmpty()) return true
        val value = resolve(rule)
        val test = { c: BdConditionRule.Clause -> evalClause(value, c.operator, c.value ?: "") }
        return if (rule.match == "any") all.any(test) else all.all(test)
    }

    public fun evalCondition(rule: BdConditionRule?, data: Map<String, BdJson>): Boolean =
        evalCondition(rule) { data[it.fieldId ?: ""] }

    /** Only a `condition_block` or an `input_group` can be hidden by a rule. */
    public fun isNodeVisible(node: BdFormField, resolve: (BdConditionRule) -> BdJson?): Boolean {
        if (node.type != "condition_block" && node.type != "input_group") return true
        return evalCondition(node.conditionRule, resolve)
    }

    /**
     * Single-page: one step holding everything. Consecutive: each visible
     * top-level node is a step, so a hidden page is skipped, not shown blank.
     */
    public fun computeSteps(
        fields: List<BdFormField>,
        consecutive: Boolean,
        resolve: (BdConditionRule) -> BdJson?,
    ): List<List<BdFormField>> {
        if (!consecutive) return listOf(fields)
        return fields.filter { isNodeVisible(it, resolve) }.map { listOf(it) }
    }

    // Emptiness (server `isEmpty`)

    public fun isEmpty(field: BdFormField, value: BdJson?): Boolean {
        fun emptyArray() = value?.arrayValue?.isEmpty() ?: true
        fun emptyString() = value?.stringValue?.isEmpty() ?: true
        return when (field.type) {
            "checkbox", "tags", "file_upload" -> emptyArray()
            "collection_select" -> if (field.collectionSelectConfig?.multi == true) emptyArray() else emptyString()
            "rich_text_input" -> {
                val s = value?.stringValue ?: return true
                BdJS.trim(s.replace(htmlTag, "")).isEmpty()
            }
            "month_year" -> emptyString()
            "choice_cards" -> if (field.choiceConfig?.mode == "multi") emptyArray() else emptyString()
            // Consent: empty unless exactly true. Otherwise any explicit
            // choice, true or false, is an answer.
            "boolean" -> if (field.mustBeTrue == true) value != BdJson.Bool(true) else value?.boolValue == null
            "schedule" -> {
                val s = value?.objectValue ?: emptyMap()
                val slot = s["slotStartAt"]?.stringValue?.isNotEmpty() ?: false
                val asap = s["asap"] == BdJson.Bool(true)
                val days = !(s["days"]?.arrayValue?.isEmpty() ?: true)
                val times = !(s["times"]?.arrayValue?.isEmpty() ?: true)
                !(slot || asap || days || times)
            }
            "multi_populator" -> {
                val arr = value?.arrayValue ?: return true
                arr.none(::instanceHasValue)
            }
            "date_range" -> isFalsy(value?.get("start")) || isFalsy(value?.get("end"))
            "address" -> isFalsy(value?.get("line1")) || isFalsy(value?.get("city")) ||
                isFalsy(value?.get("state")) || isFalsy(value?.get("zip"))
            "name" -> {
                val first = BdJS.trim(value?.get("first")?.stringValue ?: "")
                val last = BdJS.trim(value?.get("last")?.stringValue ?: "")
                first.isEmpty() || last.isEmpty()
            }
            "time_picker" -> when (field.timeConfig?.mode ?: "simple") {
                "time_block" -> isFalsy(value?.get("start")) || isFalsy(value?.get("end"))
                "appointment" -> isFalsy(value?.get("date")) || isFalsy(value?.get("time"))
                else -> BdJson.isBlank(value)
            }
            "star_rating" -> {
                val n = value?.doubleValue ?: return true
                n <= 0
            }
            // 0 is a real answer (😞 very unhappy), not a missing one.
            "happiness_rating" -> value?.doubleValue == null
            "measurement" -> value?.get("value")?.doubleValue == null
            "url" -> value?.get("url")?.stringValue?.isEmpty() ?: true
            else -> BdJson.isBlank(value)
        }
    }

    /** JS falsiness for the `!v?.x` checks in the server's rules. */
    internal fun isFalsy(v: BdJson?): Boolean = when (v) {
        null, BdJson.Null -> true
        is BdJson.Bool -> !v.value
        is BdJson.Num -> v.value == 0.0 || v.value.isNaN()
        is BdJson.Str -> v.value.isEmpty()
        else -> false
    }

    internal fun instanceHasValue(instance: BdJson): Boolean {
        val o = instance.objectValue ?: return false
        return o.values.any { v ->
            when (v) {
                BdJson.Null -> false
                is BdJson.Str -> v.value.isNotEmpty()
                is BdJson.Arr -> v.items.isNotEmpty()
                else -> true
            }
        }
    }

    // Value validation (server `validateValue`)

    private fun isWhole(n: Double): Boolean = Math.rint(n) == n

    private fun isAsciiDigit(c: Char): Boolean = c in '0'..'9'

    /**
     * Why a non-empty value doesn't conform to its field, or null when it
     * does. Reasons are the server's: `type`, `format`, `min`, `max`,
     * `options`, `regex`, `business_email`. Empty values always pass here;
     * required-ness is the required walk's job.
     */
    public fun validateValue(field: BdFormField, value: BdJson?): String? {
        if (value == null || BdJson.isBlank(value)) return null
        val opts = field.options

        when (field.type) {
            "email" -> {
                val s = value.stringValue ?: return "type"
                if (s.length > MAX_STRING_LEN) return "max"
                if (!emailRegex.matches(s)) return "format"
                if (field.emailConfig?.businessOnly == true && isConsumerEmailDomain(emailDomain(s) ?: "")) {
                    return "business_email"
                }
                return null
            }
            "url" -> {
                val o = value.objectValue ?: return "type"
                val u = o["url"]
                if (BdJson.isBlank(u)) return null
                val s = u?.stringValue ?: return "type"
                if (s.length > MAX_STRING_LEN) return "max"
                if (!urlRegex.matches(BdJS.trim(s))) return "format"
                o["verified"]?.let { v ->
                    val vs = v.stringValue
                    if (vs == null || vs !in setOf("unverified", "safe", "unsafe")) return "options"
                }
                return if (onlyBoundedPrimitives(o, MAX_STRING_LEN)) null else "type"
            }
            "phone" -> {
                val s = value.stringValue ?: return "type"
                if (s.length > MAX_PHONE_LEN) return "max"
                regexFail(field, s)?.let { return it }
                val digits = s.filter(::isAsciiDigit)
                if (field.phoneConfig?.international == true) {
                    return if (digits.length in 7..15) null else "format"
                }
                val national = if (digits.length == 11 && digits.startsWith("1")) digits.drop(1) else digits
                return if (national.length == 10) null else "format"
            }
            "number", "slider", "stepper" -> {
                val n = when {
                    value is BdJson.Num -> value.value
                    value is BdJson.Str && BdJS.trim(value.value).isNotEmpty() && !BdJS.number(value.value).isNaN() ->
                        BdJS.number(value.value)
                    else -> return "type"
                }
                if (field.type == "number" && field.allowDecimal == false && !isWhole(n)) return "format"
                if (field.type == "number" && field.allowNegative == false && n < 0) return "min"
                val min = field.validation?.min ?: field.sliderConfig?.min
                val max = field.validation?.max ?: field.sliderConfig?.max
                if (min != null && n < min) return "min"
                if (max != null && n > max) return "max"
                return null
            }
            "star_rating" -> {
                val n = value.doubleValue ?: return "type"
                val maxStars = (field.starRatingConfig?.maxStars ?: 5).toDouble()
                if (n < 0 || n > maxStars + 0.0001) return "max"
                return null
            }
            // Five faces valued 0–4 (0 = 😞 … 4 = very happy); nothing else is a face.
            "happiness_rating" -> {
                val n = value.doubleValue ?: return "type"
                if (!isWhole(n) || n < 0 || n > 4) return "options"
                return null
            }
            "boolean" -> return if (value.boolValue != null) null else "type"
            "select", "radio" -> {
                val s = value.stringValue ?: return "type"
                if (s.length > MAX_STRING_LEN) return "max"
                if (opts != null && field.allowCustom != true && s !in opts) return "options"
                return null
            }
            "collection_select" -> {
                if (field.collectionSelectConfig?.multi == true) {
                    val a = value.arrayValue ?: return "type"
                    if (a.size > MAX_ARRAY_LEN) return "max"
                    for (v in a) {
                        val s = v.stringValue ?: return "type"
                        if (s.length > MAX_STRING_LEN) return "max"
                    }
                    return null
                }
                val s = value.stringValue ?: return "type"
                return if (s.length > MAX_STRING_LEN) "max" else null
            }
            "rich_text_input" -> {
                val s = value.stringValue ?: return "type"
                return if (s.length > MAX_RICH_TEXT_LEN) "max" else null
            }
            "month_year" -> {
                val s = value.stringValue ?: return "type"
                return if (monthYearRegex.matches(s)) null else "format"
            }
            "color_picker" -> {
                val s = value.stringValue ?: return "type"
                return if (hexColorRegex.matches(s)) null else "format"
            }
            "icon_select" -> {
                val s = value.stringValue ?: return "type"
                if (s.length > MAX_ICON_NAME_LEN) return "max"
                if (!iconNameRegex.matches(s)) return "format"
                val allowed = field.iconConfig?.allowedIcons
                if (!allowed.isNullOrEmpty() && s !in allowed) return "options"
                return null
            }
            "image_input" -> {
                val s = value.stringValue ?: return "type"
                if (s.length > MAX_STRING_LEN) return "max"
                return if (urlRegex.matches(BdJS.trim(s))) null else "format"
            }
            "tags" -> {
                val a = value.arrayValue ?: return "type"
                if (a.size > MAX_ARRAY_LEN) return "max"
                for (v in a) {
                    val s = v.stringValue ?: return "type"
                    if (s.length > MAX_STRING_LEN) return "max"
                }
                return null
            }
            "checkbox" -> {
                val a = value.arrayValue ?: return "type"
                if (a.size > MAX_ARRAY_LEN) return "max"
                for (v in a) {
                    val s = v.stringValue ?: return "type"
                    if (opts != null && field.allowCustom != true && s !in opts) return "options"
                }
                return null
            }
            "service_selector" -> {
                val a = value.arrayValue ?: return "type"
                if (a.size > MAX_ARRAY_LEN) return "max"
                val offered = (field.serviceConfig?.options ?: emptyList()).map { it.id }
                for (v in a) {
                    val s = v.stringValue ?: return "type"
                    if (offered.isNotEmpty() && s !in offered) return "options"
                }
                return null
            }
            "choice_cards" -> {
                val labels = (field.choiceConfig?.options ?: emptyList()).map { it.label }
                if (field.choiceConfig?.mode == "multi") {
                    val a = value.arrayValue ?: return "type"
                    if (a.size > MAX_ARRAY_LEN) return "max"
                    for (v in a) {
                        val s = v.stringValue ?: return "type"
                        if (labels.isNotEmpty() && s !in labels) return "options"
                    }
                    return null
                }
                val s = value.stringValue ?: return "type"
                if (s.length > MAX_STRING_LEN) return "max"
                if (labels.isNotEmpty() && s !in labels) return "options"
                return null
            }
            "file_upload" -> {
                val a = value.arrayValue ?: return "type"
                val maxFiles = minOf(field.fileConfig?.maxFiles ?: MAX_ARRAY_LEN, MAX_ARRAY_LEN)
                if (a.size > maxFiles) return "max"
                for (item in a) {
                    val o = item.objectValue ?: return "type"
                    if (!onlyBoundedPrimitives(o, MAX_FILE_FIELD_LEN)) return "type"
                }
                return null
            }
            "currency" -> {
                val n = value.doubleValue?.takeIf { !it.isNaN() } ?: return "type"
                if (field.currencyConfig?.allowNegative != true && n < 0) return "format"
                if (field.currencyConfig?.allowDecimal == false && !isWhole(n)) return "format"
                return null
            }
            "measurement" -> {
                val o = value.objectValue ?: return "type"
                if (BdJson.isBlank(o["value"])) return null
                val n = o["value"]?.doubleValue?.takeIf { !it.isNaN() } ?: return "type"
                val unit = o["unit"]?.stringValue ?: return "type"
                val cat = BdUnits.category(field.unitConfig?.category)
                if (cat != null && !cat.contains(unit)) return "options"
                if (field.unitConfig?.allowDecimal == false && !isWhole(n)) return "format"
                return if (onlyBoundedPrimitives(o, MAX_DATE_LEN)) null else "type"
            }
            "multi_populator" -> {
                val a = value.arrayValue ?: return "type"
                val maxInstances = minOf(field.populatorConfig?.maxInstances ?: 10, MAX_ARRAY_LEN)
                if (a.size > maxInstances) return "max"
                val known = instanceValueFields(field.children ?: emptyList())
                for (instance in a) {
                    val o = instance.objectValue ?: return "type"
                    if (o.size > MAX_KEYS) return "max"
                    for ((key, v) in o) {
                        val child = known[key] ?: return "options"
                        validateValue(child, v)?.let { reason ->
                            return "${child.label.ifEmpty { key }}: $reason"
                        }
                    }
                }
                return null
            }
            "date_range" -> {
                val o = value.objectValue ?: return "type"
                return if (onlyBoundedPrimitives(o, MAX_DATE_LEN)) null else "type"
            }
            "time_picker" -> {
                if ((field.timeConfig?.mode ?: "simple") == "simple") {
                    val s = value.stringValue ?: return "type"
                    return if (s.length > MAX_DATE_LEN) "max" else null
                }
                val o = value.objectValue ?: return "type"
                return if (onlyBoundedPrimitives(o, MAX_DATE_LEN)) null else "type"
            }
            "address" -> {
                val o = value.objectValue ?: return "type"
                if (!onlyBoundedPrimitives(o, MAX_ADDRESS_FIELD_LEN)) return "type"
                val zip = o["zip"]?.stringValue
                if (zip != null && !isValidUSZip(zip)) return "format"
                return null
            }
            "name" -> {
                val o = value.objectValue ?: return "type"
                for ((key, v) in o) {
                    if (key !in nameValueKeys) return "options"
                    if (key == "nicknames" || v.isNull) continue
                    val s = v.stringValue ?: return "type"
                    val cap = if (key == "full" || key == "short") MAX_NAME_STRING_LEN else MAX_NAME_PART_LEN
                    if (s.length > cap) return "max"
                }
                when (val nick = o["nicknames"]) {
                    null, BdJson.Null -> {}
                    is BdJson.Str -> if (nick.value.length > MAX_NAME_STRING_LEN) return "max"
                    is BdJson.Arr -> {
                        if (nick.items.size > MAX_NICKNAMES) return "max"
                        for (item in nick.items) {
                            val s = item.stringValue ?: return "type"
                            if (s.length > MAX_NAME_PART_LEN) return "max"
                        }
                    }
                    else -> return "type"
                }
                return null
            }
            "schedule" -> {
                val s = value.objectValue ?: return "type"
                s["slotStartAt"]?.let { slot ->
                    val str = slot.stringValue ?: return "type"
                    if (str.length > MAX_DATE_LEN) return "max"
                    if (BdDates.parseInstant(str) == null) return "format"
                }
                s["asap"]?.let { if (it.boolValue == null) return "type" }
                for (key in listOf("days", "times")) {
                    val raw = s[key] ?: continue
                    val arr = raw.arrayValue ?: return "type"
                    if (arr.size > MAX_ARRAY_LEN) return "max"
                    for (item in arr) {
                        val str = item.stringValue ?: return "type"
                        if (str.length > MAX_DATE_LEN) return "max"
                    }
                }
                s["notes"]?.let { notes ->
                    val str = notes.stringValue ?: return "type"
                    if (str.length > MAX_STRING_LEN) return "max"
                }
                return null
            }
            // text / textarea / date / any plain-text input.
            else -> return when (value) {
                is BdJson.Num, is BdJson.Bool -> null
                is BdJson.Str -> {
                    val cap = if (field.type == "textarea") MAX_TEXTAREA_LEN else MAX_STRING_LEN
                    if (value.value.length > cap) "max" else regexFail(field, value.value)
                }
                else -> "type"
            }
        }
    }

    internal fun regexFail(field: BdFormField, value: String): String? {
        val pattern = field.regexPattern?.takeIf { it.isNotEmpty() } ?: return null
        val re = compileFieldRegex(pattern) ?: return null
        return if (re.containsMatchIn(value)) null else "regex"
    }

    internal fun onlyBoundedPrimitives(obj: Map<String, BdJson>, maxLen: Int): Boolean = obj.values.all { v ->
        when (v) {
            BdJson.Null, is BdJson.Num, is BdJson.Bool -> true
            is BdJson.Str -> v.value.length <= maxLen
            else -> false
        }
    }

    /** Value-bearing fields inside a repeater, keyed by id and output key. */
    internal fun instanceValueFields(children: List<BdFormField>): Map<String, BdFormField> {
        val out = LinkedHashMap<String, BdFormField>()
        fun walk(nodes: List<BdFormField>) {
            for (f in nodes) {
                if (f.type !in BdFieldType.layoutOnly) {
                    out[f.id] = f
                    f.key?.let { out[it] = f }
                }
                if (f.type != "multi_populator") f.children?.let(::walk)
            }
        }
        walk(children)
        return out
    }

    /** A US ZIP (5 digits or ZIP+4), or nothing: an address left blank has no ZIP to check. */
    public fun isValidUSZip(zip: String): Boolean = BdJS.trim(zip).let { it.isEmpty() || usZipRegex.matches(it) }

    public fun emailDomain(email: String): String? {
        val at = email.lastIndexOf('@')
        if (at < 0 || at + 1 >= email.length) return null
        return BdJS.trim(email.substring(at + 1)).lowercase()
    }

    public fun isConsumerEmailDomain(host: String): Boolean {
        val h = BdJS.trim(host).lowercase()
        if (h in FormsData.consumerEmailDomains) return true
        return h.endsWith(".gmail.com") || h.endsWith(".googlemail.com")
    }

    // Required walk (server `findMissingRequiredFields`)

    /**
     * Every required field with no answer under the current conditions:
     * hidden blocks and pages enforce nothing, an either/or needs one side,
     * a required repeater needs an entry and each filled entry its own
     * required fields, and consent must be `true`.
     */
    public fun findMissingRequired(
        fields: List<BdFormField>,
        data: Map<String, BdJson>,
        resolveMatch: BdMatchResolver? = null,
    ): List<BdMissingField> {
        val derived = withDerivedFieldValues(fields, deriveReferenceValues(fields, data))
        val missing = ArrayList<BdMissingField>()
        walkRequired(fields, derived, "", resolveMatch, missing)
        return missing
    }

    internal fun resolver(scope: Map<String, BdJson>, resolveMatch: BdMatchResolver?): (BdConditionRule) -> BdJson? = { rule ->
        val raw = scope[rule.fieldId ?: ""]
        if (rule.matchField != null && resolveMatch != null) resolveMatch(rule, raw) else raw
    }

    private fun walkRequired(
        nodes: List<BdFormField>,
        scope: Map<String, BdJson>,
        prefix: String,
        resolveMatch: BdMatchResolver?,
        missing: MutableList<BdMissingField>,
    ) {
        val resolve = resolver(scope, resolveMatch)
        for (f in nodes) {
            when (f.type) {
                "condition_block" -> {
                    if (!evalCondition(f.conditionRule, resolve)) continue
                    walkRequired(f.children ?: emptyList(), scope, prefix, resolveMatch, missing)
                }
                "or_condition" -> {
                    val children = f.children ?: emptyList()
                    val filled = children.map { subtreeHasValue(listOf(it), scope, resolveMatch) }
                    if (children.isNotEmpty() && true !in filled) {
                        missing.add(BdMissingField(f.id, f.label.ifEmpty { "Either side required" }, prefix + f.id))
                        continue
                    }
                    children.forEachIndexed { i, child ->
                        if (filled[i]) walkRequired(listOf(child), scope, prefix, resolveMatch, missing)
                    }
                }
                "input_group", "flex_row" -> {
                    if (!isNodeVisible(f, resolve)) continue
                    walkRequired(f.children ?: emptyList(), scope, prefix, resolveMatch, missing)
                }
                "multi_populator" -> {
                    val instances = scope[f.id]?.arrayValue ?: emptyList()
                    val filled = instances.withIndex().filter { it.value.objectValue != null && instanceHasValue(it.value) }
                    if (f.required && filled.isEmpty()) {
                        missing.add(BdMissingField(f.id, f.label.ifEmpty { "At least one entry required" }, prefix + f.id))
                        continue
                    }
                    for ((index, inst) in filled) {
                        walkRequired(
                            f.children ?: emptyList(),
                            inst.objectValue ?: emptyMap(),
                            "$prefix${f.id}[$index].",
                            resolveMatch,
                            missing,
                        )
                    }
                }
                else -> {
                    if (f.type in BdFieldType.staticOrLayout) continue
                    if ((f.required || f.mustBeTrue == true) && isEmpty(f, scope[f.id])) {
                        missing.add(BdMissingField(f.id, f.label.ifEmpty { "Untitled" }, prefix + f.id))
                    }
                }
            }
        }
    }

    /**
     * Does any value-bearing leaf under these nodes hold an answer? Decides
     * which side of an either/or the visitor chose.
     */
    internal fun subtreeHasValue(
        nodes: List<BdFormField>,
        data: Map<String, BdJson>,
        resolveMatch: BdMatchResolver? = null,
    ): Boolean {
        val resolve = resolver(data, resolveMatch)
        for (f in nodes) {
            when (f.type) {
                "condition_block" -> {
                    if (!evalCondition(f.conditionRule, resolve)) continue
                    if (subtreeHasValue(f.children ?: emptyList(), data, resolveMatch)) return true
                }
                "or_condition", "input_group", "flex_row" -> {
                    if (!isNodeVisible(f, resolve)) continue
                    if (subtreeHasValue(f.children ?: emptyList(), data, resolveMatch)) return true
                }
                else -> {
                    if (f.type in BdFieldType.staticOrLayout) continue
                    if (!isEmpty(f, data[f.id])) return true
                }
            }
        }
        return false
    }

    /**
     * Concurrent reveal: show children up to and including the first one
     * that still has a missing required answer.
     */
    public fun concurrentRevealCount(children: List<BdFormField>, data: Map<String, BdJson>): Int {
        children.forEachIndexed { i, child ->
            if (findMissingRequired(listOf(child), data).isNotEmpty()) return i + 1
        }
        return children.size
    }

    // Derived values

    /**
     * Hidden `reference_value` elements mirror their source once the source
     * is complete (non-empty and passing its regex), else null.
     */
    public fun deriveReferenceValues(fields: List<BdFormField>, data: Map<String, BdJson>): Map<String, BdJson> {
        val byId = fieldsById(fields)
        val out = LinkedHashMap(data)
        for (f in byId.values) {
            if (f.type != "reference_value") continue
            var derived: BdJson = BdJson.Null
            val sourceId = f.referenceFieldId
            val source = sourceId?.let { byId[it] }
            if (sourceId != null && source != null && !isEmpty(source, data[sourceId])) {
                val v = data[sourceId] ?: BdJson.Null
                var ok = true
                val pattern = source.regexPattern
                if (!pattern.isNullOrEmpty()) {
                    compileFieldRegex(pattern)?.let { re -> ok = re.containsMatchIn(BdJS.string(v)) }
                }
                if (ok) derived = v
            }
            out[f.id] = derived
        }
        return out
    }

    /**
     * One derived value per exploded checkbox option (`id::optionKey`),
     * month/year part (`id::year`), and name part (`id::first`), so a
     * condition can point at any of them.
     */
    public fun withDerivedFieldValues(fields: List<BdFormField>, data: Map<String, BdJson>): Map<String, BdJson> {
        val out = LinkedHashMap(data)
        for (field in fieldsById(fields).values) {
            val options = field.options
            if (field.type == "checkbox" && field.explodeOptions == true && !options.isNullOrEmpty()) {
                val picked = data[field.id]?.stringArray ?: emptyList()
                for ((key, option) in checkboxOptionKeys(keyBase(field), options)) {
                    out["${field.id}::$key"] = BdJson.Bool(option in picked)
                }
            }
            if (field.type == "month_year" && field.explodeMonthYear == true) {
                val parts = monthYearParts(data[field.id])
                out["${field.id}::year"] = parts?.let { BdJson.Num(it.first.toDouble()) } ?: BdJson.Null
                out["${field.id}::month"] = parts?.let { BdJson.Num(it.second.toDouble()) } ?: BdJson.Null
            }
            if (field.type == "name") {
                val cfg = field.nameConfig
                val parts = mutableListOf("first", "last", "full", "short")
                if (cfg?.prefix == true) parts.add("prefix")
                if (cfg?.middle == true) parts.add("middle")
                if (cfg?.suffix == true) parts.add("suffix")
                if (cfg?.nicknames == true) parts.add("nicknames")
                for (part in parts) {
                    out["${field.id}::$part"] = namePartValue(data[field.id], part)?.let { BdJson.Str(it) } ?: BdJson.Null
                }
            }
        }
        return out
    }

    internal fun keyBase(field: BdFormField): String = field.outputKey ?: toOutputKey(field.label)

    private val monthYearParse = Regex("([0-9]{4})-([0-9]{1,2})")

    internal fun monthYearParts(raw: BdJson?): Pair<Int, Int>? {
        val s = raw?.stringValue?.let(BdJS::trim) ?: return null
        val m = monthYearParse.matchEntire(s) ?: return null
        return m.groupValues[1].toInt() to m.groupValues[2].toInt()
    }

    internal fun namePartValue(raw: BdJson?, part: String): String? {
        val o = raw?.objectValue ?: return null
        return when (part) {
            "prefix", "first", "middle", "last", "suffix" -> o[part]?.stringValue?.takeIf { it.isNotEmpty() }
            "full" -> o["full"]?.stringValue?.takeIf { it.isNotEmpty() } ?: composeFullName(o).takeIf { it.isNotEmpty() }
            "short" -> o["short"]?.stringValue?.takeIf { it.isNotEmpty() } ?: composeShortName(o).takeIf { it.isNotEmpty() }
            "nicknames" -> o["nicknames"]?.arrayValue?.takeIf { it.isNotEmpty() }?.joinToString(", ") { BdJS.string(it) }
            else -> null
        }
    }

    public fun fieldsById(fields: List<BdFormField>): Map<String, BdFormField> {
        val out = LinkedHashMap<String, BdFormField>()
        fun walk(nodes: List<BdFormField>) {
            for (f in nodes) {
                out[f.id] = f
                f.children?.let(::walk)
            }
        }
        walk(fields)
        return out
    }

    // Output keys

    private val nonAlnum = Regex("[^a-zA-Z0-9]+")

    /** "Best time to reach:" → "bestTimeToReach". "" when the label has no usable characters. */
    public fun toOutputKey(raw: String): String {
        val words = raw.replace(nonAlnum, " ").split(' ').filter { it.isNotEmpty() }
        if (words.isEmpty()) return ""
        val key = words.mapIndexed { i, w ->
            if (i == 0) w.lowercase() else w.take(1).uppercase() + w.drop(1).lowercase()
        }.joinToString("")
        return if (key.first().let(::isAsciiDigit)) "_$key" else key
    }

    internal fun checkboxOptionKeys(fieldKey: String, options: List<String>): List<Pair<String, String>> {
        val used = HashSet<String>()
        return options.map { option ->
            val optKey = toOutputKey(option).ifEmpty { "option" }
            var key = fieldKey + optKey.take(1).uppercase() + optKey.drop(1)
            if (key in used) {
                var n = 2
                while ("$key$n" in used) n++
                key = "$key$n"
            }
            used.add(key)
            key to option
        }
    }

    // Names

    private val namePartOrder = listOf("prefix", "first", "middle", "last", "suffix")

    internal fun composeFullName(v: Map<String, BdJson>): String =
        namePartOrder.mapNotNull { v[it]?.stringValue?.let(BdJS::trim) }.filter { it.isNotEmpty() }.joinToString(" ")

    internal fun composeShortName(v: Map<String, BdJson>): String =
        listOf("first", "last").mapNotNull { v[it]?.stringValue?.let(BdJS::trim) }.filter { it.isNotEmpty() }.joinToString(" ")

    /** Trimmed parts, nicknames split into a list, `full`/`short` recomputed. */
    public fun normalizeNameValue(raw: BdJson): BdJson {
        val o = raw.objectValue ?: return raw
        val out = LinkedHashMap<String, BdJson>()
        for (key in namePartOrder) {
            val s = o[key]?.stringValue?.let(BdJS::trim)
            if (!s.isNullOrEmpty()) out[key] = BdJson.Str(s)
        }
        val nicknames = when (val n = o["nicknames"]) {
            is BdJson.Str -> n.value.split(',').map(BdJS::trim).filter { it.isNotEmpty() }
            is BdJson.Arr -> n.items.mapNotNull { it.stringValue }.map(BdJS::trim).filter { it.isNotEmpty() }
            else -> emptyList()
        }
        if (nicknames.isNotEmpty()) out["nicknames"] = BdJson.Arr(nicknames.map { BdJson.Str(it) })
        out["full"] = BdJson.Str(composeFullName(out))
        out["short"] = BdJson.Str(composeShortName(out))
        return BdJson.Obj(out)
    }

    // Seed + payload

    private val noSeedStatic = setOf(
        "title", "subtitle", "separator", "image", "richtext", "body_text", "bullet_list", "table",
        "calculation", "reference_value",
    )
    private val stepContainers = setOf("input_group", "condition_block", "or_condition")

    /** Starting values: what each element shows before the visitor touches it. */
    public fun seedInitialData(fields: List<BdFormField>): Map<String, BdJson> {
        val out = LinkedHashMap<String, BdJson>()
        fun walk(nodes: List<BdFormField>) {
            for (f in nodes) {
                if (f.type == "multi_populator") {
                    defaultValue(f)?.let { out[f.id] = it }
                    continue
                }
                if (f.type !in noSeedStatic && f.type !in stepContainers && f.type != "flex_row") {
                    defaultValue(f)?.let { out[f.id] = it }
                }
                f.children?.let(::walk)
            }
        }
        walk(fields)
        return out
    }

    private fun str(s: String): BdJson = BdJson.Str(s)

    /** A field's starting value, or null for one that starts unanswered. */
    public fun defaultValue(field: BdFormField): BdJson? = when (field.type) {
        "checkbox", "tags" -> BdJson.Arr(emptyList())
        "choice_cards" -> if (field.choiceConfig?.mode == "multi") BdJson.Arr(emptyList()) else str("")
        "collection_select" -> if (field.collectionSelectConfig?.multi == true) {
            BdJson.Arr(emptyList())
        } else {
            (field.defaultValue as? BdJson.Str) ?: str("")
        }
        "multi_populator" -> BdJson.Arr(listOf(BdJson.Obj(emptyMap())))
        "measurement" -> {
            val cat = BdUnits.category(field.unitConfig?.category) ?: BdUnits.category("length")!!
            val unit = field.unitConfig?.defaultUnit ?: cat.units.firstOrNull()?.symbol ?: ""
            BdJson.obj("value" to str(""), "unit" to str(unit), "baseUnit" to str(cat.baseUnit))
        }
        "boolean" -> BdJson.Bool(field.defaultValue == BdJson.Bool(true))
        "number", "stepper", "star_rating" -> BdJson.Num(0.0)
        // Start where the thumb is drawn (seeding 0 under a higher minimum
        // submitted a value the visitor never chose).
        "slider" -> BdJson.Num(field.sliderConfig?.min ?: 0.0)
        // 0 is a real answer (😞): an unanswered rating stays unset.
        "happiness_rating" -> null
        "date_range" -> BdJson.obj("start" to str(""), "end" to str(""))
        "time_picker" -> when (field.timeConfig?.mode ?: "simple") {
            "time_block" -> BdJson.obj("start" to str(""), "end" to str(""))
            "appointment" -> BdJson.obj("date" to str(""), "time" to str(""))
            else -> str("")
        }
        else -> (field.defaultValue as? BdJson.Str) ?: str("")
    }

    /**
     * The wire payload: values re-keyed by each field's published output key,
     * repeaters remapped per entry, names normalized. Hidden references never
     * travel (the server would reject them as unknown keys).
     */
    public fun toSubmissionPayload(fields: List<BdFormField>, data: Map<String, BdJson>): Map<String, BdJson> {
        val all = fieldsById(fields)
        fun remap(scopeFields: List<BdFormField>, scopeData: Map<String, BdJson>): Map<String, BdJson> {
            val byId = flattenValueFields(scopeFields)
            val out = LinkedHashMap<String, BdJson>()
            for ((id, input) in scopeData) {
                val known = all[id]
                if (known != null && known.type in BdFieldType.layoutOnly) continue
                val field = byId[id]
                if (field == null) {
                    out[id] = input
                    continue
                }
                var value = input
                val arr = input.arrayValue
                if (field.type == "multi_populator" && arr != null) {
                    value = BdJson.Arr(
                        arr.map { inst -> inst.objectValue?.let { BdJson.Obj(remap(field.children ?: emptyList(), it)) } ?: inst },
                    )
                }
                if (field.type == "name" && input.objectValue != null) value = normalizeNameValue(input)
                out[field.key ?: id] = value
            }
            return out
        }
        return remap(fields, data)
    }

    internal fun flattenValueFields(fields: List<BdFormField>): Map<String, BdFormField> {
        val out = LinkedHashMap<String, BdFormField>()
        fun walk(nodes: List<BdFormField>) {
            for (f in nodes) {
                if (f.type == "multi_populator") {
                    out[f.id] = f
                    continue
                }
                if (f.type !in BdFieldType.staticOrLayout || f.type == "stepper") out[f.id] = f
                f.children?.let(::walk)
            }
        }
        walk(fields)
        return out
    }

    // Formatting helpers

    /**
     * `(555) 123-4567` as the visitor types; `+44 207 946 0958` when
     * international. Same as the web renderer's.
     */
    public fun formatPhone(input: String, international: Boolean): String {
        if (international) {
            val plus = if (input.trimStart(' ').startsWith("+")) "+" else ""
            val digits = input.filter(::isAsciiDigit).take(15)
            val grouped = StringBuilder()
            digits.forEachIndexed { i, ch ->
                if (i > 0 && i % 3 == 0) grouped.append(' ')
                grouped.append(ch)
            }
            return (plus + grouped).trim()
        }
        val d = input.filter(::isAsciiDigit)
        if (d.length <= 3) return d
        if (d.length <= 6) return "(${d.substring(0, 3)}) ${d.substring(3)}"
        return "(${d.substring(0, 3)}) ${d.substring(3, 6)}-${d.substring(6, minOf(10, d.length))}"
    }

    /** A table cell in a `check` column: ✓, –, or its own text. */
    public fun tableCheckState(cell: String): String {
        val v = cell.trim().lowercase()
        if (v in setOf("yes", "y", "true", "1", "x", "✓", "✔", "check")) return "yes"
        if (v in setOf("no", "n", "false", "0", "-", "–", "—", "")) return "no"
        return "text"
    }

    /** Only http(s) links leave the form. Returns the trimmed link, or null. */
    public fun safeHttpUrl(raw: String?): String? {
        val s = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val scheme = runCatching { URI(s).scheme }.getOrNull()?.lowercase() ?: return null
        return if (scheme == "http" || scheme == "https") s else null
    }

    // Whole-tree value validation

    /**
     * Every visible, answered field whose value doesn't conform, walking the
     * tree the way the required walk does (hidden blocks and pages are
     * skipped; each repeater entry is checked field by field, so the error
     * lands on the entry's own field rather than on the repeater).
     */
    public fun findInvalidValues(
        fields: List<BdFormField>,
        data: Map<String, BdJson>,
        resolveMatch: BdMatchResolver? = null,
    ): List<BdInvalidField> {
        val derived = withDerivedFieldValues(fields, deriveReferenceValues(fields, data))
        val out = ArrayList<BdInvalidField>()
        walkValues(fields, derived, "", resolveMatch, out)
        return out
    }

    private fun walkValues(
        nodes: List<BdFormField>,
        scope: Map<String, BdJson>,
        prefix: String,
        resolveMatch: BdMatchResolver?,
        out: MutableList<BdInvalidField>,
    ) {
        val resolve = resolver(scope, resolveMatch)
        for (f in nodes) {
            when (f.type) {
                "condition_block", "input_group", "flex_row", "or_condition" -> {
                    val visible = if (f.type == "condition_block") evalCondition(f.conditionRule, resolve) else isNodeVisible(f, resolve)
                    if (!visible) continue
                    walkValues(f.children ?: emptyList(), scope, prefix, resolveMatch, out)
                }
                "multi_populator" -> {
                    val instances = scope[f.id]?.arrayValue ?: emptyList()
                    val max = minOf(f.populatorConfig?.maxInstances ?: 10, MAX_ARRAY_LEN)
                    if (instances.size > max) out.add(BdInvalidField(f.id, f.label, prefix + f.id, "max"))
                    instances.forEachIndexed { index, inst ->
                        val o = inst.objectValue ?: return@forEachIndexed
                        walkValues(f.children ?: emptyList(), o, "$prefix${f.id}[$index].", resolveMatch, out)
                    }
                }
                else -> {
                    if (f.type in BdFieldType.layoutOnly || f.type == "calculation") continue
                    val value = scope[f.id]
                    if (isPendingUpload(value)) continue
                    val reason = validateValue(f, value) ?: clientOnlyRule(f, value)
                    if (reason != null) out.add(BdInvalidField(f.id, f.label, prefix + f.id, reason))
                }
            }
        }
    }

    /** Checks the server doesn't make but a visitor should hear about: a range that ends before it starts. */
    internal fun clientOnlyRule(field: BdFormField, value: BdJson?): String? {
        val s = value?.get("start")?.stringValue
        val e = value?.get("end")?.stringValue
        if (s.isNullOrEmpty() || e.isNullOrEmpty()) return null
        return when {
            field.type == "date_range" -> when {
                e < s -> "range_order"
                e == s && field.dateRangeConfig?.allowSameDay == false -> "range_same_day"
                else -> null
            }
            field.type == "time_picker" && field.timeConfig?.mode == "time_block" -> if (e <= s) "range_order" else null
            else -> null
        }
    }

    // Uploads

    /**
     * A picked file waiting for submit. Stored in the value tree as a
     * placeholder object so required checks and file counts see it, and
     * swapped for the uploaded file (or image URL) on submit.
     */
    public fun isPendingUpload(value: BdJson?): Boolean =
        value != null && value["pending"] == BdJson.Bool(true) && value["localId"]?.stringValue != null

    private val phoneImageTypes = listOf("image/heic", "image/heif")
    private val phoneVideoTypes = listOf("video/quicktime")

    /**
     * The author's allowed types, plus the formats phone cameras produce for
     * them (HEIC photos, QuickTime video) so "images only" accepts a photo
     * straight off the camera.
     */
    public fun expandAllowedTypes(allowed: List<String>): List<String> {
        val out = allowed.toMutableList()
        fun add(t: String) {
            if (t !in out) out.add(t)
        }
        if (allowed.any { it == "image/*" || (it.startsWith("image/") && !it.contains("heic")) }) {
            phoneImageTypes.forEach(::add)
            add(".heic")
            add(".heif")
        }
        if (allowed.any { it == "video/*" || it.startsWith("video/") }) {
            phoneVideoTypes.forEach(::add)
            add(".mov")
        }
        return out
    }

    public fun isFileTypeAllowed(name: String, mimeType: String, allowed: List<String>?): Boolean {
        if (allowed.isNullOrEmpty()) return true
        val type = mimeType.lowercase()
        val dot = name.lastIndexOf('.')
        val ext = if (dot >= 0) name.substring(dot).lowercase() else ""
        for (raw in expandAllowedTypes(allowed)) {
            val a = raw.lowercase().trim()
            if (a.isEmpty()) continue
            if (a.startsWith(".")) {
                if (ext == a) return true
                continue
            }
            if (a.endsWith("/*")) {
                if (type.startsWith(a.dropLast(1))) return true
                continue
            }
            if (type.isNotEmpty() && type == a) return true
        }
        return false
    }

    /** Why a picked file is refused, or null. Same wording as the web renderer. */
    public fun fileProblem(name: String, mimeType: String, size: Long, allowed: List<String>?, maxMB: Double?): String? {
        if (!isFileTypeAllowed(name, mimeType, allowed)) return "File type not allowed: ${mimeType.ifEmpty { name }}"
        if (maxMB != null && maxMB > 0 && size.toDouble() > maxMB * 1024 * 1024) {
            return "\"$name\" exceeds the ${BdJS.string(maxMB)} MB limit."
        }
        return null
    }

    /** At most this many files across every file field in one submission. */
    public const val FORM_WIDE_MAX_FILES: Int = 5

    // Autofill

    private val autofillRules: List<Pair<Regex, String>> = listOf(
        "first[\\s_-]?name|given[\\s_-]?name" to "given-name",
        "last[\\s_-]?name|family[\\s_-]?name|surname" to "family-name",
        "full[\\s_-]?name|your[\\s_-]?name|^name$|contact[\\s_-]?name" to "name",
        "company|organi[sz]ation|business[\\s_-]?name|employer" to "organization",
        "job[\\s_-]?title|position|occupation" to "organization-title",
        "web[\\s_-]?site|homepage|\\burl\\b" to "url",
        "address[\\s_-]?line[\\s_-]?2|apartment|\\bapt\\b|\\bsuite\\b|\\bunit\\b" to "address-line2",
        "street|address[\\s_-]?line[\\s_-]?1|^address1?$|street[\\s_-]?address" to "street-address",
        "\\bcity\\b|\\btown\\b" to "address-level2",
        "\\bstate\\b|province|region" to "address-level1",
        "\\bzip\\b|postal|post[\\s_-]?code" to "postal-code",
        "\\bcountry\\b" to "country-name",
        "birth|\\bdob\\b" to "bday",
        "work[\\s_-]?phone|office[\\s_-]?phone|company[\\s_-]?phone|mobile|cell" to "tel",
    ).map { (pattern, token) -> Regex(pattern, RegexOption.IGNORE_CASE) to token }

    /**
     * The autofill token (HTML `autocomplete` vocabulary) a field should
     * advertise: the author's explicit one, else one inferred from its type,
     * key and label. The UI maps it to the platform's autofill types.
     */
    public fun autocompleteToken(field: BdFormField): String? {
        field.autocomplete?.takeIf { it.isNotEmpty() }?.let { return it }
        when (field.type) {
            "email" -> return "email"
            "phone" -> return "tel"
            "url" -> return "url"
        }
        val haystack = "${field.key ?: ""} ${field.label}"
        return autofillRules.firstOrNull { it.first.containsMatchIn(haystack) }?.second
    }

    // Search

    /** US states and DC as (name, abbreviation), for an address's state picker. */
    public val usStates: List<Pair<String, String>> get() = FormsData.usStates

    /** Past this many options a dropdown grows a search box. */
    public const val SEARCHABLE_THRESHOLD: Int = 10

    public fun shouldSearch(optionCount: Int, display: String?): Boolean =
        display == "combobox" || optionCount > SEARCHABLE_THRESHOLD
}
