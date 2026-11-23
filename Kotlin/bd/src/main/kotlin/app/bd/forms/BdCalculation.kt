package app.bd.forms

/**
 * `calculation` fields and business functions: ports of forms-core's
 * `calculation.ts` and `business-function.ts`.
 */
public object BdCalculation {
    public data class Outcome(
        val ok: Boolean,
        val value: BdJson?,
        val outputs: Map<String, BdJson>?,
        val error: String?,
    )

    public data class FunctionRun(
        val ok: Boolean,
        val outputs: Map<String, BdJson>,
        /** `scope/key: reason` per problem. */
        val issues: List<String>,
    )

    /**
     * A form value as a formula input: blank is "no value", an array reads as
     * its comma-joined text, everything else passes through.
     */
    internal fun formulaValue(raw: BdJson?): BdJson? {
        if (raw == null || BdJson.isBlank(raw)) return null
        if (raw is BdJson.Arr) return BdJson.Str(BdJS.string(raw))
        return raw
    }

    public fun compute(
        config: BdFormField.CalculationConfig,
        resolve: (String) -> BdJson?,
        functionsById: Map<String, BdBusinessFunction> = emptyMap(),
        userFunctions: Map<String, BdFormula.UserFunction> = emptyMap(),
    ): Outcome {
        val bindings = config.inputMap ?: emptyList()
        if (config.mode == "function") {
            val def = config.functionId?.let { functionsById[it] }
                ?: return Outcome(false, null, null, "Referenced function not found.")
            val raw = LinkedHashMap<String, BdJson?>()
            for (b in bindings) raw[b.variable] = resolve(b.fieldId)
            val run = runFunction(def, raw, userFunctions)
            val key = config.outputKey ?: def.outputs.firstOrNull()?.key
            val value = key?.let { run.outputs[it] }
            return Outcome(run.ok, value, run.outputs, if (run.ok) null else run.issues.joinToString("; "))
        }
        val formula = config.formula?.let(BdJS::trim)?.takeIf { it.isNotEmpty() }
            ?: return Outcome(false, null, null, "No formula.")
        val vars = LinkedHashMap<String, BdJson?>()
        for (b in bindings) vars[b.variable] = formulaValue(resolve(b.fieldId))
        return when (val r = BdFormula.run(formula, vars, userFunctions)) {
            is BdFormula.Result.Ok -> Outcome(true, r.result, null, null)
            is BdFormula.Result.Error -> Outcome(false, null, null, r.message)
        }
    }

    /** Prefix + value + suffix, with fixed decimals for numbers. */
    public fun format(value: BdJson?, display: BdFormField.CalculationConfig.Display?): String {
        if (value == null || value.isNull) return ""
        val decimals = display?.decimals
        val body = when {
            value is BdJson.Num && decimals != null && value.value.isFinite() -> BdJS.toFixed(value.value, decimals)
            value is BdJson.Obj || value is BdJson.Arr -> value.toJsonString(sortKeys = true)
            else -> BdJS.string(value)
        }
        return (display?.prefix ?: "") + body + (display?.suffix ?: "")
    }

    private val isoDate = Regex("^[0-9]{4}-[0-9]{2}-[0-9]{2}([T ].*)?$")

    private class CoerceFailure(val reason: String)

    private fun coerce(value: BdJson, type: String): Any = when (type) {
        "any" -> value
        "object" -> if (value is BdJson.Obj) value else CoerceFailure("expected an object")
        "number" -> {
            val n = value.doubleValue ?: BdJS.number(value)
            if (n.isNaN()) CoerceFailure("not a number") else BdJson.Num(n)
        }
        "boolean" -> when {
            value is BdJson.Bool -> value
            value == BdJson.Str("true") || value == BdJson.Num(1.0) -> BdJson.Bool(true)
            value == BdJson.Str("false") || value == BdJson.Num(0.0) -> BdJson.Bool(false)
            else -> CoerceFailure("not a boolean")
        }
        "date" -> {
            val s = BdJS.string(value)
            if (isoDate.containsMatchIn(s) && BdDates.parseInstant(s) != null) BdJson.Str(s) else CoerceFailure("not a date")
        }
        else -> value as? BdJson.Str ?: BdJson.Str(BdJS.string(value))
    }

    private fun matches(value: BdJson, type: String): Boolean = when (type) {
        "any" -> true
        "number" -> value is BdJson.Num && !value.value.isNaN()
        "text" -> value.stringValue != null
        "boolean" -> value.boolValue != null
        "object" -> value.objectValue != null
        "date" -> value.stringValue?.let { isoDate.containsMatchIn(it) } ?: false
        else -> false
    }

    /**
     * Run a business function: coerce and default its inputs, then evaluate
     * each output in order (later outputs can read earlier ones), falling back
     * where an output fails or comes out the wrong type.
     */
    public fun runFunction(
        def: BdBusinessFunction,
        inputs: Map<String, BdJson?>,
        userFunctions: Map<String, BdFormula.UserFunction> = emptyMap(),
    ): FunctionRun {
        val issues = ArrayList<String>()
        val vars = LinkedHashMap<String, BdJson?>()
        for (input in def.inputs) {
            val value = inputs[input.key]
            if (value == null || BdJson.isBlank(value)) {
                val d = input.default
                if (d != null) {
                    vars[input.key] = d
                } else if (input.required == true) {
                    issues.add("input/${input.key}: required value is missing")
                }
                continue
            }
            when (val c = coerce(value, input.type)) {
                is CoerceFailure -> issues.add("input/${input.key}: ${c.reason}")
                is BdJson -> vars[input.key] = c
            }
        }
        val outputs = LinkedHashMap<String, BdJson>()
        for (out in def.outputs) {
            fun fallback(reason: String) {
                val fb = out.fallback
                if (fb != null) {
                    outputs[out.key] = fb
                    vars[out.key] = fb
                } else {
                    issues.add("output/${out.key}: $reason")
                }
            }
            when (val r = BdFormula.run(out.formula, vars, userFunctions)) {
                is BdFormula.Result.Error -> fallback(r.message)
                is BdFormula.Result.Ok ->
                    if (matches(r.result, out.type)) {
                        outputs[out.key] = r.result
                        vars[out.key] = r.result
                    } else {
                        fallback("expected ${out.type}")
                    }
            }
        }
        return FunctionRun(issues.isEmpty(), outputs, issues)
    }
}
