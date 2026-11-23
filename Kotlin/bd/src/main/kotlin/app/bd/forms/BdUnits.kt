package app.bd.forms

/**
 * One unit of a measurement category, e.g. `ft` in length.
 *
 * [factor] converts to the category's base unit (`value * factor`). For affine
 * categories (temperature) the factor is unused and conversion is by formula.
 * Named `BdUnit`, not `Unit`, so it never shadows Kotlin's own `Unit` in this
 * package.
 */
public data class BdUnit(
    public val symbol: String,
    public val factor: Double,
)

/** A measurement category (length, mass, temperature, …) and its units. */
public data class BdUnitCategory(
    public val key: String,
    public val label: String,
    public val baseUnit: String,
    public val isAffine: Boolean,
    public val units: List<BdUnit>,
)

/** Does this category offer [unit]? */
public fun BdUnitCategory.contains(unit: String): Boolean = units.any { it.symbol == unit }

internal fun BdUnitCategory.unit(symbol: String): BdUnit? = units.firstOrNull { it.symbol == symbol }

/**
 * Measurement conversion: the same table and arithmetic as forms-core's
 * `units.ts` (the table itself is generated from it).
 */
public object BdUnits {
    public val categories: List<BdUnitCategory> get() = FormsData.unitCategories

    public fun category(key: String?): BdUnitCategory? =
        key?.let { k -> FormsData.unitCategories.firstOrNull { it.key == k } }

    public fun convertToBase(value: Double, unit: String, cat: BdUnitCategory): Double? {
        val u = cat.unit(unit) ?: return null
        if (cat.isAffine) {
            return when (unit) {
                "°C" -> value
                "°F" -> (value - 32) * (5.0 / 9.0)
                "K" -> value - 273.15
                else -> null
            }
        }
        return value * u.factor
    }

    public fun convertFromBase(base: Double, unit: String, cat: BdUnitCategory): Double? {
        val u = cat.unit(unit) ?: return null
        if (cat.isAffine) {
            return when (unit) {
                "°C" -> base
                "°F" -> base * (9.0 / 5.0) + 32
                "K" -> base + 273.15
                else -> null
            }
        }
        return base / u.factor
    }

    /**
     * A friendly restatement: 1500 m → "1.5 km". Picks the largest unit the
     * value reaches, rounded to 4 places.
     */
    public fun format(value: Double?, unit: String, cat: BdUnitCategory): String {
        if (value == null || value.isNaN()) return ""
        fun tidy(n: Double): String = BdJS.string(BdJS.number(BdJS.toFixed(n, 4)))
        val base = if (!cat.isAffine && cat.contains(unit)) convertToBase(value, unit, cat) else null
        if (base == null) return "${tidy(value)} $unit"
        val ordered = cat.units.withIndex()
            .sortedWith(compareByDescending<IndexedValue<BdUnit>> { it.value.factor }.thenBy { it.index })
            .map { it.value }
        val magnitude = kotlin.math.abs(base)
        for (u in ordered) {
            if (magnitude >= u.factor || u.symbol == ordered.last().symbol) return "${tidy(base / u.factor)} ${u.symbol}"
        }
        return "${tidy(value)} $unit"
    }
}
