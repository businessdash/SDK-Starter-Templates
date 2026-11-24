<?php

namespace App\Bd\Forms;

/**
 * One render of a form: the controller after this request, the problems to
 * show, and the helpers the Blade views (resources/views/forms/*) draw with.
 *
 * A value's KEY is where it sits in the component's `$input`: a field's id,
 * or `<repeater key>.<row>.<child id>` inside a repeater. A composite field's
 * parts sit under it (`<key>.first`). Boxes bind to `input.<key>`.
 */
final class FormView
{
    public const LAYOUT_TYPES = ['input_group', 'condition_block', 'or_condition', 'flex_row'];

    /** Every type the views draw (anything else is a plain text box). */
    public const KNOWN_TYPES = [
        'title', 'subtitle', 'separator', 'richtext', 'body_text', 'image', 'textarea', 'rich_text_input', 'select',
        'radio', 'checkbox', 'boolean', 'date', 'email', 'phone', 'number', 'currency', 'stepper', 'slider',
        'star_rating', 'happiness_rating', 'color_picker', 'choice_cards', 'date_range', 'time_picker', 'name',
        'address', 'url', 'tags', 'measurement', 'calculation', 'collection_select', 'multi_populator', 'file_upload',
    ];

    public const NO_LABEL_TYPES = ['title', 'subtitle', 'separator', 'richtext', 'body_text', 'image', 'boolean'];

    /** Fields drawn as one control, which a `<label for>` can name. The rest are groups. */
    public const SINGLE_CONTROL_TYPES = [
        'text', 'textarea', 'rich_text_input', 'select', 'date', 'email', 'phone', 'number', 'currency',
        'stepper', 'slider', 'url', 'tags', 'measurement',
    ];

    public const UNSUPPORTED_TYPES = ['schedule', 'signature', 'payment', 'credit_card', 'icon_picker', 'image_input', 'month_year'];

    public const FACES = [['😞', 'Very unhappy'], ['😕', 'Unhappy'], ['😐', 'Neutral'], ['🙂', 'Happy'], ['😄', 'Very happy']];

    /**
     * @param  array<string, string>  $errors  Field path key → message, as shown.
     * @param  list<string>  $notices  Form-level messages (a failed submit, a file to pick again).
     */
    public function __construct(
        public readonly FormController $c,
        public readonly array $errors,
        public readonly array $notices,
        public readonly string $formId,
        public readonly string $submitLabel,
        public readonly bool $sample,
    ) {}

    /** The fields that hold a value, through layout nodes but not into repeaters. @return list<Field> */
    public static function valueFields(array $fields): array
    {
        $out = [];
        foreach ($fields as $field) {
            if (in_array($field->type, self::LAYOUT_TYPES, true)) {
                array_push($out, ...self::valueFields($field->children ?? []));
            } elseif (! in_array($field->type, Rules::STATIC_TYPES, true) && $field->type !== 'calculation' && $field->type !== 'reference_value') {
                $out[] = $field;
            }
        }

        return $out;
    }

    public static function model(string $key, ?string $part = null): string
    {
        return 'input.'.$key.($part === null ? '' : ".{$part}");
    }

    public function id(string $key, ?string $part = null): string
    {
        return (string) preg_replace('/[^\p{L}\p{N}_-]/u', '-', "bd-{$this->formId}-{$key}".($part === null ? '' : "-{$part}"));
    }

    /** The `uploads.<slot>` a file field's picker binds to: its path key, hex, so no dot splits it. */
    public static function uploadSlot(string $pathKey): string
    {
        return 'k'.bin2hex($pathKey);
    }

    public static function slotKey(string $slot): ?string
    {
        if (! preg_match('/^k((?:[0-9a-f]{2})+)$/', $slot, $m)) {
            return null;
        }

        return hex2bin($m[1]) ?: null;
    }

    public static function singleControl(Field $field): bool
    {
        if ($field->type === 'time_picker') {
            return $field->timeMode() === 'simple';
        }

        return in_array($field->type, self::SINGLE_CONTROL_TYPES, true) || ! in_array($field->type, self::KNOWN_TYPES, true);
    }

    public static function showsLabel(Field $field): bool
    {
        return ! in_array($field->type, self::NO_LABEL_TYPES, true) && $field->label !== '';
    }

    public static function valueBearing(Field $field): bool
    {
        return ! in_array($field->type, Rules::STATIC_TYPES, true) && $field->type !== 'calculation';
    }

    /** What the field's wrapper is known by in CSS: its output key, else its id. */
    public static function cssKey(Field $field): string
    {
        foreach ([$field->str('outputKey'), $field->str('key')] as $explicit) {
            if ($explicit !== null && Js::trim($explicit) !== '') {
                return Js::trim($explicit);
            }
        }

        return $field->id;
    }

    /** A value as a box shows it. */
    public static function str(mixed $value): string
    {
        return match (true) {
            is_string($value) => $value,
            is_float($value), is_int($value) => Js::numberString((float) $value),
            default => '',
        };
    }

    public static function part(mixed $value, string $part): string
    {
        return self::str(Json::get($value, $part));
    }

    public static function number(float $n): string
    {
        return Js::numberString($n);
    }

    // ── The whole form ──────────────────────────────────────────────────────

    public function stepped(): bool
    {
        return $this->c->isConsecutive() && $this->c->stepCount() > 1;
    }

    /** @return list<string> The labels of the fields with problems, in form order. */
    public function summaryLabels(): array
    {
        $order = [];
        foreach (array_keys(Rules::fieldsById($this->c->fields())) as $i => $id) {
            $order[(string) $id] = $i;
        }
        $keys = array_map('strval', array_keys($this->errors));
        usort($keys, function (string $a, string $b) use ($order) {
            $ra = $order[explode('[', $a)[0]] ?? PHP_INT_MAX;
            $rb = $order[explode('[', $b)[0]] ?? PHP_INT_MAX;

            return $ra !== $rb ? $ra <=> $rb : strcmp($a, $b);
        });
        $labels = [];
        foreach ($keys as $key) {
            $parts = explode('.', $key);
            $label = $this->c->field(end($parts))?->label ?? '';
            if ($label !== '') {
                $labels[] = $label;
            }
        }

        return $labels;
    }

    public function progressBar(): bool
    {
        return $this->c->schema->setting('progressStyle') === 'bar';
    }

    public function showsProgress(): bool
    {
        return $this->c->schema->flag('showProgress') === true;
    }

    // ── Controls ────────────────────────────────────────────────────────────

    public static function autocomplete(Field $field): ?string
    {
        $own = $field->str('autocomplete');
        if ($own !== null && $own !== '') {
            return $own;
        }

        return match ($field->type) {
            'email' => 'email',
            'phone' => 'tel',
            'url' => 'url',
            default => Rules::autocompleteToken($field),
        };
    }

    /** @return array{lo: float, hi: float, step: float, current: float, fmt: \Closure(float): string} */
    public static function slider(Field $field, mixed $value): array
    {
        $lo = Json::num($field->config('sliderConfig', 'min')) ?? 0.0;
        $unit = Json::str($field->config('sliderConfig', 'unit'));

        return [
            'lo' => $lo,
            'hi' => Json::num($field->config('sliderConfig', 'max')) ?? 100.0,
            'step' => Json::num($field->config('sliderConfig', 'step')) ?? 1.0,
            'current' => Json::isNumber($value) ? (float) $value : $lo,
            'fmt' => fn (float $x) => match ($unit) {
                'currency' => '$'.Js::numberString($x),
                'percent' => Js::numberString($x).'%',
                default => Js::numberString($x),
            },
        ];
    }

    /** @return list<array{string, string}> [value, label] for a simple time picker. */
    public static function times(Field $field): array
    {
        $h24 = $field->config('timeConfig', 'format') === '24h';
        $step = max((int) (Json::num($field->config('timeConfig', 'stepMinutes')) ?? 30), 1);
        $out = [];
        for ($hour = 0; $hour < 24; $hour++) {
            for ($minute = 0; $minute < 60; $minute += $step) {
                $t = sprintf('%02d:%02d', $hour, $minute);
                $out[] = [$t, $h24 ? $t : sprintf('%d:%02d %s', $hour % 12 === 0 ? 12 : $hour % 12, $minute, $hour < 12 ? 'AM' : 'PM')];
            }
        }

        return $out;
    }

    /** @return list<array{string, string, string, string, bool}> A name's boxes: [part, label, autofill token, hint, full width]. */
    public static function nameParts(Field $field): array
    {
        $middle = $field->config('nameConfig', 'middle') === true;
        $suffix = $field->config('nameConfig', 'suffix') === true;

        return array_values(array_filter([
            $field->config('nameConfig', 'prefix') === true ? ['prefix', 'Title', 'honorific-prefix', 'Dr.', true] : null,
            ['first', 'First name', 'given-name', 'Jane', false],
            $middle ? ['middle', 'Middle name', 'additional-name', 'Quinn', false] : null,
            ['last', 'Last name', 'family-name', 'Doe', $middle && ! $suffix],
            $suffix ? ['suffix', 'Suffix', 'honorific-suffix', 'Jr.', ! $middle] : null,
        ]));
    }

    /** @return array{units: list<string>, unit: string, fixed: bool} */
    public static function measurement(Field $field, mixed $value): array
    {
        $category = Units::categoryOf($field);
        $listed = Json::strings($field->config('unitConfig', 'units'));
        $units = $listed !== [] ? $listed : Units::symbols($category);
        $unit = Json::str(Json::get($value, 'unit')) ?? Json::str($field->config('unitConfig', 'defaultUnit')) ?? $units[0] ?? $category['baseUnit'];

        return ['units' => $units, 'unit' => $unit, 'fixed' => $field->config('unitConfig', 'mode') === 'fixed' || count($units) <= 1];
    }

    /**
     * A collection_select's state: 'loading' | 'failed' | 'empty' (with a
     * message), or 'select' / 'list' with the options.
     *
     * @return array{status: string, message: ?string, options: list<array>, multi: bool}
     */
    public function collection(Field $field): array
    {
        $state = $this->c->collectionOptions[$field->id] ?? null;
        $multi = $field->isMulti();
        if ($state === null) {
            return ['status' => 'loading', 'message' => 'Loading the choices…', 'options' => [], 'multi' => $multi];
        }
        if ($state[0] === 'failed') {
            return ['status' => 'error', 'message' => (string) $state[1], 'options' => [], 'multi' => $multi];
        }
        $options = $state[1];
        if ($options === []) {
            return ['status' => 'empty', 'message' => 'Nothing to choose from yet.', 'options' => [], 'multi' => $multi];
        }
        $searchable = $field->str('display') === 'combobox' || count($options) > Rules::SEARCHABLE_THRESHOLD;
        $images = array_filter($options, fn ($o) => Js::trim($o['image'] ?? '') !== '') !== [];

        return ['status' => ! $multi && ! $searchable && ! $images ? 'select' : 'list', 'message' => null, 'options' => $options, 'multi' => $multi];
    }

    /** @return array{least: int, most: int, count: int, item: string, add: string} */
    public static function repeater(Field $field, mixed $value): array
    {
        $least = max((int) (Json::num($field->config('populatorConfig', 'minInstances')) ?? 1), 1);
        $item = Json::str($field->config('populatorConfig', 'itemLabel')) ?? 'Item';

        return [
            'least' => $least,
            'most' => (int) (Json::num($field->config('populatorConfig', 'maxInstances')) ?? 10),
            'count' => max(count(Json::list($value) ?? []), $least),
            'item' => $item,
            'add' => Json::str($field->config('populatorConfig', 'addButtonLabel')) ?? 'Add '.Js::lower($item),
        ];
    }

    public static function kilobytes(mixed $file): int
    {
        return max(1, (int) round((Json::num(Json::get($file, 'size')) ?? 0) / 1024));
    }
}
