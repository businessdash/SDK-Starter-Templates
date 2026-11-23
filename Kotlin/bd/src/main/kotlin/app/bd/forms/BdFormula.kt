package app.bd.forms

import java.text.Normalizer
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.log10
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.truncate

/**
 * BD's formula language, as used by `calculation` fields and business
 * functions: a port of forms-core's `formula.ts`.
 *
 * Values are numbers, strings, booleans and objects (`addr.city`). Errors are
 * values too: a formula that divides by zero produces a result with an error
 * message, never a crash, and the message text matches the TS engine so the
 * same formula reports the same problem everywhere.
 */
public object BdFormula {
    public sealed class Result {
        public data class Ok(public val result: BdJson) : Result()
        public data class Error(public val message: String) : Result()

        public val value: BdJson? get() = (this as? Ok)?.result
        public val errorMessage: String? get() = (this as? Error)?.message
    }

    /** A business function callable from a formula by its upper-cased slug. */
    public class UserFunction internal constructor(internal val params: List<String>, internal val ast: Node)

    public class Parsed internal constructor(internal val ast: Node)

    /** A formula problem; the message is what the visitor or author sees. */
    internal class Failure(message: String) : Exception(message) {
        // Thrown for ordinary bad input on every keystroke: skip the trace.
        override fun fillInStackTrace(): Throwable = this
    }

    internal sealed class Node {
        data class Num(val v: Double) : Node()
        data class Str(val v: String) : Node()
        data class Bool(val v: Boolean) : Node()
        data class Variable(val name: String) : Node()
        data class Member(val obj: Node, val key: String) : Node()
        data class Unary(val op: String, val arg: Node) : Node()
        data class Binary(val op: String, val l: Node, val r: Node) : Node()
        data class Call(val name: String, val args: List<Node>) : Node()
    }

    // Public API

    /** Parse once, evaluate many times. Throws with the TS engine's message. */
    public fun parse(src: String): Parsed = Parsed(Parser(tokenize(src)).parse())

    public fun evaluate(
        parsed: Parsed,
        vars: Map<String, BdJson?>,
        functions: Map<String, UserFunction> = emptyMap(),
    ): Result = try {
        Result.Ok(eval(parsed.ast, Ctx(vars, functions, emptySet())))
    } catch (f: Failure) {
        Result.Error(f.message ?: "Formula error.")
    } catch (_: Exception) {
        Result.Error("Formula error.")
    } catch (_: StackOverflowError) {
        Result.Error("Formula error.")
    }

    public fun run(
        src: String,
        vars: Map<String, BdJson?>,
        functions: Map<String, UserFunction> = emptyMap(),
    ): Result {
        val parsed = try {
            parse(src)
        } catch (f: Failure) {
            return Result.Error(f.message ?: "Invalid formula.")
        } catch (_: Exception) {
            return Result.Error("Invalid formula.")
        } catch (_: StackOverflowError) {
            return Result.Error("Invalid formula.")
        }
        return evaluate(parsed, vars, functions)
    }

    /**
     * Business functions as formula functions, keyed by upper-cased slug.
     * Each one evaluates its first output. A function whose formula doesn't
     * parse is left out rather than failing the form.
     */
    public fun userFunctions(defs: Map<String, BdBusinessFunction>): Map<String, UserFunction> {
        val out = LinkedHashMap<String, UserFunction>()
        for ((name, def) in defs) {
            val first = def.outputs.firstOrNull() ?: continue
            val parsed = runCatching { parse(first.formula) }.getOrNull() ?: continue
            out[name] = UserFunction(def.inputs.map { it.key }, parsed.ast)
        }
        return out
    }

    // Tokenizer

    internal sealed class Tok(val kind: String) {
        data class Num(val v: Double) : Tok("num")
        data class Str(val v: String) : Tok("str")
        data class Ident(val v: String) : Tok("ident")
        data class Op(val v: String) : Tok("op")
        data object LParen : Tok("lparen")
        data object RParen : Tok("rparen")
        data object Comma : Tok("comma")
        data object Dot : Tok("dot")
    }

    private val multiOps = setOf("<=", ">=", "<>", "==", "!=", "&&", "||")
    private val singleOps = setOf('+', '-', '*', '/', '%', '^', '&', '<', '>', '=', '!')

    private fun isDigit(c: Char?): Boolean = c != null && c in '0'..'9'
    private fun isIdentStart(c: Char): Boolean = c in 'a'..'z' || c in 'A'..'Z' || c == '_'
    private fun isIdentPart(c: Char): Boolean = isIdentStart(c) || c in '0'..'9'

    internal fun tokenize(src: String): List<Tok> {
        val toks = ArrayList<Tok>()
        var i = 0
        val n = src.length
        while (i < n) {
            val c = src[i]
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                i++
                continue
            }
            if (c == '"') {
                val str = StringBuilder()
                i++
                while (i < n && src[i] != '"') {
                    if (src[i] == '\\' && i + 1 < n) {
                        str.append(src[i + 1])
                        i += 2
                    } else {
                        str.append(src[i])
                        i++
                    }
                }
                if (i >= n) throw Failure("Unterminated string literal.")
                i++
                toks.add(Tok.Str(str.toString()))
                continue
            }
            if (isDigit(c) || (c == '.' && isDigit(src.getOrNull(i + 1)))) {
                var j = i
                while (j < n && (isDigit(src[j]) || src[j] == '.')) j++
                if (j < n && (src[j] == 'e' || src[j] == 'E') && j + 1 < n) {
                    j++
                    if (src[j] == '+' || src[j] == '-') j++
                    while (j < n && isDigit(src[j])) j++
                }
                val raw = src.substring(i, j)
                val value = BdJS.number(raw)
                if (value.isNaN()) throw Failure("Invalid number \"$raw\".")
                toks.add(Tok.Num(value))
                i = j
                continue
            }
            if (isIdentStart(c)) {
                var j = i
                while (j < n && isIdentPart(src[j])) j++
                toks.add(Tok.Ident(src.substring(i, j)))
                i = j
                continue
            }
            when (c) {
                '(' -> { toks.add(Tok.LParen); i++; continue }
                ')' -> { toks.add(Tok.RParen); i++; continue }
                ',' -> { toks.add(Tok.Comma); i++; continue }
                '.' -> { toks.add(Tok.Dot); i++; continue }
            }
            if (i + 1 < n && src.substring(i, i + 2) in multiOps) {
                toks.add(Tok.Op(src.substring(i, i + 2)))
                i += 2
                continue
            }
            if (c in singleOps) {
                toks.add(Tok.Op(c.toString()))
                i++
                continue
            }
            throw Failure("Unexpected character \"$c\".")
        }
        return toks
    }

    // Parser

    private class Parser(val tokens: List<Tok>) {
        var pos = 0

        fun peek(): Tok? = tokens.getOrNull(pos)

        fun next(): Tok? = peek().also { pos++ }

        fun eat(kind: String): Tok {
            val t = next()
            if (t == null || t.kind != kind) throw Failure("Expected $kind.")
            return t
        }

        fun isOp(v: String): Boolean = peek() == Tok.Op(v)

        fun isIdent(v: String): Boolean = (peek() as? Tok.Ident)?.v?.uppercase() == v

        fun parse(): Node {
            val node = parseOr()
            if (pos < tokens.size) throw Failure("Unexpected trailing input.")
            return node
        }

        fun parseOr(): Node {
            var left = parseAnd()
            while (isOp("||") || isIdent("OR")) {
                next()
                left = Node.Binary("OR", left, parseAnd())
            }
            return left
        }

        fun parseAnd(): Node {
            var left = parseNot()
            while (isOp("&&") || isIdent("AND")) {
                next()
                left = Node.Binary("AND", left, parseNot())
            }
            return left
        }

        fun parseNot(): Node {
            if (isOp("!") || isIdent("NOT")) {
                next()
                return Node.Unary("NOT", parseNot())
            }
            return parseComparison()
        }

        fun parseComparison(): Node {
            var left = parseConcat()
            while (true) {
                val op = (peek() as? Tok.Op)?.v ?: break
                if (op !in comparisonOps) break
                next()
                left = Node.Binary(op, left, parseConcat())
            }
            return left
        }

        fun parseConcat(): Node {
            var left = parseAdd()
            while (isOp("&")) {
                next()
                left = Node.Binary("&", left, parseAdd())
            }
            return left
        }

        fun parseAdd(): Node {
            var left = parseMul()
            while (isOp("+") || isOp("-")) {
                val op = (next() as Tok.Op).v
                left = Node.Binary(op, left, parseMul())
            }
            return left
        }

        fun parseMul(): Node {
            var left = parseUnary()
            while (isOp("*") || isOp("/") || isOp("%")) {
                val op = (next() as Tok.Op).v
                left = Node.Binary(op, left, parseUnary())
            }
            return left
        }

        fun parseUnary(): Node {
            if (isOp("-") || isOp("+")) {
                val op = (next() as Tok.Op).v
                return Node.Unary(op, parseUnary())
            }
            return parsePower()
        }

        fun parsePower(): Node {
            val base = parsePrimary()
            if (isOp("^")) {
                next()
                return Node.Binary("^", base, parseUnary())
            }
            return base
        }

        fun parsePrimary(): Node {
            var node = parseAtom()
            while (peek() == Tok.Dot) {
                next()
                val key = (eat("ident") as Tok.Ident).v
                node = Node.Member(node, key)
            }
            return node
        }

        fun parseAtom(): Node {
            val t = peek() ?: throw Failure("Unexpected end of formula.")
            return when (t) {
                is Tok.Num -> { next(); Node.Num(t.v) }
                is Tok.Str -> { next(); Node.Str(t.v) }
                Tok.LParen -> {
                    next()
                    val inner = parseOr()
                    eat("rparen")
                    inner
                }
                is Tok.Ident -> {
                    next()
                    val upper = t.v.uppercase()
                    when {
                        upper == "TRUE" -> Node.Bool(true)
                        upper == "FALSE" -> Node.Bool(false)
                        peek() == Tok.LParen -> {
                            next()
                            val args = ArrayList<Node>()
                            if (peek() != Tok.RParen) {
                                args.add(parseOr())
                                while (peek() == Tok.Comma) {
                                    next()
                                    args.add(parseOr())
                                }
                            }
                            eat("rparen")
                            Node.Call(upper, args)
                        }
                        else -> Node.Variable(t.v)
                    }
                }
                else -> throw Failure("Unexpected token.")
            }
        }

        companion object {
            val comparisonOps = setOf("=", "==", "<>", "!=", "<", ">", "<=", ">=")
        }
    }

    // Coercion

    internal fun toNum(v: BdJson): Double = when (v) {
        is BdJson.Num -> v.value
        is BdJson.Bool -> if (v.value) 1.0 else 0.0
        is BdJson.Obj, is BdJson.Arr -> throw Failure("Cannot use an object as a number.")
        BdJson.Null -> 0.0
        is BdJson.Str -> {
            val n = BdJS.number(v.value)
            if (n.isNaN()) throw Failure("\"${v.value}\" is not a number.")
            n
        }
    }

    internal fun toBool(v: BdJson): Boolean = when (v) {
        is BdJson.Bool -> v.value
        is BdJson.Num -> v.value != 0.0
        is BdJson.Obj, is BdJson.Arr -> throw Failure("Cannot use an object as a boolean.")
        BdJson.Null -> false
        is BdJson.Str -> v.value.isNotEmpty() && v.value.lowercase() != "false"
    }

    internal fun toStr(v: BdJson): String = when (v) {
        is BdJson.Str -> v.value
        is BdJson.Obj, is BdJson.Arr -> throw Failure("Cannot use an object as text.")
        else -> BdJS.string(v)
    }

    /** `Math.round`: halves round toward +∞. */
    internal fun jsRound(x: Double): Double {
        if (!x.isFinite()) return x
        val f = floor(x)
        return if (x - f >= 0.5) f + 1 else f
    }

    /** `**`: like `pow`, except `1 ** NaN` and `(±1) ** ±∞` are NaN. */
    internal fun jsPow(base: Double, exp: Double): Double {
        if (exp.isNaN()) return Double.NaN
        if (abs(base) == 1.0 && exp.isInfinite()) return Double.NaN
        return Math.pow(base, exp)
    }

    /** `String.prototype.slice` over UTF-16 units (a Kotlin String's own units). */
    internal fun jsSlice(s: String, start: Double, end: Double? = null): String {
        val len = s.length.toDouble()
        fun clamp(v: Double): Int {
            if (v.isNaN()) return 0
            val t = truncate(v)
            val r = if (v < 0) (if (t == 0.0) 0.0 else maxOf(len + t, 0.0)) else min(t, len)
            return r.toInt()
        }
        val from = clamp(start)
        val to = end?.let(::clamp) ?: s.length
        return if (from < to) s.substring(from, to) else ""
    }

    private fun parseDate(v: BdJson): Long = BdDates.parse(v) ?: throw Failure("Invalid date.")

    private fun monthsBetween(s: Long, e: Long): Double {
        val a = BdDates.utcParts(s)
        val b = BdDates.utcParts(e)
        var m = (b.year - a.year) * 12 + (b.month - a.month)
        if (b.day < a.day) m -= 1
        return m.toDouble()
    }

    private fun yearsBetween(s: Long, e: Long): Double {
        val a = BdDates.utcParts(s)
        val b = BdDates.utcParts(e)
        var y = b.year - a.year
        // Feb 29 in a common year rolls to Mar 1, as `Date.UTC` does.
        if (e < BdDates.utcMillis(b.year, a.month, a.day)) y -= 1
        return y.toDouble()
    }

    private val fileTypeByExt: Map<String, String> = buildMap {
        val table = listOf(
            "image" to listOf("png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "heic"),
            "video" to listOf("mp4", "mov", "webm", "mkv", "avi"),
            "audio" to listOf("mp3", "wav", "m4a", "flac", "ogg", "aac"),
            "pdf" to listOf("pdf"),
            "doc" to listOf("doc", "docx", "txt", "rtf", "md", "pages"),
            "spreadsheet" to listOf("xls", "xlsx", "csv", "numbers"),
            "archive" to listOf("zip", "rar", "7z", "tar", "gz"),
        )
        for ((type, exts) in table) for (e in exts) put(e, type)
    }

    internal fun fileType(url: String): String {
        val path = BdJS.trim(url.split('?', '#').first())
        val dot = path.lastIndexOf('.')
        if (dot < 0) return "other"
        return fileTypeByExt[path.substring(dot + 1).lowercase()] ?: "other"
    }

    /** One left-to-right pass, longest find first, so a replacement is never itself re-matched. */
    internal fun substituteAll(text: String, pairs: List<Pair<String, String>>): String {
        val active = pairs.filter { it.first.isNotEmpty() }
        if (active.isEmpty()) return text
        val ordered = active.withIndex()
            .sortedWith(compareByDescending<IndexedValue<Pair<String, String>>> { it.value.first.length }.thenBy { it.index })
            .map { it.value }
        val out = StringBuilder()
        var i = 0
        outer@ while (i < text.length) {
            for ((find, replace) in ordered) {
                if (text.startsWith(find, i)) {
                    out.append(replace)
                    i += find.length
                    continue@outer
                }
            }
            out.append(text[i])
            i++
        }
        return out.toString()
    }

    private val combiningMarks = Regex("[\\u0300-\\u036f]")
    private val nonSlug = Regex("[^a-z0-9]+")
    private val edgeDashes = Regex("^-+|-+$")

    internal fun slugify(text: String): String =
        Normalizer.normalize(text, Normalizer.Form.NFKD)
            .replace(combiningMarks, "")
            .lowercase()
            .replace(nonSlug, "-")
            .replace(edgeDashes, "")

    private fun haversine(lat1: Double, lng1: Double, lat2: Double, lng2: Double, miles: Boolean): Double {
        fun rad(d: Double) = d * Math.PI / 180
        val dLat = rad(lat2 - lat1)
        val dLng = rad(lng2 - lng1)
        val a = Math.pow(sin(dLat / 2), 2.0) + cos(rad(lat1)) * cos(rad(lat2)) * Math.pow(sin(dLng / 2), 2.0)
        val km = 2 * 6371 * asin(min(1.0, sqrt(a)))
        return if (miles) km * 0.621371 else km
    }

    // Functions

    private class FnDef(val min: Int, val max: Int?, val fn: (List<BdJson>) -> BdJson)

    private fun nums(a: List<BdJson>): List<Double> = a.map(::toNum)

    private fun jsMin(xs: List<Double>): Double = if (xs.any { it.isNaN() }) Double.NaN else xs.minOrNull() ?: Double.POSITIVE_INFINITY
    private fun jsMax(xs: List<Double>): Double = if (xs.any { it.isNaN() }) Double.NaN else xs.maxOrNull() ?: Double.NEGATIVE_INFINITY

    private fun num(x: Double): BdJson = BdJson.Num(x)

    private fun strictEq(a: BdJson, b: BdJson): Boolean = a == b

    private fun roundTo(a: List<BdJson>, digitsDefault: Double, index: Int, op: (Double) -> Double): BdJson {
        val f = jsPow(10.0, if (a.size > index) toNum(a[index]) else digitsDefault)
        return num(op(toNum(a[0]) * f) / f)
    }

    private val functions: Map<String, FnDef> = mapOf(
        "SUM" to FnDef(1, null) { a -> num(nums(a).fold(0.0, Double::plus)) },
        "PRODUCT" to FnDef(1, null) { a -> num(nums(a).fold(1.0, Double::times)) },
        "ABS" to FnDef(1, 1) { a -> num(abs(toNum(a[0]))) },
        "ROUND" to FnDef(1, 2) { a -> roundTo(a, 0.0, 1, ::jsRound) },
        "ROUNDUP" to FnDef(1, 2) { a -> roundTo(a, 0.0, 1, ::ceil) },
        "ROUNDDOWN" to FnDef(1, 2) { a -> roundTo(a, 0.0, 1, ::truncate) },
        "CEILING" to FnDef(1, 1) { a -> num(ceil(toNum(a[0]))) },
        "FLOOR" to FnDef(1, 1) { a -> num(floor(toNum(a[0]))) },
        "INT" to FnDef(1, 1) { a -> num(truncate(toNum(a[0]))) },
        "MOD" to FnDef(2, 2) { a -> num(toNum(a[0]) % toNum(a[1])) },
        "POWER" to FnDef(2, 2) { a -> num(jsPow(toNum(a[0]), toNum(a[1]))) },
        "SQRT" to FnDef(1, 1) { a -> num(sqrt(toNum(a[0]))) },
        "SIGN" to FnDef(1, 1) { a ->
            val x = toNum(a[0])
            num(if (x.isNaN()) Double.NaN else if (x > 0) 1.0 else if (x < 0) -1.0 else x)
        },
        "EXP" to FnDef(1, 1) { a -> num(Math.exp(toNum(a[0]))) },
        "LN" to FnDef(1, 1) { a -> num(ln(toNum(a[0]))) },
        "LOG10" to FnDef(1, 1) { a -> num(log10(toNum(a[0]))) },
        "AVERAGE" to FnDef(1, null) { a -> num(nums(a).fold(0.0, Double::plus) / a.size) },
        "MIN" to FnDef(1, null) { a -> num(jsMin(nums(a))) },
        "MAX" to FnDef(1, null) { a -> num(jsMax(nums(a))) },
        "MEDIAN" to FnDef(1, null) { a ->
            val s = nums(a).sorted()
            val m = s.size / 2
            num(if (s.size % 2 == 1) s[m] else (s[m - 1] + s[m]) / 2)
        },
        "COUNT" to FnDef(1, null) { a ->
            num(
                a.count { x ->
                    when (x) {
                        is BdJson.Num -> true
                        is BdJson.Str -> BdJS.trim(x.value).isNotEmpty() && !BdJS.number(x.value).isNaN()
                        else -> false
                    }
                }.toDouble(),
            )
        },
        "COUNTA" to FnDef(1, null) { a -> num(a.count { it != BdJson.Str("") && !it.isNull }.toDouble()) },
        "IF" to FnDef(2, 3) { a -> if (toBool(a[0])) a[1] else if (a.size > 2) a[2] else BdJson.Bool(false) },
        "AND" to FnDef(1, null) { a -> BdJson.Bool(a.all(::toBool)) },
        "OR" to FnDef(1, null) { a -> BdJson.Bool(a.any(::toBool)) },
        "NOT" to FnDef(1, 1) { a -> BdJson.Bool(!toBool(a[0])) },
        "XOR" to FnDef(1, null) { a -> BdJson.Bool(a.count(::toBool) % 2 == 1) },
        "TRUE" to FnDef(0, 0) { BdJson.Bool(true) },
        "FALSE" to FnDef(0, 0) { BdJson.Bool(false) },
        "IFS" to FnDef(2, null) { a ->
            var i = 0
            var hit: BdJson? = null
            while (i + 1 < a.size) {
                if (toBool(a[i])) {
                    hit = a[i + 1]
                    break
                }
                i += 2
            }
            hit ?: throw Failure("No IFS condition matched.")
        },
        "CHOOSE" to FnDef(2, null) { a ->
            val idx = truncate(toNum(a[0]))
            if (!(idx >= 0 && idx < a.size)) throw Failure("CHOOSE index out of range.")
            a[idx.toInt()]
        },
        "SWITCH" to FnDef(3, null) { a ->
            var i = 1
            var hit: BdJson? = null
            while (i + 1 < a.size) {
                if (strictEq(a[i], a[0])) {
                    hit = a[i + 1]
                    break
                }
                i += 2
            }
            hit ?: if (i < a.size) a[i] else BdJson.Bool(false)
        },
        "CONCATENATE" to FnDef(1, null) { a -> BdJson.Str(a.joinToString("") { toStr(it) }) },
        "LEN" to FnDef(1, 1) { a -> num(toStr(a[0]).length.toDouble()) },
        "LOWER" to FnDef(1, 1) { a -> BdJson.Str(toStr(a[0]).lowercase()) },
        "UPPER" to FnDef(1, 1) { a -> BdJson.Str(toStr(a[0]).uppercase()) },
        "SUBSTITUTE" to FnDef(3, null) { a ->
            val text = toStr(a[0])
            val rest = a.drop(1)
            if (rest.size % 2 != 0) {
                throw Failure(
                    "SUBSTITUTE needs find/replace in pairs — it got an odd number of arguments after the text.",
                )
            }
            val pairs = rest.chunked(2).map { toStr(it[0]) to toStr(it[1]) }
            BdJson.Str(substituteAll(text, pairs))
        },
        "SLUGIFY" to FnDef(1, 1) { a -> BdJson.Str(slugify(toStr(a[0]))) },
        "TRIM" to FnDef(1, 1) { a -> BdJson.Str(BdJS.trim(toStr(a[0]))) },
        "LEFT" to FnDef(1, 2) { a ->
            val text = toStr(a[0])
            BdJson.Str(jsSlice(text, 0.0, if (a.size > 1) toNum(a[1]) else 1.0))
        },
        "RIGHT" to FnDef(1, 2) { a ->
            val n = if (a.size > 1) toNum(a[1]) else 1.0
            BdJson.Str(jsSlice(toStr(a[0]), -n))
        },
        "MID" to FnDef(3, 3) { a ->
            val start = toNum(a[1]) - 1
            val text = toStr(a[0])
            BdJson.Str(jsSlice(text, start, start + toNum(a[2])))
        },
        "FILETYPE" to FnDef(1, 1) { a -> BdJson.Str(fileType(toStr(a[0]))) },
        "TODAY" to FnDef(0, 0) { BdJson.Str(BdDates.ymd(System.currentTimeMillis())) },
        "YEAR" to FnDef(1, 1) { a -> num(BdDates.utcParts(parseDate(a[0])).year.toDouble()) },
        "MONTH" to FnDef(1, 1) { a -> num(BdDates.utcParts(parseDate(a[0])).month.toDouble()) },
        "DAY" to FnDef(1, 1) { a -> num(BdDates.utcParts(parseDate(a[0])).day.toDouble()) },
        "DAYS" to FnDef(2, 2) { a ->
            val end = parseDate(a[0])
            val start = parseDate(a[1])
            num(jsRound((end - start) / 86_400_000.0))
        },
        "NOW" to FnDef(0, 0) { BdJson.Str(BdDates.isoString(System.currentTimeMillis())) },
        "MINUTES" to FnDef(2, 2) { a ->
            val s = parseDate(a[0])
            val e = parseDate(a[1])
            num(jsRound((e - s) / 60_000.0))
        },
        "HOURS" to FnDef(2, 3) { a ->
            val f = jsPow(10.0, if (a.size > 2) toNum(a[2]) else 2.0)
            val s = parseDate(a[0])
            val e = parseDate(a[1])
            num(jsRound((e - s) / 3_600_000.0 * f) / f)
        },
        "WEEKS" to FnDef(2, 2) { a ->
            val s = parseDate(a[0])
            val e = parseDate(a[1])
            num(truncate((e - s) / 604_800_000.0))
        },
        "MONTHS" to FnDef(2, 2) { a -> num(monthsBetween(parseDate(a[0]), parseDate(a[1]))) },
        "YEARS" to FnDef(2, 2) { a -> num(yearsBetween(parseDate(a[0]), parseDate(a[1]))) },
        "DATEDIFF" to FnDef(3, 3) { a ->
            val unit = toStr(a[0]).lowercase()
            val s = parseDate(a[1])
            val e = parseDate(a[2])
            val d = (e - s).toDouble()
            when (unit) {
                "minutes" -> num(jsRound(d / 60_000))
                "hours" -> num(jsRound(d / 3_600_000 * 100) / 100)
                "days" -> num(jsRound(d / 86_400_000))
                "weeks" -> num(truncate(d / 604_800_000))
                "months" -> num(monthsBetween(s, e))
                "years" -> num(yearsBetween(s, e))
                else -> throw Failure("Unknown DATEDIFF unit \"$unit\".")
            }
        },
        "DISTANCE" to FnDef(4, 5) { a ->
            val miles = if (a.size > 4) toStr(a[4]).lowercase() == "mi" else false
            num(haversine(toNum(a[0]), toNum(a[1]), toNum(a[2]), toNum(a[3]), miles))
        },
    )

    // Evaluator

    private class Ctx(val vars: Map<String, BdJson?>, val fns: Map<String, UserFunction>, val stack: Set<String>)

    private fun eval(node: Node, ctx: Ctx): BdJson = when (node) {
        is Node.Num -> BdJson.Num(node.v)
        is Node.Str -> BdJson.Str(node.v)
        is Node.Bool -> BdJson.Bool(node.v)
        is Node.Variable -> {
            val v = ctx.vars[node.name]
            if (v == null || v.isNull) throw Failure("Variable \"${node.name}\" has no value.")
            v
        }
        is Node.Member -> {
            val obj = eval(node.obj, ctx) as? BdJson.Obj
                ?: throw Failure("Cannot read field \"${node.key}\" of a non-object value.")
            val v = obj.fields[node.key]
            if (v == null || v.isNull) throw Failure("Field \"${node.key}\" has no value.")
            v
        }
        is Node.Unary ->
            if (node.op == "NOT") {
                BdJson.Bool(!toBool(eval(node.arg, ctx)))
            } else {
                val x = toNum(eval(node.arg, ctx))
                BdJson.Num(if (node.op == "-") -x else x)
            }
        is Node.Binary -> evalBinary(node.op, node.l, node.r, ctx)
        is Node.Call -> evalCall(node, ctx)
    }

    private fun evalCall(node: Node.Call, ctx: Ctx): BdJson {
        val name = node.name
        functions[name]?.let { def ->
            val args = node.args.map { eval(it, ctx) }
            if (args.size < def.min || (def.max != null && args.size > def.max)) {
                throw Failure("$name got the wrong number of arguments.")
            }
            return def.fn(args)
        }
        val user = ctx.fns[name] ?: throw Failure("Unknown function \"$name\".")
        if (name in ctx.stack) throw Failure("Circular function reference: \"$name\".")
        if (node.args.size != user.params.size) throw Failure("$name expects ${user.params.size} argument(s).")
        val args = node.args.map { eval(it, ctx) }
        val scope = HashMap<String, BdJson?>()
        user.params.forEachIndexed { i, p -> scope[p] = args[i] }
        return eval(user.ast, Ctx(scope, ctx.fns, ctx.stack + name))
    }

    private fun evalBinary(op: String, ln: Node, rn: Node, ctx: Ctx): BdJson {
        if (op == "AND") {
            if (!toBool(eval(ln, ctx))) return BdJson.Bool(false)
            return BdJson.Bool(toBool(eval(rn, ctx)))
        }
        if (op == "OR") {
            if (toBool(eval(ln, ctx))) return BdJson.Bool(true)
            return BdJson.Bool(toBool(eval(rn, ctx)))
        }
        val l = eval(ln, ctx)
        val r = eval(rn, ctx)
        return when (op) {
            "+" -> num(toNum(l) + toNum(r))
            "-" -> num(toNum(l) - toNum(r))
            "*" -> num(toNum(l) * toNum(r))
            "/" -> {
                val d = toNum(r)
                if (d == 0.0) throw Failure("Division by zero.")
                num(toNum(l) / d)
            }
            "%" -> {
                val d = toNum(r)
                if (d == 0.0) throw Failure("Division by zero.")
                num(toNum(l) % d)
            }
            "^" -> num(jsPow(toNum(l), toNum(r)))
            "&" -> BdJson.Str(toStr(l) + toStr(r))
            "=", "==" -> BdJson.Bool(looseEq(l, r))
            "<>", "!=" -> BdJson.Bool(!looseEq(l, r))
            "<" -> BdJson.Bool(cmp(l, r) < 0)
            ">" -> BdJson.Bool(cmp(l, r) > 0)
            "<=" -> BdJson.Bool(cmp(l, r) <= 0)
            ">=" -> BdJson.Bool(cmp(l, r) >= 0)
            else -> throw Failure("Unknown operator \"$op\".")
        }
    }

    private fun looseEq(l: BdJson, r: BdJson): Boolean {
        if (l is BdJson.Num || r is BdJson.Num) {
            val a = BdJS.number(l)
            val b = BdJS.number(r)
            if (!a.isNaN() && !b.isNaN()) return a == b
        }
        return toStr(l) == toStr(r)
    }

    private fun cmp(l: BdJson, r: BdJson): Double {
        if (l is BdJson.Num || r is BdJson.Num) return toNum(l) - toNum(r)
        val c = toStr(l).compareTo(toStr(r))
        return if (c < 0) -1.0 else if (c == 0) 0.0 else 1.0
    }
}
