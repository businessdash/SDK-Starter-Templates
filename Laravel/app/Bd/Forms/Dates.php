<?php

namespace App\Bd\Forms;

use DateTime;
use DateTimeZone;

/**
 * Dates with the server's rules (`toUtcLegacyDate`): a bare `YYYY-MM-DD` is
 * midnight UTC, an ISO instant with an offset is that instant, anything else
 * falls back to the looser `Date.parse` shapes. A date is epoch milliseconds
 * (a float, as in JavaScript).
 */
final class Dates
{
    /** Epoch ms from a number (ms) or a date string; null when it isn't one. */
    public static function parse(mixed $value): ?float
    {
        if (Json::isNumber($value)) {
            return is_finite((float) $value) ? (float) $value : null;
        }

        return self::parseInstant(Js::string($value));
    }

    public static function parseInstant(string $raw): ?float
    {
        $s = Js::trim($raw);
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})\z/', $s, $m)) {
            return self::utc((int) $m[1], (int) $m[2], (int) $m[3]);
        }
        // ISO 8601 with an explicit offset or Z (Temporal.Instant.from).
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?([Zz]|[+-]\d{2}:?\d{2})\z/', $s, $m)) {
            $ms = self::utc((int) $m[1], (int) $m[2], (int) $m[3], (int) $m[4], (int) $m[5], (int) ($m[6] ?? 0));
            if (($m[7] ?? '') !== '') {
                $ms += ((int) str_pad($m[7], 9, '0')) / 1_000_000;
            }
            $zone = $m[8];
            if ($zone !== 'Z' && $zone !== 'z') {
                $digits = preg_replace('/\D/', '', $zone);
                $offset = ((int) substr($digits, 0, 2)) * 3600 + ((int) substr($digits, -2)) * 60;
                $ms -= ($zone[0] === '-' ? -1 : 1) * $offset * 1000;
            }

            return $ms;
        }
        // Date.parse fallbacks: a date-time without an offset is LOCAL time.
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\z/', $s, $m)) {
            $seconds = mktime((int) $m[4], (int) $m[5], (int) ($m[6] ?? 0), (int) $m[2], (int) $m[3], (int) $m[1]);

            return $seconds * 1000.0 + (($m[7] ?? '') !== '' ? (int) str_pad($m[7], 3, '0') : 0);
        }
        if (preg_match('/^(\d{4})-(\d{2})\z/', $s, $m)) {
            return self::utc((int) $m[1], (int) $m[2], 1);
        }
        if (preg_match('/^(\d{4})\z/', $s, $m)) {
            return self::utc((int) $m[1], 1, 1);
        }
        foreach (['!F j, Y', '!M j, Y', '!Y/m/d', '!m/d/Y', 'D, d M Y H:i:s T'] as $format) {
            $date = DateTime::createFromFormat($format, $s);
            $errors = DateTime::getLastErrors();
            if ($date !== false && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
                return $date->getTimestamp() * 1000.0;
            }
        }

        return null;
    }

    /** A UTC calendar time as epoch ms (out-of-range parts roll over). */
    public static function utc(int $year, int $month, int $day, int $hour = 0, int $minute = 0, int $second = 0): float
    {
        return gmmktime($hour, $minute, $second, $month, $day, $year) * 1000.0;
    }

    /** @return array{int, int, int} year, month, day in UTC */
    public static function utcParts(float $ms): array
    {
        $date = (new DateTime('@'.(int) floor($ms / 1000)))->setTimezone(new DateTimeZone('UTC'));

        return [(int) $date->format('Y'), (int) $date->format('n'), (int) $date->format('j')];
    }

    /** `Date.toISOString()`: `2024-03-15T10:00:00.000Z`. */
    public static function isoString(float $ms): string
    {
        $seconds = (int) floor($ms / 1000);

        return gmdate('Y-m-d\TH:i:s', $seconds).sprintf('.%03dZ', (int) round($ms - $seconds * 1000));
    }
}
