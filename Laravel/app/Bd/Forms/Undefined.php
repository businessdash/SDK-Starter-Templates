<?php

namespace App\Bd\Forms;

/**
 * JavaScript's `undefined`: a value a condition looked for and didn't find.
 *
 * Only conditions need it. `Number(undefined)` is NaN where `Number(null)` is
 * 0, so "less than 5" holds for a field answered with null and not for one
 * that isn't there at all.
 */
final class Undefined
{
    private static ?self $instance = null;

    private function __construct() {}

    public static function value(): self
    {
        return self::$instance ??= new self;
    }

    /** The map's entry, or undefined when the map has none. */
    public static function in(array $map, ?string $key): mixed
    {
        return $key !== null && array_key_exists($key, $map) ? $map[$key] : self::value();
    }
}
