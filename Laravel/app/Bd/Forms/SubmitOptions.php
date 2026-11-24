<?php

namespace App\Bd\Forms;

use stdClass;

/** Sent with every submit. */
final class SubmitOptions
{
    public function __construct(
        public ?string $submitterEmail = null,
        public ?string $submitterName = null,
        public bool $dryRun = false,
        /** Where the submission came from. */
        public ?string $source = 'laravel-starter',
        public ?string $referrer = null,
        public ?stdClass $metadata = null,
    ) {}
}
