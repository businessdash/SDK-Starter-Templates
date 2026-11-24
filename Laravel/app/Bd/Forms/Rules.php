<?php

namespace App\Bd\Forms;

use stdClass;

/**
 * BD's form rules, ported from the server validator
 * (`apps/web/src/server/forms/validate.ts`) and the shared condition module,
 * by way of the other native ports.
 *
 * The server is the authority: it runs all of this again on submit. Running
 * it here first means a visitor learns "this is required" or "that isn't an
 * email" next to the field, and is never told something the server would then
 * contradict. So these follow the server line for line, quirks included.
 *
 * Values are a PHP map, field id → JSON value (see `Json`).
 */
final class Rules
{
    // Limits (server validate.ts).
    private const MAX_STRING_LEN = 50_000;

    private const MAX_TEXTAREA_LEN = 200_000;

    public const MAX_ARRAY_LEN = 500;

    private const MAX_PHONE_LEN = 64;

    private const MAX_DATE_LEN = 64;

    private const MAX_ADDRESS_FIELD_LEN = 512;

    private const MAX_NAME_PART_LEN = 128;

    private const MAX_NAME_STRING_LEN = 1024;

    private const MAX_NICKNAMES = 20;

    private const MAX_FILE_FIELD_LEN = 4096;

    private const MAX_ICON_NAME_LEN = 64;

    private const MAX_RICH_TEXT_LEN = 20_000;

    private const MAX_KEYS = 500;

    private const NAME_VALUE_KEYS = ['prefix', 'first', 'middle', 'last', 'suffix', 'nicknames', 'full', 'short'];

    private const EMAIL = '/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u';

    private const URL = '/^(https?:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[\/?#]\S*)?$/iu';

    private const HEX_COLOR = '/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\z/';

    private const ICON_NAME = '/^[a-z0-9]+(?:-[a-z0-9]+)*\z/';

    private const MONTH_YEAR = '/^\d{4}-(0[1-9]|1[0-2])\z/';

    private const US_ZIP = '/^\d{5}(-\d{4})?\z/';

    /** At most this many files across every file field in one submission. */
    public const FORM_WIDE_MAX_FILES = 5;

    // ── Element types ───────────────────────────────────────────────────────

    public const STATIC_TYPES = ['title', 'subtitle', 'separator', 'image', 'richtext', 'body_text', 'bullet_list', 'table'];

    public const CONTAINER_TYPES = ['input_group', 'flex_row', 'condition_block', 'or_condition'];

    /** Never required-checked: layout, static copy, and values nobody types. */
    public const STATIC_OR_LAYOUT = [
        'title', 'subtitle', 'separator', 'flex_row', 'input_group', 'condition_block',
        'or_condition', 'image', 'richtext', 'body_text', 'bullet_list', 'table',
        'stepper', 'calculation', 'reference_value',
    ];

    /** Carry no submitted value at all. */
    public const LAYOUT_ONLY = [
        'title', 'subtitle', 'separator', 'flex_row', 'input_group', 'condition_block',
        'or_condition', 'image', 'richtext', 'body_text', 'bullet_list', 'table', 'reference_value',
    ];

    // ── Author regex ────────────────────────────────────────────────────────

    /**
     * An author's pattern as PCRE: a bare source or a `/source/flags` literal.
     * A broken pattern gives null and never blocks a submission.
     */
    public static function compileFieldRegex(string $raw): ?string
    {
        $trimmed = Js::trim($raw);
        $source = $trimmed;
        $flags = '';
        if (preg_match('~^/(.*)/([dgimsuvy]*)\z~s', $trimmed, $m)) {
            $source = $m[1];
            $flags = $m[2];
        }
        $modifiers = 'u'
            .(str_contains($flags, 'i') ? 'i' : '')
            .(str_contains($flags, 'm') ? 'm' : '')
            .(str_contains($flags, 's') ? 's' : '');
        foreach ([[$source, $modifiers], [$raw, 'u']] as [$pattern, $mods]) {
            $compiled = "\x01".$pattern."\x01".$mods;
            if (self::quietly(fn () => preg_match($compiled, '')) !== false) {
                return $compiled;
            }
        }

        return null;
    }

    public static function regexTest(string $compiled, string $value): bool
    {
        return self::quietly(fn () => preg_match($compiled, $value)) === 1;
    }

    /** Runs a preg_* call whose pattern an author wrote, without its compile warning reaching the log. */
    private static function quietly(\Closure $call): int|false
    {
        set_error_handler(static fn () => true);
        try {
            return $call();
        } finally {
            restore_error_handler();
        }
    }

    // ── Conditions ──────────────────────────────────────────────────────────

    public static function evalClause(mixed $value, string $op, string $target): bool
    {
        return match ($op) {
            'eq' => Js::string($value) === $target,
            'neq' => Js::string($value) !== $target,
            'contains' => str_contains(Js::lower(Js::string($value)), Js::lower($target)) || $target === '',
            'gt' => Js::number($value) > Js::parseNumber($target),
            'lt' => Js::number($value) < Js::parseNumber($target),
            'is_empty' => Json::isBlank($value),
            'is_not_empty' => ! Json::isBlank($value),
            default => true,
        };
    }

    /** @return list<array{string, string}> [operator, value] */
    public static function clauses(?stdClass $rule): array
    {
        $listed = Json::list($rule?->clauses ?? null) ?? [];
        if ($listed) {
            return array_map(fn ($c) => [(string) $c->operator, Json::str($c->value ?? null) ?? ''], $listed);
        }
        if (is_string($rule?->operator ?? null)) {
            return [[$rule->operator, Json::str($rule->value ?? null) ?? '']];
        }

        return [];
    }

    /**
     * Evaluate a rule. `$resolve` gives the value the rule compares — usually
     * the source field's, but a collection record's column with `matchField`.
     */
    public static function evalCondition(?stdClass $rule, callable $resolve): bool
    {
        if ($rule === null || ! is_string($rule->fieldId ?? null)) {
            return true;
        }
        $all = self::clauses($rule);
        if (! $all) {
            return true;
        }
        $value = $resolve($rule);
        $test = fn (array $c) => self::evalClause($value, $c[0], $c[1]);
        if (($rule->match ?? null) === 'any') {
            foreach ($all as $c) {
                if ($test($c)) {
                    return true;
                }
            }

            return false;
        }
        foreach ($all as $c) {
            if (! $test($c)) {
                return false;
            }
        }

        return true;
    }

    public static function evalConditionOn(?stdClass $rule, array $data): bool
    {
        return self::evalCondition($rule, fn (stdClass $r) => Undefined::in($data, Json::str($r->fieldId ?? null)));
    }

    /** Only a condition block or a group can be hidden by a rule. */
    public static function isNodeVisible(Field $node, callable $resolve): bool
    {
        if ($node->type !== 'condition_block' && $node->type !== 'input_group') {
            return true;
        }

        return self::evalCondition($node->rule(), $resolve);
    }

    /**
     * Single page: one step holding everything. Consecutive: each visible
     * top-level node is a step, so a hidden page is skipped, not shown blank.
     *
     * @param  list<Field>  $fields
     * @return list<list<Field>>
     */
    public static function computeSteps(array $fields, bool $consecutive, callable $resolve): array
    {
        if (! $consecutive) {
            return [$fields];
        }

        return array_values(array_map(
            fn (Field $f) => [$f],
            array_filter($fields, fn (Field $f) => self::isNodeVisible($f, $resolve)),
        ));
    }

    // ── Emptiness (server isEmpty) ──────────────────────────────────────────

    public static function isEmpty(Field $field, mixed $value): bool
    {
        $emptyList = fn () => ! Json::isList($value) || $value === [];
        $emptyString = fn () => ! is_string($value) || $value === '';
        switch ($field->type) {
            case 'checkbox':
            case 'tags':
            case 'file_upload':
                return $emptyList();
            case 'collection_select':
            case 'choice_cards':
                return $field->isMulti() ? $emptyList() : $emptyString();
            case 'rich_text_input':
                return ! is_string($value) || Js::trim(preg_replace('/<[^>]*>/', '', $value) ?? $value) === '';
            case 'month_year':
                return $emptyString();
            case 'boolean':
                // Consent: empty unless exactly true. Otherwise any explicit choice is an answer.
                return $field->mustBeTrue() ? $value !== true : ! is_bool($value);
            case 'schedule':
                $slot = is_string(Json::get($value, 'slotStartAt')) && Json::get($value, 'slotStartAt') !== '';
                $asap = Json::get($value, 'asap') === true;
                $days = (Json::list(Json::get($value, 'days')) ?? []) !== [];
                $times = (Json::list(Json::get($value, 'times')) ?? []) !== [];

                return ! ($slot || $asap || $days || $times);
            case 'multi_populator':
                if (! Json::isList($value)) {
                    return true;
                }
                foreach ($value as $instance) {
                    if (self::instanceHasValue($instance)) {
                        return false;
                    }
                }

                return true;
            case 'date_range':
                return self::isFalsy(Json::get($value, 'start')) || self::isFalsy(Json::get($value, 'end'));
            case 'address':
                return self::isFalsy(Json::get($value, 'line1')) || self::isFalsy(Json::get($value, 'city'))
                    || self::isFalsy(Json::get($value, 'state')) || self::isFalsy(Json::get($value, 'zip'));
            case 'name':
                $first = Js::trim(Json::str(Json::get($value, 'first')) ?? '');
                $last = Js::trim(Json::str(Json::get($value, 'last')) ?? '');

                return $first === '' || $last === '';
            case 'time_picker':
                return match ($field->timeMode()) {
                    'time_block' => self::isFalsy(Json::get($value, 'start')) || self::isFalsy(Json::get($value, 'end')),
                    'appointment' => self::isFalsy(Json::get($value, 'date')) || self::isFalsy(Json::get($value, 'time')),
                    default => Json::isBlank($value),
                };
            case 'star_rating':
                return ! Json::isNumber($value) || $value <= 0;
            case 'happiness_rating':
                // 0 is a real answer (😞 very unhappy), not a missing one.
                return ! Json::isNumber($value);
            case 'measurement':
                return ! Json::isNumber(Json::get($value, 'value'));
            case 'url':
                $url = Json::get($value, 'url');

                return ! is_string($url) || $url === '';
            default:
                return Json::isBlank($value);
        }
    }

    /** JavaScript falsiness, for the server's `!v?.x` checks. */
    public static function isFalsy(mixed $v): bool
    {
        return match (true) {
            $v === null => true,
            is_bool($v) => ! $v,
            Json::isNumber($v) => $v == 0 || is_nan((float) $v),
            is_string($v) => $v === '',
            default => false,
        };
    }

    public static function instanceHasValue(mixed $instance): bool
    {
        if (! $instance instanceof stdClass) {
            return false;
        }
        foreach (get_object_vars($instance) as $v) {
            if ($v === null) {
                continue;
            }
            if (is_string($v) ? $v !== '' : (Json::isList($v) ? $v !== [] : true)) {
                return true;
            }
        }

        return false;
    }

    // ── Value validation (server validateValue) ─────────────────────────────

    /**
     * Why a non-empty value doesn't fit its field, or null when it does. The
     * reasons are the server's: type, format, min, max, options, regex,
     * business_email. Empty values pass; required-ness is the required walk's.
     */
    public static function validateValue(Field $field, mixed $value): ?string
    {
        if (Json::isBlank($value)) {
            return null;
        }
        $opts = $field->options();
        $len = Js::length(...);

        switch ($field->type) {
            case 'email':
                if (! is_string($value)) {
                    return 'type';
                }
                if ($len($value) > self::MAX_STRING_LEN) {
                    return 'max';
                }
                if (! preg_match(self::EMAIL, $value)) {
                    return 'format';
                }
                if ($field->config('emailConfig', 'businessOnly') === true && self::isConsumerEmailDomain(self::emailDomain($value) ?? '')) {
                    return 'business_email';
                }

                return null;
            case 'url':
                if (! $value instanceof stdClass) {
                    return 'type';
                }
                $u = Json::get($value, 'url');
                if (Json::isBlank($u)) {
                    return null;
                }
                if (! is_string($u)) {
                    return 'type';
                }
                if ($len($u) > self::MAX_STRING_LEN) {
                    return 'max';
                }
                if (! preg_match(self::URL, Js::trim($u))) {
                    return 'format';
                }
                if (Json::has($value, 'verified') && ! in_array(Json::get($value, 'verified'), ['unverified', 'safe', 'unsafe'], true)) {
                    return 'options';
                }

                return self::onlyBoundedPrimitives($value, self::MAX_STRING_LEN) ? null : 'type';
            case 'phone':
                if (! is_string($value)) {
                    return 'type';
                }
                if ($len($value) > self::MAX_PHONE_LEN) {
                    return 'max';
                }
                if ($rx = self::regexFail($field, $value)) {
                    return $rx;
                }
                $digits = preg_replace('/[^0-9]/', '', $value);
                if ($field->config('phoneConfig', 'international') === true) {
                    return strlen($digits) >= 7 && strlen($digits) <= 15 ? null : 'format';
                }
                $national = strlen($digits) === 11 && $digits[0] === '1' ? substr($digits, 1) : $digits;

                return strlen($national) === 10 ? null : 'format';
            case 'number':
            case 'slider':
            case 'stepper':
                if (Json::isNumber($value)) {
                    $n = (float) $value;
                } elseif (is_string($value) && Js::trim($value) !== '' && ! is_nan(Js::parseNumber($value))) {
                    $n = Js::parseNumber($value);
                } else {
                    return 'type';
                }
                if ($field->type === 'number' && $field->bool('allowDecimal') === false && round($n) !== $n) {
                    return 'format';
                }
                if ($field->type === 'number' && $field->bool('allowNegative') === false && $n < 0) {
                    return 'min';
                }
                $min = Json::num($field->config('validation', 'min')) ?? Json::num($field->config('sliderConfig', 'min'));
                $max = Json::num($field->config('validation', 'max')) ?? Json::num($field->config('sliderConfig', 'max'));
                if ($min !== null && $n < $min) {
                    return 'min';
                }
                if ($max !== null && $n > $max) {
                    return 'max';
                }

                return null;
            case 'star_rating':
                if (! Json::isNumber($value)) {
                    return 'type';
                }
                $maxStars = Json::num($field->config('starRatingConfig', 'maxStars')) ?? 5.0;

                return $value < 0 || $value > $maxStars + 0.0001 ? 'max' : null;
            case 'happiness_rating':
                // Five faces valued 0–4; nothing else is a face.
                if (! Json::isNumber($value)) {
                    return 'type';
                }

                return round((float) $value) !== (float) $value || $value < 0 || $value > 4 ? 'options' : null;
            case 'boolean':
                return is_bool($value) ? null : 'type';
            case 'select':
            case 'radio':
                if (! is_string($value)) {
                    return 'type';
                }
                if ($len($value) > self::MAX_STRING_LEN) {
                    return 'max';
                }
                if ($opts !== null && $field->bool('allowCustom') !== true && ! in_array($value, $opts, true)) {
                    return 'options';
                }

                return null;
            case 'collection_select':
                if ($field->isMulti()) {
                    return self::stringList($value, fn (string $s) => $len($s) > self::MAX_STRING_LEN ? 'max' : null);
                }
                if (! is_string($value)) {
                    return 'type';
                }

                return $len($value) > self::MAX_STRING_LEN ? 'max' : null;
            case 'rich_text_input':
                if (! is_string($value)) {
                    return 'type';
                }

                return $len($value) > self::MAX_RICH_TEXT_LEN ? 'max' : null;
            case 'month_year':
                if (! is_string($value)) {
                    return 'type';
                }

                return preg_match(self::MONTH_YEAR, $value) ? null : 'format';
            case 'color_picker':
                if (! is_string($value)) {
                    return 'type';
                }

                return preg_match(self::HEX_COLOR, $value) ? null : 'format';
            case 'icon_select':
                if (! is_string($value)) {
                    return 'type';
                }
                if ($len($value) > self::MAX_ICON_NAME_LEN) {
                    return 'max';
                }
                if (! preg_match(self::ICON_NAME, $value)) {
                    return 'format';
                }
                $allowed = Json::strings($field->config('iconConfig', 'allowedIcons'));

                return $allowed && ! in_array($value, $allowed, true) ? 'options' : null;
            case 'image_input':
                if (! is_string($value)) {
                    return 'type';
                }
                if ($len($value) > self::MAX_STRING_LEN) {
                    return 'max';
                }

                return preg_match(self::URL, Js::trim($value)) ? null : 'format';
            case 'tags':
                return self::stringList($value, fn (string $s) => $len($s) > self::MAX_STRING_LEN ? 'max' : null);
            case 'checkbox':
                return self::stringList($value, fn (string $s) => $opts !== null && $field->bool('allowCustom') !== true && ! in_array($s, $opts, true) ? 'options' : null);
            case 'service_selector':
                $offered = array_map(fn ($o) => $o->id, Json::list($field->config('serviceConfig', 'options')) ?? []);

                return self::stringList($value, fn (string $s) => $offered && ! in_array($s, $offered, true) ? 'options' : null);
            case 'choice_cards':
                $labels = array_map(fn ($o) => $o->label, $field->cards());
                $check = fn (string $s) => $labels && ! in_array($s, $labels, true) ? 'options' : null;
                if ($field->isMulti()) {
                    return self::stringList($value, $check);
                }
                if (! is_string($value)) {
                    return 'type';
                }
                if ($len($value) > self::MAX_STRING_LEN) {
                    return 'max';
                }

                return $check($value);
            case 'file_upload':
                if (! Json::isList($value)) {
                    return 'type';
                }
                $maxFiles = min((int) (Json::num($field->config('fileConfig', 'maxFiles')) ?? self::MAX_ARRAY_LEN), self::MAX_ARRAY_LEN);
                if (count($value) > $maxFiles) {
                    return 'max';
                }
                foreach ($value as $item) {
                    if (! $item instanceof stdClass || ! self::onlyBoundedPrimitives($item, self::MAX_FILE_FIELD_LEN)) {
                        return 'type';
                    }
                }

                return null;
            case 'currency':
                if (! Json::isNumber($value) || is_nan((float) $value)) {
                    return 'type';
                }
                if ($field->config('currencyConfig', 'allowNegative') !== true && $value < 0) {
                    return 'format';
                }
                if ($field->config('currencyConfig', 'allowDecimal') === false && round((float) $value) !== (float) $value) {
                    return 'format';
                }

                return null;
            case 'measurement':
                if (! $value instanceof stdClass) {
                    return 'type';
                }
                if (Json::isBlank(Json::get($value, 'value'))) {
                    return null;
                }
                $n = Json::num(Json::get($value, 'value'));
                if ($n === null || is_nan($n)) {
                    return 'type';
                }
                $unit = Json::str(Json::get($value, 'unit'));
                if ($unit === null) {
                    return 'type';
                }
                $category = Units::category(Json::str($field->config('unitConfig', 'category')));
                if ($category !== null && ! Units::contains($category, $unit)) {
                    return 'options';
                }
                if ($field->config('unitConfig', 'allowDecimal') === false && round($n) !== $n) {
                    return 'format';
                }

                return self::onlyBoundedPrimitives($value, self::MAX_DATE_LEN) ? null : 'type';
            case 'multi_populator':
                if (! Json::isList($value)) {
                    return 'type';
                }
                $maxInstances = min((int) (Json::num($field->config('populatorConfig', 'maxInstances')) ?? 10), self::MAX_ARRAY_LEN);
                if (count($value) > $maxInstances) {
                    return 'max';
                }
                $known = self::instanceValueFields($field->children ?? []);
                foreach ($value as $instance) {
                    if (! $instance instanceof stdClass) {
                        return 'type';
                    }
                    $entries = get_object_vars($instance);
                    if (count($entries) > self::MAX_KEYS) {
                        return 'max';
                    }
                    foreach ($entries as $key => $v) {
                        $child = $known[(string) $key] ?? null;
                        if ($child === null) {
                            return 'options';
                        }
                        if ($reason = self::validateValue($child, $v)) {
                            return ($child->label === '' ? $key : $child->label).': '.$reason;
                        }
                    }
                }

                return null;
            case 'date_range':
                if (! $value instanceof stdClass) {
                    return 'type';
                }

                return self::onlyBoundedPrimitives($value, self::MAX_DATE_LEN) ? null : 'type';
            case 'time_picker':
                if ($field->timeMode() === 'simple') {
                    if (! is_string($value)) {
                        return 'type';
                    }

                    return $len($value) > self::MAX_DATE_LEN ? 'max' : null;
                }
                if (! $value instanceof stdClass) {
                    return 'type';
                }

                return self::onlyBoundedPrimitives($value, self::MAX_DATE_LEN) ? null : 'type';
            case 'address':
                if (! $value instanceof stdClass) {
                    return 'type';
                }
                if (! self::onlyBoundedPrimitives($value, self::MAX_ADDRESS_FIELD_LEN)) {
                    return 'type';
                }
                $zip = Json::get($value, 'zip');

                return is_string($zip) && ! self::isValidUSZip($zip) ? 'format' : null;
            case 'name':
                if (! $value instanceof stdClass) {
                    return 'type';
                }
                foreach (get_object_vars($value) as $key => $v) {
                    $key = (string) $key;
                    if (! in_array($key, self::NAME_VALUE_KEYS, true)) {
                        return 'options';
                    }
                    if ($key === 'nicknames' || $v === null) {
                        continue;
                    }
                    if (! is_string($v)) {
                        return 'type';
                    }
                    $cap = $key === 'full' || $key === 'short' ? self::MAX_NAME_STRING_LEN : self::MAX_NAME_PART_LEN;
                    if ($len($v) > $cap) {
                        return 'max';
                    }
                }
                $nicknames = Json::get($value, 'nicknames');
                if ($nicknames === null) {
                    return null;
                }
                if (is_string($nicknames)) {
                    return $len($nicknames) > self::MAX_NAME_STRING_LEN ? 'max' : null;
                }
                if (! Json::isList($nicknames)) {
                    return 'type';
                }
                if (count($nicknames) > self::MAX_NICKNAMES) {
                    return 'max';
                }
                foreach ($nicknames as $item) {
                    if (! is_string($item)) {
                        return 'type';
                    }
                    if ($len($item) > self::MAX_NAME_PART_LEN) {
                        return 'max';
                    }
                }

                return null;
            case 'schedule':
                if (! $value instanceof stdClass) {
                    return 'type';
                }
                if (Json::has($value, 'slotStartAt')) {
                    $slot = $value->slotStartAt;
                    if (! is_string($slot)) {
                        return 'type';
                    }
                    if ($len($slot) > self::MAX_DATE_LEN) {
                        return 'max';
                    }
                    if (Dates::parseInstant($slot) === null) {
                        return 'format';
                    }
                }
                if (Json::has($value, 'asap') && ! is_bool($value->asap)) {
                    return 'type';
                }
                foreach (['days', 'times'] as $key) {
                    if (! Json::has($value, $key)) {
                        continue;
                    }
                    if ($reason = self::stringList($value->{$key}, fn (string $s) => $len($s) > self::MAX_DATE_LEN ? 'max' : null)) {
                        return $reason;
                    }
                }
                if (Json::has($value, 'notes')) {
                    if (! is_string($value->notes)) {
                        return 'type';
                    }
                    if ($len($value->notes) > self::MAX_STRING_LEN) {
                        return 'max';
                    }
                }

                return null;
            default:
                // text / textarea / date / any plain-text input.
                if (Json::isNumber($value) || is_bool($value)) {
                    return null;
                }
                if (! is_string($value)) {
                    return 'type';
                }
                if ($len($value) > ($field->type === 'textarea' ? self::MAX_TEXTAREA_LEN : self::MAX_STRING_LEN)) {
                    return 'max';
                }

                return self::regexFail($field, $value);
        }
    }

    /** A list of strings, each passing `$check`: the first reason, else null. */
    private static function stringList(mixed $value, callable $check): ?string
    {
        if (! Json::isList($value)) {
            return 'type';
        }
        if (count($value) > self::MAX_ARRAY_LEN) {
            return 'max';
        }
        foreach ($value as $item) {
            if (! is_string($item)) {
                return 'type';
            }
            if ($reason = $check($item)) {
                return $reason;
            }
        }

        return null;
    }

    public static function regexFail(Field $field, string $value): ?string
    {
        $pattern = $field->str('regexPattern');
        if ($pattern === null || $pattern === '' || ($compiled = self::compileFieldRegex($pattern)) === null) {
            return null;
        }

        return self::regexTest($compiled, $value) ? null : 'regex';
    }

    private static function onlyBoundedPrimitives(stdClass $obj, int $maxLen): bool
    {
        foreach (get_object_vars($obj) as $v) {
            if ($v === null || Json::isNumber($v) || is_bool($v)) {
                continue;
            }
            if (! is_string($v) || Js::length($v) > $maxLen) {
                return false;
            }
        }

        return true;
    }

    /**
     * Value-bearing fields inside a repeater, keyed by id and output key.
     *
     * @param  list<Field>  $children
     * @return array<string, Field>
     */
    public static function instanceValueFields(array $children): array
    {
        $out = [];
        $walk = function (array $nodes) use (&$walk, &$out) {
            foreach ($nodes as $f) {
                if (! in_array($f->type, self::LAYOUT_ONLY, true)) {
                    $out[$f->id] = $f;
                    if ($f->key() !== null) {
                        $out[$f->key()] = $f;
                    }
                }
                if ($f->type !== 'multi_populator' && $f->children !== null) {
                    $walk($f->children);
                }
            }
        };
        $walk($children);

        return $out;
    }

    /** A US ZIP (5 digits or ZIP+4), or nothing: a blank address has no ZIP to check. */
    public static function isValidUSZip(string $zip): bool
    {
        $z = Js::trim($zip);

        return $z === '' || preg_match(self::US_ZIP, $z) === 1;
    }

    public static function emailDomain(string $email): ?string
    {
        $at = strrpos($email, '@');
        if ($at === false || $at === strlen($email) - 1) {
            return null;
        }

        return Js::lower(Js::trim(substr($email, $at + 1)));
    }

    public static function isConsumerEmailDomain(string $host): bool
    {
        $h = Js::lower(Js::trim($host));

        return isset(FormsData::CONSUMER_EMAIL_DOMAINS[$h]) || str_ends_with($h, '.gmail.com') || str_ends_with($h, '.googlemail.com');
    }

    // ── Required walk (server findMissingRequiredFields) ────────────────────

    /**
     * Every required field with no answer under the current conditions:
     * hidden blocks and pages enforce nothing, an either/or needs one side, a
     * required repeater needs an entry and each filled entry its own required
     * fields, and consent must be true.
     *
     * @param  list<Field>  $fields
     * @return list<array{id: string, label: string, path: string}>
     */
    public static function findMissingRequired(array $fields, array $data, ?callable $resolveMatch = null): array
    {
        $derived = self::withDerivedFieldValues($fields, self::deriveReferenceValues($fields, $data));
        $missing = [];
        self::walkRequired($fields, $derived, '', $resolveMatch, $missing);

        return $missing;
    }

    /** What a condition compares, in this scope (a collection column via `$resolveMatch`). */
    public static function resolver(array $scope, ?callable $resolveMatch): \Closure
    {
        return function (stdClass $rule) use ($scope, $resolveMatch) {
            $raw = Undefined::in($scope, Json::str($rule->fieldId ?? null) ?? '');
            if (! is_string($rule->matchField ?? null) || $resolveMatch === null) {
                return $raw;
            }

            return $resolveMatch($rule, $raw);
        };
    }

    private static function walkRequired(array $nodes, array $scope, string $prefix, ?callable $resolveMatch, array &$missing): void
    {
        $resolve = self::resolver($scope, $resolveMatch);
        foreach ($nodes as $f) {
            switch ($f->type) {
                case 'condition_block':
                    if (self::evalCondition($f->rule(), $resolve)) {
                        self::walkRequired($f->children ?? [], $scope, $prefix, $resolveMatch, $missing);
                    }
                    break;
                case 'or_condition':
                    $children = $f->children ?? [];
                    $filled = array_map(fn (Field $c) => self::subtreeHasValue([$c], $scope, $resolveMatch), $children);
                    if ($children && ! in_array(true, $filled, true)) {
                        $missing[] = ['id' => $f->id, 'label' => $f->label === '' ? 'Either side required' : $f->label, 'path' => $prefix.$f->id];
                        break;
                    }
                    foreach ($children as $i => $child) {
                        if ($filled[$i]) {
                            self::walkRequired([$child], $scope, $prefix, $resolveMatch, $missing);
                        }
                    }
                    break;
                case 'input_group':
                case 'flex_row':
                    if (self::isNodeVisible($f, $resolve)) {
                        self::walkRequired($f->children ?? [], $scope, $prefix, $resolveMatch, $missing);
                    }
                    break;
                case 'multi_populator':
                    $filled = [];
                    foreach (Json::list($scope[$f->id] ?? null) ?? [] as $index => $instance) {
                        if ($instance instanceof stdClass && self::instanceHasValue($instance)) {
                            $filled[$index] = $instance;
                        }
                    }
                    if ($f->required && ! $filled) {
                        $missing[] = ['id' => $f->id, 'label' => $f->label === '' ? 'At least one entry required' : $f->label, 'path' => $prefix.$f->id];
                        break;
                    }
                    foreach ($filled as $index => $instance) {
                        self::walkRequired($f->children ?? [], get_object_vars($instance), "{$prefix}{$f->id}[{$index}].", $resolveMatch, $missing);
                    }
                    break;
                default:
                    if (in_array($f->type, self::STATIC_OR_LAYOUT, true)) {
                        break;
                    }
                    if (($f->required || $f->mustBeTrue()) && self::isEmpty($f, $scope[$f->id] ?? null)) {
                        $missing[] = ['id' => $f->id, 'label' => $f->label === '' ? 'Untitled' : $f->label, 'path' => $prefix.$f->id];
                    }
            }
        }
    }

    /** Does any value-bearing leaf under these nodes hold an answer? (Which side of an either/or.) */
    public static function subtreeHasValue(array $nodes, array $data, ?callable $resolveMatch = null): bool
    {
        $resolve = self::resolver($data, $resolveMatch);
        foreach ($nodes as $f) {
            switch ($f->type) {
                case 'condition_block':
                    if (self::evalCondition($f->rule(), $resolve) && self::subtreeHasValue($f->children ?? [], $data, $resolveMatch)) {
                        return true;
                    }
                    break;
                case 'or_condition':
                case 'input_group':
                case 'flex_row':
                    if (self::isNodeVisible($f, $resolve) && self::subtreeHasValue($f->children ?? [], $data, $resolveMatch)) {
                        return true;
                    }
                    break;
                default:
                    if (! in_array($f->type, self::STATIC_OR_LAYOUT, true) && ! self::isEmpty($f, $data[$f->id] ?? null)) {
                        return true;
                    }
            }
        }

        return false;
    }

    /** Concurrent reveal: children up to and including the first still missing an answer. */
    public static function concurrentRevealCount(array $children, array $data): int
    {
        foreach ($children as $i => $child) {
            if (self::findMissingRequired([$child], $data)) {
                return $i + 1;
            }
        }

        return count($children);
    }

    // ── Derived values ──────────────────────────────────────────────────────

    /** Hidden `reference_value` elements mirror their source once it's complete (else null). */
    public static function deriveReferenceValues(array $fields, array $data): array
    {
        $byId = self::fieldsById($fields);
        $out = $data;
        foreach ($byId as $f) {
            if ($f->type !== 'reference_value') {
                continue;
            }
            $derived = null;
            $sourceId = $f->str('referenceFieldId');
            $source = $sourceId !== null ? ($byId[$sourceId] ?? null) : null;
            if ($source !== null && ! self::isEmpty($source, $data[$sourceId] ?? null)) {
                $val = $data[$sourceId] ?? null;
                $ok = true;
                $pattern = $source->str('regexPattern');
                if ($pattern !== null && $pattern !== '' && ($compiled = self::compileFieldRegex($pattern)) !== null) {
                    $ok = self::regexTest($compiled, Js::string($val));
                }
                if ($ok) {
                    $derived = $val;
                }
            }
            $out[$f->id] = $derived;
        }

        return $out;
    }

    /**
     * One derived value per exploded checkbox option (`id::optionKey`),
     * month/year part (`id::year`) and name part (`id::first`), so a
     * condition can point at any of them.
     */
    public static function withDerivedFieldValues(array $fields, array $data): array
    {
        $out = $data;
        foreach (self::fieldsById($fields) as $field) {
            $options = $field->options();
            if ($field->type === 'checkbox' && $field->bool('explodeOptions') === true && $options) {
                $picked = Json::strings($data[$field->id] ?? null);
                foreach (self::checkboxOptionKeys(self::keyBase($field), $options) as [$key, $option]) {
                    $out["{$field->id}::{$key}"] = in_array($option, $picked, true);
                }
            }
            if ($field->type === 'month_year' && $field->bool('explodeMonthYear') === true) {
                $parts = self::monthYearParts($data[$field->id] ?? null);
                $out["{$field->id}::year"] = $parts ? (float) $parts[0] : null;
                $out["{$field->id}::month"] = $parts ? (float) $parts[1] : null;
            }
            if ($field->type === 'name') {
                $parts = ['first', 'last', 'full', 'short'];
                foreach (['prefix', 'middle', 'suffix', 'nicknames'] as $optional) {
                    if ($field->config('nameConfig', $optional) === true) {
                        $parts[] = $optional;
                    }
                }
                foreach ($parts as $part) {
                    $out["{$field->id}::{$part}"] = self::namePartValue($data[$field->id] ?? null, $part);
                }
            }
        }

        return $out;
    }

    private static function keyBase(Field $field): string
    {
        return $field->str('outputKey') ?? self::toOutputKey($field->label);
    }

    /** @return array{int, int}|null */
    private static function monthYearParts(mixed $raw): ?array
    {
        if (! is_string($raw) || ! preg_match('/^(\d{4})-(\d{1,2})\z/', Js::trim($raw), $m)) {
            return null;
        }

        return [(int) $m[1], (int) $m[2]];
    }

    private static function namePartValue(mixed $raw, string $part): ?string
    {
        if (! $raw instanceof stdClass) {
            return null;
        }
        $own = Json::str(Json::get($raw, $part));
        switch ($part) {
            case 'prefix':
            case 'first':
            case 'middle':
            case 'last':
            case 'suffix':
                return $own !== null && $own !== '' ? $own : null;
            case 'full':
            case 'short':
                if ($own !== null && $own !== '') {
                    return $own;
                }
                $composed = $part === 'full' ? self::composeFullName($raw) : self::composeShortName($raw);

                return $composed === '' ? null : $composed;
            case 'nicknames':
                $list = Json::list(Json::get($raw, 'nicknames'));

                return $list ? implode(', ', array_map(Js::string(...), $list)) : null;
            default:
                return null;
        }
    }

    /**
     * Every node by id, containers and repeaters' children included.
     *
     * @return array<string, Field>
     */
    public static function fieldsById(array $fields): array
    {
        $out = [];
        $walk = function (array $nodes) use (&$walk, &$out) {
            foreach ($nodes as $f) {
                $out[$f->id] = $f;
                if ($f->children !== null) {
                    $walk($f->children);
                }
            }
        };
        $walk($fields);

        return $out;
    }

    // ── Output keys ─────────────────────────────────────────────────────────

    /** "Best time to reach:" → "bestTimeToReach"; "" when the label has nothing usable. */
    public static function toOutputKey(string $raw): string
    {
        $words = array_values(array_filter(explode(' ', preg_replace('/[^a-zA-Z0-9]+/', ' ', $raw) ?? ''), fn ($w) => $w !== ''));
        if (! $words) {
            return '';
        }
        $key = '';
        foreach ($words as $i => $w) {
            $key .= $i === 0 ? strtolower($w) : strtoupper($w[0]).strtolower(substr($w, 1));
        }

        return ctype_digit($key[0]) ? '_'.$key : $key;
    }

    /** @return list<array{string, string}> [key, option] */
    private static function checkboxOptionKeys(string $fieldKey, array $options): array
    {
        $used = [];
        $out = [];
        foreach ($options as $option) {
            $optKey = self::toOutputKey($option) === '' ? 'option' : self::toOutputKey($option);
            $key = $fieldKey.strtoupper($optKey[0]).substr($optKey, 1);
            if (isset($used[$key])) {
                $n = 2;
                while (isset($used["{$key}{$n}"])) {
                    $n++;
                }
                $key = "{$key}{$n}";
            }
            $used[$key] = true;
            $out[] = [$key, $option];
        }

        return $out;
    }

    // ── Names ───────────────────────────────────────────────────────────────

    private const NAME_PART_ORDER = ['prefix', 'first', 'middle', 'last', 'suffix'];

    private static function composeName(stdClass $v, array $parts): string
    {
        $out = [];
        foreach ($parts as $part) {
            $s = Json::str(Json::get($v, $part));
            if ($s !== null && ($s = Js::trim($s)) !== '') {
                $out[] = $s;
            }
        }

        return implode(' ', $out);
    }

    private static function composeFullName(stdClass $v): string
    {
        return self::composeName($v, self::NAME_PART_ORDER);
    }

    private static function composeShortName(stdClass $v): string
    {
        return self::composeName($v, ['first', 'last']);
    }

    /** Trimmed parts, nicknames split into a list, `full`/`short` recomputed. */
    public static function normalizeNameValue(mixed $raw): mixed
    {
        if (! $raw instanceof stdClass) {
            return $raw;
        }
        $out = new stdClass;
        foreach (self::NAME_PART_ORDER as $key) {
            $s = Json::str(Json::get($raw, $key));
            if ($s !== null && ($s = Js::trim($s)) !== '') {
                $out->{$key} = $s;
            }
        }
        $nicknames = Json::get($raw, 'nicknames');
        $list = match (true) {
            is_string($nicknames) => explode(',', $nicknames),
            Json::isList($nicknames) => Json::strings($nicknames),
            default => [],
        };
        $list = array_values(array_filter(array_map(Js::trim(...), $list), fn ($s) => $s !== ''));
        if ($list) {
            $out->nicknames = $list;
        }
        $out->full = self::composeFullName($out);
        $out->short = self::composeShortName($out);

        return $out;
    }

    // ── Seed + payload ──────────────────────────────────────────────────────

    private const NO_SEED_STATIC = [
        'title', 'subtitle', 'separator', 'image', 'richtext', 'body_text', 'bullet_list', 'table',
        'calculation', 'reference_value',
    ];

    private const STEP_CONTAINERS = ['input_group', 'condition_block', 'or_condition'];

    /** Starting values: what each element shows before the visitor touches it. */
    public static function seedInitialData(array $fields): array
    {
        $out = [];
        $walk = function (array $nodes) use (&$walk, &$out) {
            foreach ($nodes as $f) {
                if ($f->type === 'multi_populator') {
                    $out[$f->id] = self::defaultValue($f);

                    continue;
                }
                if (! in_array($f->type, self::NO_SEED_STATIC, true) && ! in_array($f->type, self::STEP_CONTAINERS, true)
                    && $f->type !== 'flex_row' && ($value = self::defaultValue($f)) !== null) {
                    $out[$f->id] = $value;
                }
                if ($f->children !== null) {
                    $walk($f->children);
                }
            }
        };
        $walk($fields);

        return $out;
    }

    /** A field's starting value, or null for one that starts unanswered. */
    public static function defaultValue(Field $field): mixed
    {
        switch ($field->type) {
            case 'checkbox':
            case 'tags':
                return [];
            case 'choice_cards':
                return $field->isMulti() ? [] : '';
            case 'multi_populator':
                return [new stdClass];
            case 'measurement':
                $category = Units::categoryOf($field);

                return Json::objectFrom([
                    'value' => '',
                    'unit' => Json::str($field->config('unitConfig', 'defaultUnit')) ?? ($category['units'][0][0] ?? ''),
                    'baseUnit' => $category['baseUnit'],
                ]);
            case 'boolean':
                return $field->defaultValue() === true;
            case 'number':
            case 'stepper':
            case 'star_rating':
                return 0.0;
            case 'slider':
                // Start where the thumb is drawn.
                return Json::num($field->config('sliderConfig', 'min')) ?? 0.0;
            case 'happiness_rating':
                // 0 is a real answer (😞): an unanswered rating stays unset.
                return null;
            case 'date_range':
                return Json::objectFrom(['start' => '', 'end' => '']);
            case 'time_picker':
                return match ($field->timeMode()) {
                    'time_block' => Json::objectFrom(['start' => '', 'end' => '']),
                    'appointment' => Json::objectFrom(['date' => '', 'time' => '']),
                    default => '',
                };
            case 'collection_select':
                if ($field->isMulti()) {
                    return [];
                }
                // no break: a single collection_select starts like any text.
            default:
                $default = $field->defaultValue();

                return is_string($default) ? $default : '';
        }
    }

    /**
     * The wire payload: values under each field's published key, repeaters
     * remapped entry by entry, names normalized. Hidden references never
     * travel (the server would reject them as unknown keys).
     */
    public static function toSubmissionPayload(array $fields, array $data): stdClass
    {
        $all = self::fieldsById($fields);
        $remap = function (array $scopeFields, array $scopeData) use (&$remap, $all): stdClass {
            $byId = self::flattenValueFields($scopeFields);
            $out = new stdClass;
            foreach ($scopeData as $id => $input) {
                $id = (string) $id;
                if (isset($all[$id]) && in_array($all[$id]->type, self::LAYOUT_ONLY, true)) {
                    continue;
                }
                $field = $byId[$id] ?? null;
                if ($field === null) {
                    $out->{$id} = $input;

                    continue;
                }
                $value = $input;
                if ($field->type === 'multi_populator' && Json::isList($input)) {
                    $value = array_map(
                        fn ($inst) => $inst instanceof stdClass ? $remap($field->children ?? [], get_object_vars($inst)) : $inst,
                        $input,
                    );
                }
                if ($field->type === 'name' && $input instanceof stdClass) {
                    $value = self::normalizeNameValue($input);
                }
                $out->{$field->key() ?? $id} = $value;
            }

            return $out;
        };

        return $remap($fields, $data);
    }

    /** @return array<string, Field> */
    private static function flattenValueFields(array $fields): array
    {
        $out = [];
        $walk = function (array $nodes) use (&$walk, &$out) {
            foreach ($nodes as $f) {
                if ($f->type === 'multi_populator') {
                    $out[$f->id] = $f;

                    continue;
                }
                if (! in_array($f->type, self::STATIC_OR_LAYOUT, true) || $f->type === 'stepper') {
                    $out[$f->id] = $f;
                }
                if ($f->children !== null) {
                    $walk($f->children);
                }
            }
        };
        $walk($fields);

        return $out;
    }

    // ── Whole-tree value validation ─────────────────────────────────────────

    /**
     * Every visible, answered field whose value doesn't fit, walked like the
     * required walk (each repeater entry field by field, so the error lands
     * on the entry's own field).
     *
     * @return list<array{id: string, label: string, path: string, reason: string}>
     */
    public static function findInvalidValues(array $fields, array $data, ?callable $resolveMatch = null): array
    {
        $derived = self::withDerivedFieldValues($fields, self::deriveReferenceValues($fields, $data));
        $out = [];
        self::walkValues($fields, $derived, '', $resolveMatch, $out);

        return $out;
    }

    private static function walkValues(array $nodes, array $scope, string $prefix, ?callable $resolveMatch, array &$out): void
    {
        $resolve = self::resolver($scope, $resolveMatch);
        foreach ($nodes as $f) {
            switch ($f->type) {
                case 'condition_block':
                case 'input_group':
                case 'flex_row':
                case 'or_condition':
                    $visible = $f->type === 'condition_block'
                        ? self::evalCondition($f->rule(), $resolve)
                        : self::isNodeVisible($f, $resolve);
                    if ($visible) {
                        self::walkValues($f->children ?? [], $scope, $prefix, $resolveMatch, $out);
                    }
                    break;
                case 'multi_populator':
                    $instances = Json::list($scope[$f->id] ?? null) ?? [];
                    $max = min((int) (Json::num($f->config('populatorConfig', 'maxInstances')) ?? 10), self::MAX_ARRAY_LEN);
                    if (count($instances) > $max) {
                        $out[] = ['id' => $f->id, 'label' => $f->label, 'path' => $prefix.$f->id, 'reason' => 'max'];
                    }
                    foreach ($instances as $index => $instance) {
                        if ($instance instanceof stdClass) {
                            self::walkValues($f->children ?? [], get_object_vars($instance), "{$prefix}{$f->id}[{$index}].", $resolveMatch, $out);
                        }
                    }
                    break;
                default:
                    if (in_array($f->type, self::LAYOUT_ONLY, true) || $f->type === 'calculation') {
                        break;
                    }
                    $value = $scope[$f->id] ?? null;
                    if (self::isPendingUpload($value)) {
                        break;
                    }
                    if ($reason = self::validateValue($f, $value) ?? self::clientOnlyRule($f, $value)) {
                        $out[] = ['id' => $f->id, 'label' => $f->label, 'path' => $prefix.$f->id, 'reason' => $reason];
                    }
            }
        }
    }

    /** Checks the server doesn't make but a visitor should hear about: a range ending before it starts. */
    public static function clientOnlyRule(Field $field, mixed $value): ?string
    {
        $timeBlock = $field->type === 'time_picker' && $field->config('timeConfig', 'mode') === 'time_block';
        if ($field->type !== 'date_range' && ! $timeBlock) {
            return null;
        }
        $s = Json::str(Json::get($value, 'start'));
        $e = Json::str(Json::get($value, 'end'));
        if ($s === null || $e === null || $s === '' || $e === '') {
            return null;
        }
        if ($timeBlock) {
            return strcmp($e, $s) <= 0 ? 'range_order' : null;
        }
        if (strcmp($e, $s) < 0) {
            return 'range_order';
        }

        return $e === $s && $field->config('dateRangeConfig', 'allowSameDay') === false ? 'range_same_day' : null;
    }

    // ── Uploads ─────────────────────────────────────────────────────────────

    /**
     * A picked file waiting for submit: a placeholder in the value tree, so
     * required checks and file counts see it, swapped for the stored file on submit.
     */
    public static function isPendingUpload(mixed $value): bool
    {
        return Json::get($value, 'pending') === true && is_string(Json::get($value, 'localId'));
    }

    /** The author's allowed types, plus the formats phones produce for them (HEIC, QuickTime). */
    public static function expandAllowedTypes(array $allowed): array
    {
        $out = $allowed;
        $add = function (string $t) use (&$out) {
            if (! in_array($t, $out, true)) {
                $out[] = $t;
            }
        };
        foreach ($allowed as $a) {
            if ($a === 'image/*' || (str_starts_with($a, 'image/') && ! str_contains($a, 'heic'))) {
                array_map($add, ['image/heic', 'image/heif', '.heic', '.heif']);
                break;
            }
        }
        foreach ($allowed as $a) {
            if ($a === 'video/*' || str_starts_with($a, 'video/')) {
                array_map($add, ['video/quicktime', '.mov']);
                break;
            }
        }

        return $out;
    }

    public static function isFileTypeAllowed(string $name, string $mimeType, ?array $allowed): bool
    {
        if (! $allowed) {
            return true;
        }
        $type = strtolower($mimeType);
        $dot = strrpos($name, '.');
        $ext = $dot === false ? '' : strtolower(substr($name, $dot));
        foreach (self::expandAllowedTypes($allowed) as $raw) {
            $a = trim(strtolower($raw));
            if ($a === '') {
                continue;
            }
            if (str_starts_with($a, '.')) {
                if ($ext === $a) {
                    return true;
                }

                continue;
            }
            if (str_ends_with($a, '/*')) {
                if (str_starts_with($type, substr($a, 0, -1))) {
                    return true;
                }

                continue;
            }
            if ($type !== '' && $type === $a) {
                return true;
            }
        }

        return false;
    }

    /** Why a picked file is refused, or null. Same wording as the web renderer. */
    public static function fileProblem(string $name, string $mimeType, int $size, ?array $allowed, ?float $maxMB): ?string
    {
        if (! self::isFileTypeAllowed($name, $mimeType, $allowed)) {
            return 'File type not allowed: '.($mimeType === '' ? $name : $mimeType);
        }
        if ($maxMB !== null && $maxMB > 0 && $size > $maxMB * 1024 * 1024) {
            return "\"{$name}\" exceeds the ".Js::numberString($maxMB).' MB limit.';
        }

        return null;
    }

    // ── Display helpers ─────────────────────────────────────────────────────

    /** Long option lists get a search box (a combobox); short ones a plain select. */
    public const SEARCHABLE_THRESHOLD = 10;

    public static function shouldSearch(int $optionCount, ?string $display): bool
    {
        return $display === 'combobox' || $optionCount > self::SEARCHABLE_THRESHOLD;
    }

    /** "5551234567" → "(555) 123-4567"; international numbers in groups of three after a "+". */
    public static function formatPhone(string $input, bool $international): string
    {
        $digits = preg_replace('/[^0-9]/', '', $input) ?? '';
        if ($international) {
            $plus = str_starts_with(ltrim($input, ' '), '+') ? '+' : '';

            return trim($plus.implode(' ', str_split(substr($digits, 0, 15), 3)), ' ');
        }
        $n = strlen($digits);
        if ($n <= 3) {
            return $digits;
        }
        if ($n <= 6) {
            return '('.substr($digits, 0, 3).') '.substr($digits, 3);
        }

        return '('.substr($digits, 0, 3).') '.substr($digits, 3, 3).'-'.substr($digits, 6, 4);
    }

    /** A table cell in a `check` column: "yes" (✓), "no" (–), or "text" (its own text). */
    public static function tableCheckState(string $cell): string
    {
        $v = Js::lower(trim($cell, ' '));
        if (in_array($v, ['yes', 'y', 'true', '1', 'x', '✓', '✔', 'check'], true)) {
            return 'yes';
        }
        if (in_array($v, ['no', 'n', 'false', '0', '-', '–', '—', ''], true)) {
            return 'no';
        }

        return 'text';
    }

    /** Only http(s) links leave the form. */
    public static function safeHttpUrl(?string $raw): ?string
    {
        $url = trim((string) $raw, ' ');
        if ($url === '') {
            return null;
        }
        $scheme = parse_url($url, PHP_URL_SCHEME);

        return is_string($scheme) && in_array(strtolower($scheme), ['http', 'https'], true) ? $url : null;
    }

    // ── Autofill ────────────────────────────────────────────────────────────

    private const AUTOFILL = [
        ['first[\s_-]?name|given[\s_-]?name', 'given-name'],
        ['last[\s_-]?name|family[\s_-]?name|surname', 'family-name'],
        ['full[\s_-]?name|your[\s_-]?name|^name$|contact[\s_-]?name', 'name'],
        ['company|organi[sz]ation|business[\s_-]?name|employer', 'organization'],
        ['job[\s_-]?title|position|occupation', 'organization-title'],
        ['web[\s_-]?site|homepage|\burl\b', 'url'],
        ['address[\s_-]?line[\s_-]?2|apartment|\bapt\b|\bsuite\b|\bunit\b', 'address-line2'],
        ['street|address[\s_-]?line[\s_-]?1|^address1?$|street[\s_-]?address', 'street-address'],
        ['\bcity\b|\btown\b', 'address-level2'],
        ['\bstate\b|province|region', 'address-level1'],
        ['\bzip\b|postal|post[\s_-]?code', 'postal-code'],
        ['\bcountry\b', 'country-name'],
        ['birth|\bdob\b', 'bday'],
        ['work[\s_-]?phone|office[\s_-]?phone|company[\s_-]?phone|mobile|cell', 'tel'],
    ];

    /** The autofill token a field advertises: the author's, else one read from its type, key and label. */
    public static function autocompleteToken(Field $field): ?string
    {
        $own = $field->str('autocomplete');
        if ($own !== null && $own !== '') {
            return $own;
        }
        $byType = ['email' => 'email', 'phone' => 'tel', 'url' => 'url'][$field->type] ?? null;
        if ($byType !== null) {
            return $byType;
        }
        $haystack = ($field->key() ?? '').' '.$field->label;
        foreach (self::AUTOFILL as [$pattern, $token]) {
            if (preg_match('/'.$pattern.'/i', $haystack)) {
                return $token;
            }
        }

        return null;
    }
}
