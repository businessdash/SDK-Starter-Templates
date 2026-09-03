package app.bd

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Currency formatting.
 *
 * Two functions on purpose, because the API is not uniform and guessing wrong
 * is a 100× error in either direction:
 *
 * * [cents] — product prices, subscription prices, checkout and invoice
 *   totals. These are **integer cents**, the platform-wide convention for
 *   stored money. It exists so no total picks up a floating-point rounding
 *   error on the way to Stripe.
 * * [amount] — cart `unitPrice` / `subtotal`, which arrive already decimal.
 *
 * Before rendering a money field this library doesn't already model, check
 * which shape it is — the model properties say so.
 *
 * `BigDecimal`, not `Double`: money formatting should not round-trip through
 * binary floating point.
 */
public object Money {
    private val symbols = mapOf(
        "USD" to "$",
        "EUR" to "€",
        "GBP" to "£",
        "CAD" to "CA$",
    )

    public fun cents(value: Int?, currency: String? = "USD"): String {
        if (value == null) return ""
        return format(BigDecimal(value).divide(BigDecimal(100)), currency)
    }

    public fun amount(value: Double?, currency: String? = "USD"): String {
        if (value == null) return ""
        return format(BigDecimal.valueOf(value), currency)
    }

    private fun format(value: BigDecimal, currency: String?): String {
        val code = (currency ?: "USD").uppercase()
        val scaled = value.setScale(2, RoundingMode.HALF_UP).toPlainString()
        val symbol = symbols[code]
        return if (symbol != null) "$symbol$scaled" else "$code $scaled"
    }
}
