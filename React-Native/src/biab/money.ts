/**
 * Currency formatting.
 *
 * Two functions on purpose, because the API is not uniform and guessing wrong
 * is a 100× error in either direction:
 *
 * - `cents` — product prices, subscription prices, checkout and invoice
 *   totals. **Integer cents**, the platform-wide convention for stored money.
 *   It exists so no total picks up a floating-point rounding error on the way
 *   to Stripe.
 * - `amount` — cart `unitPrice` / `subtotal`, already decimal.
 *
 * Before rendering a money field this app doesn't already show, check which
 * shape it is.
 */

function format(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}

export function cents(value: number | null | undefined, currency = 'USD'): string {
  if (value == null || Number.isNaN(value)) return ''
  return format(value / 100, currency)
}

export function amount(value: number | null | undefined, currency = 'USD'): string {
  if (value == null || Number.isNaN(value)) return ''
  return format(value, currency)
}
