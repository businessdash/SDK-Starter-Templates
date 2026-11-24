<?php

namespace App\Bd\Forms;

use stdClass;

/**
 * A Live form as BD publishes it (`GET /api/package/v1/forms/{slug}`): the
 * whole builder tree, not a flat field list — layout containers, condition
 * blocks, either/or branches, repeaters and each field's own configuration.
 */
final class Schema
{
    /**
     * @param  list<Field>  $fields
     * @param  list<stdClass>  $businessFunctions  Non-sensitive business functions,
     *                                             published so calculations compute live.
     */
    public function __construct(
        public readonly string $id,
        public readonly string $slug,
        public readonly ?string $title,
        public readonly ?string $description,
        public readonly array $fields,
        public readonly stdClass $settings,
        public readonly ?string $orgIcon = null,
        public readonly array $businessFunctions = [],
    ) {}

    public static function fromJson(mixed $json): self
    {
        $o = $json instanceof stdClass ? $json : new stdClass;
        $settings = $o->settings ?? null;
        $functions = $o->businessFunctions ?? null;

        return new self(
            id: Json::str($o->id ?? null) ?? '',
            slug: Json::str($o->slug ?? null) ?? '',
            // BD publishes `name`; older payloads used `title`.
            title: Json::str($o->name ?? null) ?? Json::str($o->title ?? null),
            description: Json::str($o->description ?? null),
            fields: Field::list($o->fields ?? null),
            settings: $settings instanceof stdClass ? $settings : new stdClass,
            orgIcon: Json::str($o->orgIcon ?? null),
            businessFunctions: Field::fits($functions, ['*', self::FUNCTION]) ? $functions : [],
        );
    }

    /** The same form under another slug, title or description. */
    public function with(?string $slug = null, ?string $description = null): self
    {
        return new self(
            $this->id, $slug ?? $this->slug, $this->title, $description ?? $this->description,
            $this->fields, $this->settings, $this->orgIcon, $this->businessFunctions,
        );
    }

    /** A form setting that's a bool (`isConsecutive`, `showProgress`), else null. */
    public function flag(string $name): ?bool
    {
        return Json::bool($this->settings->{$name} ?? null);
    }

    public function setting(string $name): ?string
    {
        return Json::str($this->settings->{$name} ?? null);
    }

    /** A business function: `{id, slug, inputs: [{key, type, …}], outputs: [{key, type, formula, …}]}`. */
    public const FUNCTION = [
        'id' => 's!',
        'slug' => 's!',
        'inputs' => ['*', ['key' => 's!', 'label' => 's', 'type' => 's!', 'required' => 'b']],
        'outputs' => ['*', ['key' => 's!', 'label' => 's', 'type' => 's!', 'formula' => 's!']],
    ];
}
