<?php

namespace App\Bd\Forms;

use stdClass;

/**
 * `calculation` fields and business functions: ports of forms-core's
 * `calculation.ts` and `business-function.ts`.
 */
final class Calculation
{
    /** A form value as a formula input: blank is "no value", a list reads as its joined text. */
    public static function formulaValue(mixed $raw): mixed
    {
        if (Json::isBlank($raw)) {
            return null;
        }

        return Json::isList($raw) ? Js::string($raw) : $raw;
    }

    /**
     * Compute a calculation.
     *
     * @param  stdClass  $config  The field's `calculationConfig`.
     * @param  callable(string): mixed  $resolve  A field id → its value.
     * @param  array<string, stdClass>  $functionsById
     * @return array{ok: bool, value: mixed, outputs: ?array, error: ?string}
     */
    public static function compute(stdClass $config, callable $resolve, array $functionsById = [], array $userFunctions = []): array
    {
        $bindings = Json::list($config->inputMap ?? null) ?? [];
        if (($config->mode ?? null) === 'function') {
            $def = is_string($config->functionId ?? null) ? ($functionsById[$config->functionId] ?? null) : null;
            if ($def === null) {
                return ['ok' => false, 'value' => null, 'outputs' => null, 'error' => 'Referenced function not found.'];
            }
            $raw = [];
            foreach ($bindings as $b) {
                $raw[$b->variable] = $resolve($b->fieldId);
            }
            $run = self::runFunction($def, $raw, $userFunctions);
            $key = Json::str($config->outputKey ?? null) ?? Json::str(((Json::list($def->outputs ?? null) ?? [])[0] ?? null)?->key ?? null);

            return [
                'ok' => $run['ok'],
                'value' => $key !== null ? ($run['outputs'][$key] ?? null) : null,
                'outputs' => $run['outputs'],
                'error' => $run['ok'] ? null : implode('; ', $run['issues']),
            ];
        }
        $formula = is_string($config->formula ?? null) ? Js::trim($config->formula) : '';
        if ($formula === '') {
            return ['ok' => false, 'value' => null, 'outputs' => null, 'error' => 'No formula.'];
        }
        $vars = [];
        foreach ($bindings as $b) {
            $vars[$b->variable] = self::formulaValue($resolve($b->fieldId));
        }
        $r = Formula::run($formula, $vars, $userFunctions);

        return $r['ok']
            ? ['ok' => true, 'value' => $r['value'], 'outputs' => null, 'error' => null]
            : ['ok' => false, 'value' => null, 'outputs' => null, 'error' => $r['error']];
    }

    /** Prefix + value + suffix, with fixed decimals for numbers. */
    public static function format(mixed $value, ?stdClass $display): string
    {
        if ($value === null) {
            return '';
        }
        $decimals = $display?->decimals ?? null;
        $body = match (true) {
            Json::isNumber($value) && $decimals !== null && is_finite((float) $value) => Js::toFixed((float) $value, (int) $decimals),
            is_array($value), $value instanceof stdClass => Json::encode($value),
            default => Js::string($value),
        };

        return ($display?->prefix ?? '').$body.($display?->suffix ?? '');
    }

    private const ISO_DATE = '/^\d{4}-\d{2}-\d{2}([T ].*)?$/s';

    /** @return array{bool, mixed} [ok, value or reason] */
    private static function coerce(mixed $value, string $type): array
    {
        switch ($type) {
            case 'any':
                return [true, $value];
            case 'object':
                return $value instanceof stdClass ? [true, $value] : [false, 'expected an object'];
            case 'number':
                $n = Json::num($value) ?? Js::number($value);

                return is_nan($n) ? [false, 'not a number'] : [true, $n];
            case 'boolean':
                return match (true) {
                    is_bool($value) => [true, $value],
                    $value === 'true', Json::isNumber($value) && $value == 1 => [true, true],
                    $value === 'false', Json::isNumber($value) && $value == 0 => [true, false],
                    default => [false, 'not a boolean'],
                };
            case 'date':
                $s = Js::string($value);

                return preg_match(self::ISO_DATE, $s) && Dates::parseInstant($s) !== null ? [true, $s] : [false, 'not a date'];
            default:
                return [true, is_string($value) ? $value : Js::string($value)];
        }
    }

    private static function matches(mixed $value, string $type): bool
    {
        return match ($type) {
            'any' => true,
            'number' => Json::isNumber($value) && ! is_nan((float) $value),
            'text' => is_string($value),
            'boolean' => is_bool($value),
            'object' => $value instanceof stdClass,
            'date' => is_string($value) && preg_match(self::ISO_DATE, $value) === 1,
            default => false,
        };
    }

    /**
     * Run a business function: coerce and default its inputs, then evaluate
     * each output in order (later outputs read earlier ones), falling back
     * where an output fails or comes out the wrong type.
     *
     * @return array{ok: bool, outputs: array<string, mixed>, issues: list<string>}
     */
    public static function runFunction(stdClass $def, array $raw, array $userFunctions = []): array
    {
        $issues = [];
        $vars = [];
        foreach (Json::list($def->inputs ?? null) ?? [] as $input) {
            $value = $raw[$input->key] ?? null;
            if (Json::isBlank($value)) {
                if (($input->default ?? null) !== null) {
                    $vars[$input->key] = $input->default;
                } elseif (($input->required ?? null) === true) {
                    $issues[] = "input/{$input->key}: required value is missing";
                }

                continue;
            }
            [$ok, $result] = self::coerce($value, (string) $input->type);
            if ($ok) {
                $vars[$input->key] = $result;
            } else {
                $issues[] = "input/{$input->key}: {$result}";
            }
        }
        $outputs = [];
        foreach (Json::list($def->outputs ?? null) ?? [] as $out) {
            $r = Formula::run((string) $out->formula, $vars, $userFunctions);
            $fallback = function (string $reason) use ($out, &$outputs, &$vars, &$issues) {
                if (($out->fallback ?? null) !== null) {
                    $outputs[$out->key] = $out->fallback;
                    $vars[$out->key] = $out->fallback;
                } else {
                    $issues[] = "output/{$out->key}: {$reason}";
                }
            };
            if (! $r['ok']) {
                $fallback($r['error']);
            } elseif (self::matches($r['value'], (string) $out->type)) {
                $outputs[$out->key] = $r['value'];
                $vars[$out->key] = $r['value'];
            } else {
                $fallback("expected {$out->type}");
            }
        }

        return ['ok' => $issues === [], 'outputs' => $outputs, 'issues' => $issues];
    }
}
