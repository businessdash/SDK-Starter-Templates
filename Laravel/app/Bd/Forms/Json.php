<?php

namespace App\Bd\Forms;

use stdClass;

/**
 * Form values as JSON, the shape the forms engine reads them in.
 *
 * A form answer is not one PHP type: a text field holds a string, a checkbox
 * group a list, an address an object, a rating a number. So values stay JSON:
 *
 *  - an object is a `stdClass` (never an associative array, so `{}` and `[]`
 *    stay apart), a list is a PHP list;
 *  - a number is a float (an int read from JSON becomes its float);
 *  - `null` is JSON null.
 *
 * Values are treated as immutable: the engine builds new objects rather than
 * changing one in place, because a `stdClass` is shared by reference.
 */
final class Json
{
    /** Decode JSON text: objects as `stdClass`, whole numbers as floats. */
    public static function decode(string $text): mixed
    {
        return self::normalize(json_decode($text, false, 512, JSON_THROW_ON_ERROR));
    }

    /** Ints become floats and associative arrays objects, all the way down. */
    public static function normalize(mixed $value): mixed
    {
        if (is_int($value)) {
            return (float) $value;
        }
        if (is_array($value)) {
            if (array_is_list($value)) {
                return array_map(self::normalize(...), $value);
            }

            return self::objectFrom(array_map(self::normalize(...), $value));
        }
        if ($value instanceof stdClass) {
            $out = new stdClass;
            foreach (get_object_vars($value) as $key => $item) {
                $out->{(string) $key} = self::normalize($item);
            }

            return $out;
        }

        return $value;
    }

    /**
     * JSON text, the way JavaScript's `JSON.stringify` writes it: whole numbers
     * without a fraction, NaN and ±Infinity as null, slashes and non-ASCII as is.
     */
    public static function encode(mixed $value, int $flags = 0): string
    {
        $precision = ini_get('serialize_precision');
        ini_set('serialize_precision', '-1');
        try {
            return json_encode(
                self::wire($value),
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_LINE_TERMINATORS | JSON_THROW_ON_ERROR | $flags,
            );
        } finally {
            ini_set('serialize_precision', (string) $precision);
        }
    }

    /** What `json_encode` should see. */
    public static function wire(mixed $value): mixed
    {
        if (is_float($value)) {
            if (is_nan($value) || is_infinite($value)) {
                return null;
            }

            return floor($value) === $value && abs($value) < 9007199254740992.0 ? (int) $value : $value;
        }
        if (is_array($value)) {
            if (array_is_list($value)) {
                return array_map(self::wire(...), $value);
            }
            $value = self::objectFrom($value);
        }
        if ($value instanceof stdClass) {
            $out = new stdClass;
            foreach (get_object_vars($value) as $key => $item) {
                $out->{(string) $key} = self::wire($item);
            }

            return $out;
        }

        return $value;
    }

    // ── Building ────────────────────────────────────────────────────────────

    /** An object from a PHP map (keys made strings: PHP turns "1" into 1). */
    public static function objectFrom(array $map): stdClass
    {
        $out = new stdClass;
        foreach ($map as $key => $value) {
            $out->{(string) $key} = $value;
        }

        return $out;
    }

    /** An object's members as a PHP map. */
    public static function toMap(mixed $object): array
    {
        return $object instanceof stdClass ? get_object_vars($object) : [];
    }

    /** A copy of the object with one member set. */
    public static function with(stdClass $object, string $key, mixed $value): stdClass
    {
        $out = clone $object;
        $out->{$key} = $value;

        return $out;
    }

    // ── Reading ─────────────────────────────────────────────────────────────

    public static function isNumber(mixed $value): bool
    {
        return is_float($value) || is_int($value);
    }

    public static function isList(mixed $value): bool
    {
        return is_array($value) && array_is_list($value);
    }

    public static function isObject(mixed $value): bool
    {
        return $value instanceof stdClass;
    }

    /** A member of an object, or null when it's missing or the value isn't an object. */
    public static function get(mixed $object, string $key): mixed
    {
        return $object instanceof stdClass && property_exists($object, $key) ? $object->{$key} : null;
    }

    /** The object has the member (even when it's null). */
    public static function has(mixed $object, string $key): bool
    {
        return $object instanceof stdClass && property_exists($object, $key);
    }

    public static function str(mixed $value): ?string
    {
        return is_string($value) ? $value : null;
    }

    public static function num(mixed $value): ?float
    {
        return self::isNumber($value) ? (float) $value : null;
    }

    public static function bool(mixed $value): ?bool
    {
        return is_bool($value) ? $value : null;
    }

    /** @return list<mixed>|null */
    public static function list(mixed $value): ?array
    {
        return self::isList($value) ? $value : null;
    }

    public static function obj(mixed $value): ?stdClass
    {
        return $value instanceof stdClass ? $value : null;
    }

    /** @return list<string> The strings of a list, skipping anything else. */
    public static function strings(mixed $value): array
    {
        return self::isList($value) ? array_values(array_filter($value, 'is_string')) : [];
    }

    /** What JavaScript forms treat as "no answer": missing, null, and "". */
    public static function isBlank(mixed $value): bool
    {
        return $value === null || $value === '' || $value instanceof Undefined;
    }

    /** JSON equality: numbers by value, objects by members, lists in order. */
    public static function equal(mixed $a, mixed $b): bool
    {
        if (self::isNumber($a) && self::isNumber($b)) {
            return (float) $a === (float) $b;
        }
        if (is_array($a) && ! array_is_list($a)) {
            $a = self::objectFrom($a);
        }
        if (is_array($b) && ! array_is_list($b)) {
            $b = self::objectFrom($b);
        }
        if (is_array($a) && is_array($b)) {
            if (count($a) !== count($b)) {
                return false;
            }
            foreach ($a as $i => $item) {
                if (! self::equal($item, $b[$i])) {
                    return false;
                }
            }

            return true;
        }
        if ($a instanceof stdClass && $b instanceof stdClass) {
            $x = get_object_vars($a);
            $y = get_object_vars($b);
            if (count($x) !== count($y)) {
                return false;
            }
            foreach ($x as $key => $item) {
                if (! array_key_exists($key, $y) || ! self::equal($item, $y[$key])) {
                    return false;
                }
            }

            return true;
        }

        return $a === $b;
    }

    /** Two PHP maps of JSON values hold the same entries. */
    public static function sameMap(array $a, array $b): bool
    {
        return self::equal(self::objectFrom($a), self::objectFrom($b));
    }

    /** JavaScript truthiness. */
    public static function truthy(mixed $value): bool
    {
        return match (true) {
            $value === null, $value instanceof Undefined => false,
            is_bool($value) => $value,
            self::isNumber($value) => $value != 0 && ! is_nan((float) $value),
            is_string($value) => $value !== '',
            default => true,
        };
    }
}
