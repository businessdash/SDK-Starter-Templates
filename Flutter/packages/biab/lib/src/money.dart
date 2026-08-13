/// Currency formatting.
///
/// Two functions on purpose, because the API is not uniform and guessing
/// wrong is a 100× error in either direction:
///
/// * [cents] — product prices, subscription prices, checkout and invoice
///   totals. These are **integer cents**, the platform-wide convention for
///   stored money. It exists so no total picks up a floating-point rounding
///   error on the way to Stripe.
/// * [amount] — cart `unitPrice` / `subtotal`, which arrive already decimal.
///
/// Before rendering a money field this library doesn't already model, check
/// which shape it is — the model doc comments say so per field.
///
/// Formatting is deliberately hand-rolled rather than pulling in `intl`: the
/// point of this library is that its only dependency is `http`. Swap in
/// `NumberFormat.simpleCurrency` if you need real locale handling.
class Money {
  const Money._();

  static const _symbols = {'USD': r'$', 'EUR': '€', 'GBP': '£', 'CAD': r'CA$'};

  static String cents(int? value, {String currency = 'USD'}) {
    if (value == null) return '';
    return _format(value / 100, currency);
  }

  static String amount(num? value, {String currency = 'USD'}) {
    if (value == null) return '';
    return _format(value.toDouble(), currency);
  }

  static String _format(double value, String currency) {
    final symbol = _symbols[currency.toUpperCase()];
    final formatted = value.toStringAsFixed(2);
    return symbol != null ? '$symbol$formatted' : '$currency $formatted';
  }
}
