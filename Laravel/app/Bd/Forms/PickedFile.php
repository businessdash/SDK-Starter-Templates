<?php

namespace App\Bd\Forms;

use Closure;

/**
 * A file a visitor picked. It waits (in Livewire's temporary upload storage)
 * until Submit uploads it, so an abandoned form never leaves a file on BD.
 */
final class PickedFile
{
    /** @param  Closure(): string  $read  The bytes, read when the file uploads. */
    public function __construct(
        public readonly string $name,
        public readonly string $mimeType,
        public readonly int $size,
        private readonly Closure $read,
    ) {}

    public function data(): string
    {
        return ($this->read)();
    }
}
