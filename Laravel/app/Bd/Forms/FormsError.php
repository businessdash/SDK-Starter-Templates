<?php

namespace App\Bd\Forms;

/** A form couldn't load, or a file couldn't upload: the message is for the visitor. */
final class FormsError extends \RuntimeException
{
    public function __construct(string $message, public readonly int $status = 0)
    {
        parent::__construct($message);
    }
}
