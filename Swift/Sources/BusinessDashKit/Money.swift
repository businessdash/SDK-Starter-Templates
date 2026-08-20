import Foundation

/// Currency formatting.
///
/// Two entry points on purpose, because the API is not uniform and guessing
/// wrong is a 100× error in either direction:
///
/// * ``cents(_:currency:)`` — product prices, subscription prices, checkout
///   totals, invoice and quote totals. These are **integer cents**, the
///   platform-wide convention for stored money. It exists so no total picks up
///   a floating-point rounding error on the way to Stripe.
/// * ``amount(_:currency:)`` — cart `unitPrice` / `subtotal`, which arrive
///   already decimal.
///
/// Before rendering a money field this kit doesn't already model, check which
/// shape it is. The model doc comments say so per property.
public enum Money {
    public static func cents(_ value: Int?, currency: String? = "USD") -> String {
        guard let value else { return "" }
        return format(Decimal(value) / 100, currency: currency)
    }

    public static func amount(_ value: Double?, currency: String? = "USD") -> String {
        guard let value else { return "" }
        return format(Decimal(value), currency: currency)
    }

    private static func format(_ value: Decimal, currency: String?) -> String {
        // Decimal, not Double: money formatting should not round-trip through
        // binary floating point.
        value.formatted(.currency(code: currency ?? "USD"))
    }
}
