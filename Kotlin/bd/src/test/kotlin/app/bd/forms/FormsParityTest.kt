package app.bd.forms

import kotlin.math.abs
import kotlin.math.max
import kotlin.test.Test
import kotlin.test.fail
import kotlinx.serialization.builtins.ListSerializer

/**
 * Replays `forms-parity.json`: inputs run through the TypeScript forms-core by
 * `sdk/scripts/gen-native-forms.ts`, with the answers TS gave. Every case here
 * must agree, or the native renderer would tell a visitor something the web
 * renderer and the server don't.
 *
 * Each test collects every disagreement before failing, so one run shows the
 * whole picture rather than the first miss.
 */
class FormsParityTest {
    companion object {
        val fixtures: Map<String, BdJson> by lazy {
            val text = FormsParityTest::class.java.getResource("/forms-parity.json")!!.readText()
            BdJson.from(formsJson.parseToJsonElement(text)).objectValue!!
        }

        fun cases(key: String): List<Map<String, BdJson>> =
            fixtures.getValue(key).arrayValue!!.map { it.objectValue!! }.also { require(it.isNotEmpty()) { "no $key cases" } }

        /** Undo the generator's `{ "$number": "NaN" }` tagging. */
        fun untag(v: BdJson?): BdJson? = when (v) {
            null -> null
            is BdJson.Obj -> v.fields["\$number"]?.stringValue?.let { tag ->
                BdJson.Num(
                    when (tag) {
                        "NaN" -> Double.NaN
                        "Infinity" -> Double.POSITIVE_INFINITY
                        else -> Double.NEGATIVE_INFINITY
                    },
                )
            } ?: BdJson.Obj(v.fields.mapValues { untag(it.value)!! })
            is BdJson.Arr -> BdJson.Arr(v.items.map { untag(it)!! })
            else -> v
        }

        /** JSON equality with float tolerance (libm can differ in the last ulp). */
        fun same(a: BdJson?, b: BdJson?): Boolean = when {
            a is BdJson.Num && b is BdJson.Num -> {
                val x = a.value
                val y = b.value
                if (x.isNaN() || y.isNaN()) x.isNaN() && y.isNaN()
                else x == y || abs(x - y) <= 1e-12 * max(abs(x), abs(y))
            }
            a is BdJson.Arr && b is BdJson.Arr -> a.items.size == b.items.size && a.items.indices.all { same(a.items[it], b.items[it]) }
            a is BdJson.Obj && b is BdJson.Obj ->
                a.fields.keys == b.fields.keys && a.fields.all { (k, v) -> same(v, b.fields[k]) }
            (a == null || a.isNull) && (b == null || b.isNull) -> true
            else -> a == b
        }

        fun businessFunction(id: String, slug: String, raw: BdJson): BdBusinessFunction {
            val o = raw.objectValue!!
            val inputs = formsJson.decodeFromJsonElement(ListSerializer(BdBusinessFunction.Input.serializer()), o.getValue("inputs").toJsonElement())
            val outputs = formsJson.decodeFromJsonElement(ListSerializer(BdBusinessFunction.Output.serializer()), o.getValue("outputs").toJsonElement())
            return BdBusinessFunction(id, slug, inputs, outputs)
        }

        fun userFunctions(raw: BdJson?): Map<String, BdFormula.UserFunction> {
            val defs = raw?.objectValue ?: return emptyMap()
            return BdFormula.userFunctions(defs.mapValues { (name, def) -> businessFunction(name, name, def) })
        }

        val fnDef: BdBusinessFunction by lazy { businessFunction("fn1", "quote", fixtures.getValue("fnDef")) }

        fun show(v: BdJson?): String = v?.toJsonString() ?: "(absent)"
    }

    private class Misses {
        val lines = ArrayList<String>()
        fun expect(ok: Boolean, what: () -> String) {
            if (!ok) lines.add(what())
        }
        fun check(name: String) {
            if (lines.isNotEmpty()) fail("$name: ${lines.size} mismatch(es)\n  " + lines.joinToString("\n  "))
        }
    }

    @Test fun numberToString() {
        val m = Misses()
        for (c in cases("numberStrings")) {
            val n = untag(c["input"])!!.doubleValue!!
            val got = BdJS.string(n)
            m.expect(got == c["output"]!!.stringValue) { "String($n) = $got, TS ${c["output"]}" }
        }
        m.check("numberStrings")
    }

    @Test fun stringToNumber() {
        val m = Misses()
        for (c in cases("numberParses")) {
            val input = c["input"]!!.stringValue!!
            val got = BdJson.Num(BdJS.number(input))
            m.expect(same(got, untag(c["output"]))) { "Number(\"$input\") = ${got.value}, TS ${show(c["output"])}" }
        }
        m.check("numberParses")
    }

    @Test fun toFixed() {
        val m = Misses()
        for (c in cases("toFixed")) {
            val n = c["input"]!!.doubleValue!!
            val d = c["decimals"]!!.doubleValue!!.toInt()
            val got = BdJS.toFixed(n, d)
            m.expect(got == c["output"]!!.stringValue) { "($n).toFixed($d) = $got, TS ${c["output"]}" }
        }
        m.check("toFixed")
    }

    @Test fun formulas() {
        val m = Misses()
        for (c in cases("formula")) {
            val src = c["src"]!!.stringValue!!
            val vars: Map<String, BdJson?> = c["vars"]?.objectValue ?: emptyMap()
            val r = BdFormula.run(src, vars, userFunctions(c["functions"]))
            val expected = c["result"]!!.objectValue!!
            if (expected["ok"] == BdJson.Bool(true)) {
                m.expect(same(r.value, untag(expected["value"]))) { "$src → $r, TS ${show(expected["value"])}" }
            } else {
                m.expect(r.errorMessage == expected["error"]!!.stringValue) { "$src → $r, TS error ${expected["error"]}" }
            }
        }
        m.check("formula")
    }

    @Test fun conditions() {
        val m = Misses()
        for (c in cases("conditions")) {
            val rule = formsJson.decodeFromJsonElement(BdConditionRule.serializer(), c.getValue("rule").toJsonElement())
            val data: Map<String, BdJson> = c["value"]?.let { mapOf("a" to it) } ?: emptyMap()
            val got = BdFormRules.evalCondition(rule, data)
            m.expect(got == c["result"]!!.boolValue) { "${show(c["rule"])} on ${show(c["value"])} = $got" }
        }
        m.check("conditions")
    }

    @Test fun validation() {
        val m = Misses()
        for (c in cases("validation")) {
            val field = BdFormField.make(c.getValue("field"))
            val value = c["value"]
            val empty = BdFormRules.isEmpty(field, value)
            m.expect(empty == c["empty"]!!.boolValue) { "isEmpty ${field.type} ${show(value)} = $empty" }
            val reason = BdFormRules.validateValue(field, value)
            m.expect(reason == c["reason"]?.stringValue) { "validate ${field.type} ${show(value)} = $reason, TS ${show(c["reason"])}" }
        }
        m.check("validation")
    }

    @Test fun trees() {
        val m = Misses()
        for (c in cases("trees")) {
            val name = c["name"]!!.stringValue!!
            val fields = c.getValue("fields").arrayValue!!.map { BdFormField.make(it) }
            val data = c.getValue("data").objectValue!!
            val missing = BdFormRules.findMissingRequired(fields, data).map { it.id }
            m.expect(missing == c.getValue("missing").stringArray) { "missing: $name = $missing, TS ${show(c["missing"])}" }
            val seed = BdJson.Obj(BdFormRules.seedInitialData(fields))
            m.expect(same(seed, c["seed"])) { "seed: $name = ${show(seed)}, TS ${show(c["seed"])}" }
            val payload = BdJson.Obj(BdFormRules.toSubmissionPayload(fields, data))
            m.expect(same(payload, c["payload"])) { "payload: $name = ${show(payload)}, TS ${show(c["payload"])}" }
        }
        m.check("trees")
    }

    @Test fun units() {
        val m = Misses()
        for (c in cases("units")) {
            val cat = BdUnits.category(c["category"]!!.stringValue)!!
            val value = c["value"]!!.doubleValue!!
            val unit = c["unit"]!!.stringValue!!
            val base = BdUnits.convertToBase(value, unit, cat)
            m.expect(same(base?.let { BdJson.Num(it) }, c["base"])) { "base $value $unit = $base, TS ${show(c["base"])}" }
            val back = base?.let { BdUnits.convertFromBase(it, unit, cat) }
            m.expect(same(back?.let { BdJson.Num(it) }, c["back"])) { "back $value $unit = $back, TS ${show(c["back"])}" }
            val formatted = BdUnits.format(value, unit, cat)
            m.expect(formatted == c["formatted"]!!.stringValue) { "format $value $unit = $formatted, TS ${c["formatted"]}" }
        }
        m.check("units")
    }

    @Test fun calculations() {
        val m = Misses()
        for (c in cases("calculations")) {
            val config = formsJson.decodeFromJsonElement(BdFormField.CalculationConfig.serializer(), c.getValue("config").toJsonElement())
            val values = c.getValue("values").objectValue!!
            val r = BdCalculation.compute(config, { values[it] }, mapOf("fn1" to fnDef))
            val expected = c.getValue("result").objectValue!!
            val label = show(c["config"])
            m.expect(r.ok == expected["ok"]!!.boolValue) { "ok $label = ${r.ok}" }
            m.expect(same(r.value, expected["value"])) { "value $label = ${show(r.value)}, TS ${show(expected["value"])}" }
            m.expect(r.error == expected["error"]?.stringValue) { "error $label = ${r.error}, TS ${show(expected["error"])}" }
            expected["outputs"]?.let { outputs ->
                m.expect(same(r.outputs?.let { BdJson.Obj(it) }, outputs)) { "outputs $label = ${r.outputs}, TS ${show(outputs)}" }
            }
        }
        m.check("calculations")
    }

    @Test fun businessFunctions() {
        val m = Misses()
        for (c in cases("businessFunctions")) {
            val inputs: Map<String, BdJson?> = c.getValue("inputs").objectValue!!
            val r = BdCalculation.runFunction(fnDef, inputs)
            val expected = c.getValue("result").objectValue!!
            m.expect(r.ok == expected["ok"]!!.boolValue) { "ok ${show(c["inputs"])} = ${r.ok}" }
            m.expect(same(BdJson.Obj(r.outputs), expected["outputs"])) { "outputs ${show(c["inputs"])} = ${r.outputs}, TS ${show(expected["outputs"])}" }
            val issues = expected.getValue("issues").arrayValue!!.map { i ->
                "${i["scope"]!!.stringValue}/${i["key"]!!.stringValue}: ${i["reason"]!!.stringValue}"
            }
            m.expect(r.issues == issues) { "issues ${show(c["inputs"])} = ${r.issues}, TS $issues" }
        }
        m.check("businessFunctions")
    }

    @Test fun calcFormat() {
        val m = Misses()
        for (c in cases("calcFormat")) {
            val display = formsJson.decodeFromJsonElement(BdFormField.CalculationConfig.Display.serializer(), c.getValue("display").toJsonElement())
            val value = c["value"]?.takeIf { !it.isNull }
            val got = BdCalculation.format(value, display)
            m.expect(got == c["output"]!!.stringValue) { "${show(value)} = $got, TS ${c["output"]}" }
        }
        m.check("calcFormat")
    }
}
