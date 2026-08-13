import Foundation

/// Currency formatting.
///
/// Two functions on purpose, because the API is not uniform and guessing wrong
/// is a 100× error in either direction:
///
/// * `cents` — product / subscription / checkout / invoice totals. **Integer
///   cents**, the platform-wide convention for stored money. It exists so no
///   total picks up a floating-point rounding error on the way to Stripe.
/// * `amount` — cart `unitPrice` / `subtotal`, already decimal.
///
/// Before rendering a money field this starter doesn't already show, check
/// which shape it is — the model properties say so.
enum Money {
    static func cents(_ value: Int?, currency: String? = "USD") -> String {
        guard let value else { return "" }
        return format(Decimal(value) / 100, currency: currency)
    }

    static func amount(_ value: Double?, currency: String? = "USD") -> String {
        guard let value else { return "" }
        return format(Decimal(value), currency: currency)
    }

    private static func format(_ value: Decimal, currency: String?) -> String {
        value.formatted(.currency(code: currency ?? "USD"))
    }
}
