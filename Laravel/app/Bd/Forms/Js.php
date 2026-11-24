<?php

namespace App\Bd\Forms;

/**
 * The JavaScript coercions BD's form rules are written in terms of.
 *
 * Conditions compare `String(value)`, numeric operators use `Number(x)`, a
 * calculation's display uses `toFixed`. Matching the server means matching
 * these exactly, odd corners included (`String([1,2])` is "1,2", `Number("")`
 * is 0, `(0.25).toFixed(1)` is "0.3").
 */
final class Js
{
    /** The characters `String.prototype.trim` removes. */
    public const WHITESPACE = '\x{9}-\x{D}\x{20}\x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}';

    /** `String(value)`. */
    public static function string(mixed $value): string
    {
        return match (true) {
            $value === null, $value instanceof Undefined => '',
            is_bool($value) => $value ? 'true' : 'false',
            is_int($value), is_float($value) => self::numberString((float) $value),
            is_string($value) => $value,
            // Array.prototype.join: null becomes "", nested lists join too.
            Json::isList($value) => implode(',', array_map(fn ($item) => $item === null ? '' : self::string($item), $value)),
            default => '[object Object]',
        };
    }

    /** `Number(value)`. */
    public static function number(mixed $value): float
    {
        return match (true) {
            $value instanceof Undefined => NAN,
            $value === null => 0.0,
            is_bool($value) => $value ? 1.0 : 0.0,
            is_int($value), is_float($value) => (float) $value,
            is_string($value) => self::parseNumber($value),
            // ToPrimitive → join → Number: [] is 0, [x] is Number(x).
            Json::isList($value) => self::parseNumber(self::string($value)),
            default => NAN,
        };
    }

    /** `Number(string)`: hex/binary/octal literals, Infinity, whitespace, and "" → 0. */
    public static function parseNumber(string $raw): float
    {
        $s = self::trim($raw);
        if ($s === '') {
            return 0.0;
        }
        if ($s === 'Infinity' || $s === '+Infinity') {
            return INF;
        }
        if ($s === '-Infinity') {
            return -INF;
        }
        if (preg_match('/^0([xXbBoO])(.*)\z/s', $s, $m)) {
            $radix = ['x' => 16, 'b' => 2, 'o' => 8][strtolower($m[1])];
            if ($m[2] === '') {
                return NAN;
            }
            $value = 0.0;
            foreach (str_split($m[2]) as $char) {
                $digit = ctype_xdigit($char) ? hexdec($char) : 99;
                if ($digit >= $radix) {
                    return NAN;
                }
                $value = $value * $radix + $digit;
            }

            return $value;
        }
        if (! preg_match('/^[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)\z/', $s)) {
            return NAN;
        }

        return (float) $s;
    }

    /** Number::toString: the shortest digits that read back, laid out the JS way. */
    public static function numberString(float $n): string
    {
        if (is_nan($n)) {
            return 'NaN';
        }
        if (is_infinite($n)) {
            return $n > 0 ? 'Infinity' : '-Infinity';
        }
        if ($n == 0.0) {
            return '0';
        }
        if ($n < 0) {
            return '-'.self::numberString(-$n);
        }
        [$digits, $point] = self::shortestDigits($n);
        $k = strlen($digits);
        if ($k <= $point && $point <= 21) {
            return $digits.str_repeat('0', $point - $k);
        }
        if ($point > 0 && $point <= 21) {
            return substr($digits, 0, $point).'.'.substr($digits, $point);
        }
        if ($point > -6 && $point <= 0) {
            return '0.'.str_repeat('0', -$point).$digits;
        }
        $e = $point - 1;
        $mantissa = $k === 1 ? $digits : $digits[0].'.'.substr($digits, 1);

        return $mantissa.'e'.($e < 0 ? '-' : '+').abs($e);
    }

    /**
     * The fewest significant digits that read back as `$x`, and where the
     * point goes: `$x` is 0.d1d2…dk × 10^point.
     *
     * @return array{string, int}
     */
    private static function shortestDigits(float $x): array
    {
        $text = '';
        for ($precision = 0; $precision <= 16; $precision++) {
            $text = sprintf('%.'.$precision.'e', $x);
            if ((float) $text === $x) {
                break;
            }
        }
        [$mantissa, $exponent] = explode('e', $text);
        $digits = rtrim(str_replace('.', '', $mantissa), '0');

        return [$digits === '' ? '0' : $digits, (int) $exponent + 1];
    }

    /** `Number.prototype.toFixed`: the exact binary value, a tie rounded up. */
    public static function toFixed(float $n, int $decimals): string
    {
        $places = max(0, min(100, $decimals));
        if (is_nan($n)) {
            return 'NaN';
        }
        if (is_infinite($n) || abs($n) >= 1e21) {
            return self::numberString($n);
        }
        $x = abs($n);
        // -0.0001 keeps its sign ("-0.00"); negative zero doesn't.
        $sign = $n < 0 ? '-' : '';
        // sprintf rounds the exact value correctly except on an exact tie, where
        // it rounds half to even and JS rounds up. Extra digits show a true tie:
        // a "5000…" tail appears only for a value exactly halfway.
        $wide = sprintf('%.'.min($places + 30, 53).'f', $x);
        $dot = strpos($wide, '.');
        if ($dot !== false) {
            $tail = substr($wide, $dot + 1 + $places);
            if ($tail !== '' && $tail[0] === '5' && trim(substr($tail, 1), '0') === '') {
                $kept = substr($wide, 0, $places === 0 ? $dot : $dot + 1 + $places);

                return $sign.self::incrementLastDigit($kept);
            }
        }

        return $sign.sprintf('%.'.$places.'f', $x);
    }

    /** "0.12" → "0.13", "9.99" → "10.00", "99" → "100". */
    private static function incrementLastDigit(string $s): string
    {
        for ($i = strlen($s) - 1; $i >= 0; $i--) {
            if ($s[$i] === '.') {
                continue;
            }
            if ($s[$i] === '9') {
                $s[$i] = '0';

                continue;
            }
            $s[$i] = (string) ((int) $s[$i] + 1);

            return $s;
        }

        return '1'.$s;
    }

    /** `Math.round`: a half rounds toward +∞. */
    public static function round(float $x): float
    {
        if (! is_finite($x)) {
            return $x;
        }
        $floor = floor($x);

        return $x - $floor >= 0.5 ? $floor + 1 : $floor;
    }

    /** Toward zero, as `Math.trunc`. */
    public static function trunc(float $x): float
    {
        return $x < 0 ? ceil($x) : floor($x);
    }

    // ── Strings ─────────────────────────────────────────────────────────────

    /** `String.prototype.trim`. */
    public static function trim(string $s): string
    {
        return preg_replace('/^['.self::WHITESPACE.']+|['.self::WHITESPACE.']+$/u', '', $s) ?? trim($s);
    }

    public static function isWhitespace(string $char): bool
    {
        return preg_match('/^['.self::WHITESPACE.']\z/u', $char) === 1;
    }

    /** `String.prototype.toLowerCase` (final sigma and İ included). */
    public static function lower(string $s): string
    {
        return mb_strtolower($s, 'UTF-8');
    }

    /** `String.prototype.toUpperCase` (ß → SS included). */
    public static function upper(string $s): string
    {
        return mb_strtoupper($s, 'UTF-8');
    }

    /** `.length`: UTF-16 code units. */
    public static function length(string $s): int
    {
        return strlen(self::toUtf16($s)) >> 1;
    }

    /** `String.prototype.slice` over UTF-16 code units. */
    public static function slice(string $s, float $start, ?float $end = null): string
    {
        $units = self::toUtf16($s);
        $length = strlen($units) >> 1;
        $clamp = function (float $v) use ($length): int {
            if (is_nan($v)) {
                return 0;
            }
            $t = self::trunc($v);
            if ($t < 0) {
                return (int) max($length + $t, 0);
            }

            return (int) min($t, $length);
        };
        $from = $clamp($start);
        $to = $end === null ? $length : $clamp($end);
        if ($from >= $to) {
            return '';
        }

        return self::fromUtf16(substr($units, $from * 2, ($to - $from) * 2));
    }

    public static function toUtf16(string $s): string
    {
        return mb_convert_encoding($s, 'UTF-16LE', 'UTF-8');
    }

    /** UTF-16 big-endian: byte order is code-unit order, how JavaScript compares strings. */
    public static function toUtf16BigEndian(string $s): string
    {
        return mb_convert_encoding($s, 'UTF-16BE', 'UTF-8');
    }

    public static function fromUtf16(string $units): string
    {
        return mb_convert_encoding($units, 'UTF-8', 'UTF-16LE');
    }

    /** Tags stripped as `/<[^>]*>/g` → " ". */
    public static function stripTags(string $s): string
    {
        return preg_replace('/<[^>]*>/', ' ', $s) ?? $s;
    }

    /** `{name}` → value; unknown names stay as written. */
    public static function fill(string $template, array $values): string
    {
        return preg_replace_callback(
            '/\{([a-zA-Z]+)\}/',
            fn (array $m) => array_key_exists($m[1], $values) ? (string) $values[$m[1]] : $m[0],
            $template,
        ) ?? $template;
    }

    /** A value's text for a page: a string as is, a number as JS prints it, else "". */
    public static function text(mixed $value): string
    {
        return match (true) {
            is_string($value) => $value,
            is_int($value), is_float($value) => self::numberString((float) $value),
            default => '',
        };
    }
}
