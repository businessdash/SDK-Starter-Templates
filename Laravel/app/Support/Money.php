<?php

namespace App\Support;

use NumberFormatter;

/**
 * Currency formatting.
 *
 * Two helpers on purpose, because the API is not uniform and guessing wrong
 * is a 100× error either way:
 *
 *  - `cents()` — product prices, subscription prices, checkout totals. These
 *    are INTEGER CENTS. That is the platform-wide convention for stored
 *    money; it exists so no total ever picks up a floating-point rounding
 *    error on the way to Stripe.
 *  - `amount()` — cart `unitPrice` / `subtotal`, which come back already
 *    decimal.
 *
 * When adding a call to a field this starter doesn't already render, check
 * which shape it is before picking a helper.
 */
class Money
{
    public static function cents(mixed $cents, string $currency = 'USD'): string
    {
        if ($cents === null || ! is_numeric($cents)) {
            return '';
        }

        return self::format(((float) $cents) / 100, $currency);
    }

    public static function amount(mixed $amount, string $currency = 'USD'): string
    {
        if ($amount === null || ! is_numeric($amount)) {
            return '';
        }

        return self::format((float) $amount, $currency);
    }

    private static function format(float $value, string $currency): string
    {
        if (class_exists(NumberFormatter::class)) {
            $formatter = new NumberFormatter('en_US', NumberFormatter::CURRENCY);

            return $formatter->formatCurrency($value, $currency) ?: number_format($value, 2);
        }

        // ext-intl is not guaranteed on every PHP build.
        return '$'.number_format($value, 2);
    }
}
