<?php

namespace App\Bd\Forms;

use Illuminate\Support\Str;
use stdClass;

/**
 * One node of a form: an input, a static block, or a container.
 *
 * Read as BD publishes it and as leniently as the other ports read it: a
 * member of the wrong type reads as absent, and a config with a mistyped
 * member reads as absent as a whole, so one malformed element falls back to
 * its defaults instead of taking the form down. `type` stays a string, so a
 * form can use an element this code has never heard of (it renders as a text
 * box and keeps its value).
 */
final class Field
{
    public readonly string $id;

    public readonly string $type;

    public readonly string $label;

    public readonly bool $required;

    /** @var list<Field>|null */
    public readonly ?array $children;

    /** The element as received. */
    public readonly stdClass $raw;

    /** @var array<string, stdClass|null> */
    private array $configs = [];

    public function __construct(mixed $json)
    {
        $raw = $json instanceof stdClass ? $json : new stdClass;
        $this->raw = $raw;
        $this->id = Json::str($raw->id ?? null) ?? (string) Str::uuid();
        $this->type = Json::str($raw->type ?? null) ?? 'text';
        $this->label = Json::str($raw->label ?? null) ?? '';
        $this->required = ($raw->required ?? null) === true;
        $kids = $raw->children ?? null;
        $this->children = Json::isList($kids) && self::allObjects($kids)
            ? array_map(fn ($child) => new self($child), $kids)
            : null;
    }

    /**
     * @param  mixed  $list  A JSON list of elements.
     * @return list<Field>
     */
    public static function list(mixed $list): array
    {
        return array_values(array_map(
            fn ($json) => new self($json),
            array_filter(Json::list($list) ?? [], fn ($item) => $item instanceof stdClass),
        ));
    }

    private static function allObjects(array $items): bool
    {
        foreach ($items as $item) {
            if (! $item instanceof stdClass) {
                return false;
            }
        }

        return true;
    }

    // ── Members ─────────────────────────────────────────────────────────────

    public function str(string $key): ?string
    {
        return Json::str($this->raw->{$key} ?? null);
    }

    public function bool(string $key): ?bool
    {
        return Json::bool($this->raw->{$key} ?? null);
    }

    public function num(string $key): ?float
    {
        return Json::num($this->raw->{$key} ?? null);
    }

    /** The published output key: what the submission sends this value under. */
    public function key(): ?string
    {
        return $this->str('key');
    }

    /** @return list<string>|null The choices, strings only. */
    public function options(): ?array
    {
        $options = $this->raw->options ?? null;

        return Json::isList($options) ? Json::strings($options) : null;
    }

    /** The author's default, or null (a JSON null default is none). */
    public function defaultValue(): mixed
    {
        return $this->raw->defaultValue ?? null;
    }

    public function mustBeTrue(): bool
    {
        return $this->bool('mustBeTrue') === true;
    }

    /** The visibility rule on a condition block or a group. */
    public function rule(): ?stdClass
    {
        return $this->cfg('conditionRule');
    }

    /**
     * A config object (`sliderConfig`, `fileConfig`, …), or null when it's
     * missing or any member has the wrong type.
     */
    public function cfg(string $name): ?stdClass
    {
        if (! array_key_exists($name, $this->configs)) {
            $value = $this->raw->{$name} ?? null;
            $this->configs[$name] = isset(self::SPECS[$name]) && self::fits($value, self::SPECS[$name]) ? $value : null;
        }

        return $this->configs[$name];
    }

    /** One member of a config, or null. */
    public function config(string $name, string $member): mixed
    {
        $config = $this->cfg($name);

        return $config === null ? null : ($config->{$member} ?? null);
    }

    /** The choice cards' options. @return list<stdClass> */
    public function cards(): array
    {
        return Json::list($this->config('choiceConfig', 'options')) ?? [];
    }

    /** The checkbox group / choice cards / collection take several answers. */
    public function isMulti(): bool
    {
        return match ($this->type) {
            'choice_cards' => $this->config('choiceConfig', 'mode') === 'multi',
            'collection_select' => $this->config('collectionSelectConfig', 'multi') === true,
            default => false,
        };
    }

    public function timeMode(): string
    {
        return Json::str($this->config('timeConfig', 'mode')) ?? 'simple';
    }

    /**
     * What each config holds: `s` string, `n` number, `i` whole number, `b`
     * bool, `s*` list of strings, a map for an object, `['*', map]` for a list
     * of objects. `!` marks a member that must be there.
     */
    private const SPECS = [
        'conditionRule' => [
            'fieldId' => 's', 'operator' => 's', 'value' => 's', 'match' => 's', 'matchField' => 's',
            'clauses' => ['*', ['operator' => 's!', 'value' => 's']],
        ],
        'validation' => ['min' => 'n', 'max' => 'n'],
        'emailConfig' => ['businessOnly' => 'b'],
        'nameConfig' => ['prefix' => 'b', 'middle' => 'b', 'suffix' => 'b', 'nicknames' => 'b'],
        'phoneConfig' => ['format' => 's', 'international' => 'b', 'showFlags' => 'b'],
        'textareaConfig' => ['rows' => 'i', 'resizable' => 'b'],
        'richTextConfig' => ['minHeight' => 'n'],
        'sliderConfig' => ['min' => 'n', 'max' => 'n', 'step' => 'n', 'unit' => 's'],
        'imageConfig' => ['src' => 's', 'alt' => 's', 'width' => 'n', 'height' => 'n'],
        'fileConfig' => ['allowedTypes' => 's*', 'maxFiles' => 'i', 'maxSize' => 'n'],
        'iconConfig' => ['set' => 's', 'allowedIcons' => 's*', 'columns' => 'i'],
        'imageInputConfig' => ['allowedTypes' => 's*', 'maxSize' => 'n', 'showPreview' => 'b', 'sources' => 's'],
        'flexConfig' => ['justify' => 's', 'align' => 's', 'gap' => 'n'],
        'starRatingConfig' => ['maxStars' => 'i', 'defaultValue' => 'n'],
        'dateRangeConfig' => ['allowSameDay' => 'b'],
        'orConditionConfig' => ['leftLabel' => 's', 'rightLabel' => 's'],
        'timeConfig' => ['mode' => 's', 'format' => 's', 'stepMinutes' => 'i'],
        'choiceConfig' => [
            'mode' => 's',
            'options' => ['*', [
                'label' => 's!', 'icon' => 's', 'imageUrl' => 's', 'price' => 's',
                'description' => 's', 'productId' => 's', 'href' => 's',
            ]],
        ],
        'populatorConfig' => ['maxInstances' => 'i', 'minInstances' => 'i', 'addButtonLabel' => 's', 'itemLabel' => 's'],
        'unitConfig' => [
            'category' => 's', 'units' => 's*', 'mode' => 's', 'defaultUnit' => 's', 'outputUnit' => 's', 'allowDecimal' => 'b',
        ],
        'currencyConfig' => ['currency' => 's', 'symbol' => 's', 'allowNegative' => 'b', 'allowDecimal' => 'b'],
        'calculationConfig' => self::CALCULATION,
        'paymentConfig' => ['mode' => 's', 'amountCents' => 'i', 'currency' => 's', 'buttonLabel' => 's', 'description' => 's'],
        'serviceConfig' => [
            'options' => ['*', ['id' => 's!', 'title' => 's!', 'estimatedHours' => 'n']],
            'multi' => 'b',
        ],
        'scheduleConfig' => [
            'mode' => 's', 'allowAsap' => 'b', 'days' => 's*', 'timeWindows' => 's*', 'granularTimes' => 'b',
            'allowNotes' => 'b', 'durationMinutes' => 'n',
        ],
        'collectionSelectConfig' => [
            'collectionKey' => 's', 'labelField' => 's', 'imageField' => 's', 'valueMode' => 's', 'valueField' => 's', 'multi' => 'b',
        ],
        'monthYearConfig' => ['minYear' => 'i', 'maxYear' => 'i'],
    ];

    public const CALCULATION = [
        'mode' => 's', 'formula' => 's', 'functionId' => 's', 'outputKey' => 's',
        'inputMap' => ['*', ['variable' => 's!', 'fieldId' => 's!']],
        'display' => self::DISPLAY,
        'sensitive' => 'b',
    ];

    public const DISPLAY = ['show' => 'b', 'prefix' => 's', 'suffix' => 's', 'decimals' => 'i'];

    /** Whether a JSON value has the shape a spec describes. */
    public static function fits(mixed $value, mixed $spec): bool
    {
        if (is_array($spec) && array_is_list($spec)) {
            if (! Json::isList($value)) {
                return false;
            }
            foreach ($value as $item) {
                if (! self::fits($item, $spec[1])) {
                    return false;
                }
            }

            return true;
        }
        if (is_array($spec)) {
            if (! $value instanceof stdClass) {
                return false;
            }
            foreach ($spec as $key => $member) {
                $required = is_string($member) && str_ends_with($member, '!');
                $item = $value->{$key} ?? null;
                if ($item === null) {
                    if ($required) {
                        return false;
                    }

                    continue;
                }
                if (! self::fits($item, $required ? substr($member, 0, -1) : $member)) {
                    return false;
                }
            }

            return true;
        }

        return match ($spec) {
            's' => is_string($value),
            'n' => Json::isNumber($value),
            'i' => Json::isNumber($value) && is_finite((float) $value) && floor((float) $value) === (float) $value,
            'b' => is_bool($value),
            's*' => Json::isList($value) && count(array_filter($value, 'is_string')) === count($value),
            default => false,
        };
    }
}
