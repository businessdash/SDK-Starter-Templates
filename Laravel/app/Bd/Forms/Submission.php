<?php

namespace App\Bd\Forms;

use stdClass;

/** A form submission as the Package API takes it. */
final class Submission
{
    public function __construct(
        public readonly stdClass $data,
        public readonly ?string $submitterEmail = null,
        public readonly ?string $submitterName = null,
        public readonly ?bool $dryRun = null,
        public readonly ?string $source = null,
        public readonly ?string $referrer = null,
        public readonly ?stdClass $metadata = null,
    ) {}

    /** The request body: unset members left out. */
    public function body(): stdClass
    {
        $body = new stdClass;
        $body->data = $this->data;
        foreach (['submitterEmail', 'submitterName', 'dryRun', 'source', 'referrer', 'metadata'] as $key) {
            if ($this->{$key} !== null) {
                $body->{$key} = $this->{$key};
            }
        }

        return $body;
    }
}
