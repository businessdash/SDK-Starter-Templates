<?php

namespace App\Biab;

use RuntimeException;

/**
 * The org's billing / entitlement gate refused to serve.
 *
 * The platform signals this two ways and the client normalises both into
 * one exception: a 402 on writes, and a 200 whose BODY carries
 * `{ available: false, reason, upgradeUrl, message }` on reads. Reads use a
 * body-only signal so a cached CDN response can't hard-fail a page — which
 * also means a client that doesn't check for it renders a blank section and
 * never notices.
 *
 * `reason` is one of `plan_required`, `payment_required`, `service_suspended`.
 */
class BiabAccessRejectedException extends RuntimeException
{
    public function __construct(
        public readonly string $reason,
        public readonly string $upgradeUrl,
        string $message,
        public readonly int $status = 402,
    ) {
        parent::__construct($message);
    }
}
