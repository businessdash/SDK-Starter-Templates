<?php

namespace App\Bd\Forms;

/** Where a value lives: a field id, inside zero or more repeater entries. */
final class FieldPath
{
    /** @param  list<array{string, int}>  $entries  [repeater id, entry index], outermost first */
    public function __construct(
        public readonly string $fieldId,
        public readonly array $entries = [],
    ) {}

    /** `email`, or `kids[1].name` inside a repeater. Errors are keyed by this. */
    public function key(): string
    {
        $prefix = '';
        foreach ($this->entries as [$repeater, $index]) {
            $prefix .= "{$repeater}[{$index}].";
        }

        return $prefix.$this->fieldId;
    }

    /** A sibling field in the same entries. */
    public function child(string $id): self
    {
        return new self($id, $this->entries);
    }

    /** The entries of one row of this repeater. @return list<array{string, int}> */
    public function entry(int $index): array
    {
        return [...$this->entries, [$this->fieldId, $index]];
    }
}
