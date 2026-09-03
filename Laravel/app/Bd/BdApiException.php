<?php

namespace App\Bd;

use RuntimeException;

/** A non-2xx response from the BD Package API. */
class BdApiException extends RuntimeException
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
