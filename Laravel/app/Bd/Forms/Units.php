<?php

namespace App\Bd\Forms;

/**
 * Measurement conversion: the same table and arithmetic as forms-core's
 * `units.ts` (the table itself is generated from it, in `FormsData`).
 *
 * A category is `['key', 'label', 'baseUnit', 'affine', 'units' => [[symbol, factor], …]]`.
 */
final class Units
{
    public static function category(?string $key): ?array
    {
        foreach (FormsData::UNIT_CATEGORIES as $category) {
            if ($category['key'] === $key) {
                return $category;
            }
        }

        return null;
    }

    /** The field's category, or length when it names none (or an unknown one). */
    public static function categoryOf(Field $field): array
    {
        return self::category(Json::str($field->config('unitConfig', 'category'))) ?? self::category('length');
    }

    /** @return list<string> */
    public static function symbols(array $category): array
    {
        return array_map(fn ($unit) => $unit[0], $category['units']);
    }

    public static function contains(array $category, string $unit): bool
    {
        return in_array($unit, self::symbols($category), true);
    }

    private static function factor(array $category, string $unit): ?float
    {
        foreach ($category['units'] as [$symbol, $factor]) {
            if ($symbol === $unit) {
                return (float) $factor;
            }
        }

        return null;
    }

    public static function toBase(float $value, string $unit, array $category): ?float
    {
        $factor = self::factor($category, $unit);
        if ($factor === null) {
            return null;
        }
        if ($category['affine']) {
            return match ($unit) {
                '°C' => $value,
                '°F' => ($value - 32) * (5.0 / 9.0),
                'K' => $value - 273.15,
                default => null,
            };
        }

        return $value * $factor;
    }

    public static function fromBase(float $base, string $unit, array $category): ?float
    {
        $factor = self::factor($category, $unit);
        if ($factor === null) {
            return null;
        }
        if ($category['affine']) {
            return match ($unit) {
                '°C' => $base,
                '°F' => $base * (9.0 / 5.0) + 32,
                'K' => $base + 273.15,
                default => null,
            };
        }

        return $base / $factor;
    }

    /** A friendly restatement, 1500 m → "1.5 km": the largest unit the value reaches, to 4 places. */
    public static function format(?float $value, string $unit, array $category): string
    {
        if ($value === null || is_nan($value)) {
            return '';
        }
        $tidy = fn (float $n) => Js::numberString(Js::parseNumber(Js::toFixed($n, 4)));
        $base = $category['affine'] || ! self::contains($category, $unit) ? null : self::toBase($value, $unit, $category);
        if ($base === null) {
            return $tidy($value).' '.$unit;
        }
        $ordered = $category['units'];
        $index = array_flip(array_keys($ordered));
        uksort($ordered, fn ($a, $b) => $ordered[$a][1] != $ordered[$b][1] ? $ordered[$b][1] <=> $ordered[$a][1] : $index[$a] <=> $index[$b]);
        $ordered = array_values($ordered);
        $last = $ordered[count($ordered) - 1][0];
        $magnitude = abs($base);
        foreach ($ordered as [$symbol, $factor]) {
            if ($magnitude >= $factor || $symbol === $last) {
                return $tidy($base / $factor).' '.$symbol;
            }
        }

        return $tidy($value).' '.$unit;
    }
}
