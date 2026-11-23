package app.bd.forms

import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import kotlin.math.abs
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * A form value: the JSON the BD form schema and submissions are made of.
 *
 * A form answer is not one Kotlin type. A text field holds a string, a
 * checkbox group a list, an address an object, a rating a number, so values
 * travel as JSON and each element reads the shape it owns. Keeping the JSON as
 * JSON is also what lets a form gain an element the app was built without: the
 * value round-trips untouched.
 */
@Serializable(with = BdJsonSerializer::class)
public sealed class BdJson {
    public data object Null : BdJson()

    public data class Bool(public val value: Boolean) : BdJson()

    /** Compares like a JS number: `0 == -0`, and NaN equals nothing. */
    public class Num(public val value: Double) : BdJson() {
        override fun equals(other: Any?): Boolean = other is Num && other.value == value
        override fun hashCode(): Int = if (value == 0.0) 0 else value.hashCode()
        override fun toString(): String = "Num(${BdJS.string(value)})"
    }

    public data class Str(public val value: String) : BdJson()

    public data class Arr(public val items: List<BdJson>) : BdJson()

    public data class Obj(public val fields: Map<String, BdJson>) : BdJson()

    public val stringValue: String? get() = (this as? Str)?.value
    public val doubleValue: Double? get() = (this as? Num)?.value
    public val boolValue: Boolean? get() = (this as? Bool)?.value
    public val arrayValue: List<BdJson>? get() = (this as? Arr)?.items
    public val objectValue: Map<String, BdJson>? get() = (this as? Obj)?.fields
    public val isNull: Boolean get() = this is Null

    /** Strings of a list value, skipping anything that isn't a string. */
    public val stringArray: List<String> get() = arrayValue?.mapNotNull { it.stringValue } ?: emptyList()

    public operator fun get(key: String): BdJson? = objectValue?.get(key)

    /** Plain JSON for kotlinx.serialization; whole numbers go out as integers. */
    public fun toJsonElement(): JsonElement = when (this) {
        Null -> JsonNull
        is Bool -> JsonPrimitive(value)
        is Num ->
            if (!value.isFinite()) JsonNull
            else if (value == Math.rint(value) && abs(value) < 9.007199254740992e15) JsonPrimitive(value.toLong())
            else JsonPrimitive(value)
        is Str -> JsonPrimitive(value)
        is Arr -> JsonArray(items.map { it.toJsonElement() })
        is Obj -> JsonObject(fields.mapValues { it.value.toJsonElement() })
    }

    /** `JSON.stringify`, optionally with sorted keys. */
    public fun toJsonString(sortKeys: Boolean = false): String {
        val out = StringBuilder()
        writeJson(this, out, sortKeys)
        return out.toString()
    }

    public companion object {
        public fun of(value: String): BdJson = Str(value)
        public fun of(value: Double): BdJson = Num(value)
        public fun of(value: Int): BdJson = Num(value.toDouble())
        public fun of(value: Boolean): BdJson = Bool(value)
        public fun list(vararg items: BdJson): BdJson = Arr(items.toList())
        public fun obj(vararg pairs: Pair<String, BdJson>): BdJson = Obj(linkedMapOf(*pairs))

        /** JS's "no answer": absent, `null` and `""`. An empty list is not blank. */
        public fun isBlank(value: BdJson?): Boolean = when (value) {
            null, Null -> true
            is Str -> value.value.isEmpty()
            else -> false
        }

        public fun from(element: JsonElement): BdJson = when (element) {
            JsonNull -> Null
            is JsonPrimitive -> when {
                element.isString -> Str(element.content)
                element.content == "true" -> Bool(true)
                element.content == "false" -> Bool(false)
                else -> Num(element.content.toDoubleOrNull() ?: Double.NaN)
            }
            is JsonArray -> Arr(element.map { from(it) })
            is JsonObject -> Obj(element.entries.associateTo(LinkedHashMap()) { (k, v) -> k to from(v) })
        }

        private fun writeJson(value: BdJson, out: StringBuilder, sortKeys: Boolean) {
            when (value) {
                Null -> out.append("null")
                is Bool -> out.append(value.value)
                is Num -> out.append(if (value.value.isFinite()) BdJS.string(value.value) else "null")
                is Str -> writeString(value.value, out)
                is Arr -> {
                    out.append('[')
                    value.items.forEachIndexed { i, item ->
                        if (i > 0) out.append(',')
                        writeJson(item, out, sortKeys)
                    }
                    out.append(']')
                }
                is Obj -> {
                    out.append('{')
                    val keys = if (sortKeys) value.fields.keys.sorted() else value.fields.keys.toList()
                    keys.forEachIndexed { i, key ->
                        if (i > 0) out.append(',')
                        writeString(key, out)
                        out.append(':')
                        writeJson(value.fields.getValue(key), out, sortKeys)
                    }
                    out.append('}')
                }
            }
        }

        private fun writeString(s: String, out: StringBuilder) {
            out.append('"')
            for (c in s) {
                when (c) {
                    '"' -> out.append("\\\"")
                    '\\' -> out.append("\\\\")
                    '\b' -> out.append("\\b")
                    '\u000C' -> out.append("\\f")
                    '\n' -> out.append("\\n")
                    '\r' -> out.append("\\r")
                    '\t' -> out.append("\\t")
                    else -> if (c < ' ') out.append("\\u%04x".format(c.code)) else out.append(c)
                }
            }
            out.append('"')
        }
    }
}

/** Reads and writes [BdJson] through kotlinx.serialization's JSON tree. */
public object BdJsonSerializer : KSerializer<BdJson> {
    override val descriptor: SerialDescriptor = JsonElement.serializer().descriptor

    override fun deserialize(decoder: Decoder): BdJson =
        BdJson.from((decoder as JsonDecoder).decodeJsonElement())

    override fun serialize(encoder: Encoder, value: BdJson) {
        (encoder as JsonEncoder).encodeJsonElement(value.toJsonElement())
    }
}

/**
 * The handful of JavaScript coercions the BD form rules are written in terms
 * of. Conditions compare `String(value)`, numeric operators use `Number(x)`, a
 * calculation's display uses `toFixed`. Matching the server means matching
 * these exactly, including their odd corners (`String([1,2])` is `"1,2"`,
 * `Number("")` is `0`).
 */
public object BdJS {
    /** `String(value)` for a JSON value, the way the condition engine sees it. */
    public fun string(value: BdJson?): String = when (value) {
        null, BdJson.Null -> ""
        is BdJson.Bool -> if (value.value) "true" else "false"
        is BdJson.Num -> string(value.value)
        is BdJson.Str -> value.value
        // Array.prototype.join: null becomes "", objects "[object Object]".
        is BdJson.Arr -> value.items.joinToString(",") { if (it.isNull) "" else string(it) }
        is BdJson.Obj -> "[object Object]"
    }

    /** `Number(value)` for a JSON value. */
    public fun number(value: BdJson?): Double = when (value) {
        null -> Double.NaN
        BdJson.Null -> 0.0
        is BdJson.Bool -> if (value.value) 1.0 else 0.0
        is BdJson.Num -> value.value
        is BdJson.Str -> number(value.value)
        // ToPrimitive → join → Number: [] is 0, [x] is Number(x).
        is BdJson.Arr -> number(string(value))
        is BdJson.Obj -> Double.NaN
    }

    private val decimalLiteral =
        Regex("[+-]?(?:[0-9]+\\.?[0-9]*(?:[eE][+-]?[0-9]+)?|\\.[0-9]+(?:[eE][+-]?[0-9]+)?)")

    /** `Number(string)`: hex/binary/octal literals, `Infinity`, whitespace, `""` → 0. */
    public fun number(raw: String): Double {
        val s = trim(raw)
        if (s.isEmpty()) return 0.0
        when (s) {
            "Infinity", "+Infinity" -> return Double.POSITIVE_INFINITY
            "-Infinity" -> return Double.NEGATIVE_INFINITY
        }
        val lower = s.lowercase()
        for ((prefix, radix) in listOf("0x" to 16, "0b" to 2, "0o" to 8)) {
            if (!lower.startsWith(prefix)) continue
            val digits = s.substring(2)
            if (digits.isEmpty()) return Double.NaN
            var value = 0.0
            for (ch in digits) {
                val d = when (ch) {
                    in '0'..'9' -> ch - '0'
                    in 'a'..'f' -> ch - 'a' + 10
                    in 'A'..'F' -> ch - 'A' + 10
                    else -> return Double.NaN
                }
                if (d >= radix) return Double.NaN
                value = value * radix + d
            }
            return value
        }
        if (!decimalLiteral.matches(s)) return Double.NaN
        return s.toDoubleOrNull() ?: Double.NaN
    }

    /**
     * Number::toString(10): the shortest digits that round-trip, laid out
     * with JS's thresholds for exponent form (1e21 and 1e-7). Computed with
     * BigDecimal rather than `Double.toString`, which isn't shortest on every
     * JVM (and isn't the same code on Android).
     */
    public fun string(n: Double): String {
        if (n.isNaN()) return "NaN"
        if (n.isInfinite()) return if (n > 0) "Infinity" else "-Infinity"
        if (n == 0.0) return "0"
        if (n < 0) return "-" + string(-n)
        val (digits, point) = shortestDigits(n)
        val k = digits.length
        if (k <= point && point <= 21) return digits + "0".repeat(point - k)
        if (point in 1..21) return digits.substring(0, point) + "." + digits.substring(point)
        if (point in -5..0) return "0." + "0".repeat(-point) + digits
        val e = point - 1
        val sign = if (e < 0) "-" else "+"
        val mantissa = if (k == 1) digits else digits.substring(0, 1) + "." + digits.substring(1)
        return "${mantissa}e$sign${abs(e)}"
    }

    /** Digits and decimal point such that n = 0.d1d2…dk × 10^point. */
    private fun shortestDigits(n: Double): Pair<String, Int> {
        val exact = BigDecimal(n)
        for (precision in 1..17) {
            // The closest candidate, or failing that the other neighbour:
            // next to a power of two the round-trip interval is lopsided.
            val candidates = listOf(RoundingMode.HALF_EVEN, RoundingMode.FLOOR, RoundingMode.CEILING)
                .map { exact.round(MathContext(precision, it)) }
                .filter { it.toDouble() == n }
            val best = candidates.minByOrNull { it.subtract(exact).abs() } ?: continue
            val unscaled = best.unscaledValue().abs().toString()
            val point = unscaled.length - best.scale()
            return (unscaled.trimEnd('0').ifEmpty { "0" }) to point
        }
        val r = exact.round(MathContext(17, RoundingMode.HALF_EVEN))
        val unscaled = r.unscaledValue().abs().toString()
        return unscaled.trimEnd('0').ifEmpty { "0" } to unscaled.length - r.scale()
    }

    /**
     * Number.prototype.toFixed: the exact binary value, ties away from zero,
     * and String(x) at or above 1e21.
     */
    public fun toFixed(n: Double, decimals: Int): String {
        val places = decimals.coerceIn(0, 100)
        if (n.isNaN()) return "NaN"
        if (n.isInfinite() || abs(n) >= 1e21) return string(n)
        // `-0.0001` keeps its sign ("-0.00"); negative zero does not.
        val sign = if (n < 0) "-" else ""
        return sign + BigDecimal(abs(n)).setScale(places, RoundingMode.HALF_UP).toPlainString()
    }

    /** JS `String.prototype.trim` whitespace: WhiteSpace and LineTerminator. */
    public fun isWhitespace(c: Char): Boolean =
        c == '\t' || c == '\n' || c == '\u000B' || c == '\u000C' || c == '\r' || c == ' ' ||
            c == ' ' || c == '﻿' || c == ' ' || c == ' ' ||
            Character.getType(c) == Character.SPACE_SEPARATOR.toInt()

    public fun trim(s: String): String = s.trim(::isWhitespace)

    /** The same set as a regex class body, for patterns written with JS's `\s`. */
    internal const val WS_CLASS: String = "\\t\\n\\u000B\\f\\r \\u00A0\\uFEFF\\u2028\\u2029\\p{Zs}"
}
