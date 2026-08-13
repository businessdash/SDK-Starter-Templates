<?php

namespace App\Biab;

use RuntimeException;

/** A non-2xx response from the BIAB Package API. */
class BiabApiException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $path,
        string $message,
        public readonly mixed $body = null,
    ) {
        parent::__construct($message);
    }
}
