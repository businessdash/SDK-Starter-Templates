<?php

namespace App\Biab;

/**
 * Verifies the BIAB → this-app revalidation webhook.
 *
 * BIAB fires `content.published` with a Stripe-shaped signature header:
 *
 *   X-BIAB-Signature: t=<unix seconds>,v1=<hex hmac-sha256>
 *
 * signed over `"{t}.{rawBody}"`. Two rules that are easy to get wrong and
 * silent when you do:
 *
 *  - Verify against the RAW body, byte for byte. Re-encoding a decoded array
 *    changes key order and whitespace, and the HMAC no longer matches. In
 *    Laravel that means `$request->getContent()`, never `$request->all()`.
 *  - Compare in constant time (`hash_equals`), never `===`.
 *
 * The 5-minute replay window matches the platform's.
 */
class Webhook
{
    private const REPLAY_WINDOW_SECONDS = 300;

    /**
     * @return array{ok: true, payload: array<string, mixed>}|array{ok: false, reason: string}
     */
    public static function verify(string $rawBody, ?string $signatureHeader, ?string $secret = null): array
    {
        $secret ??= config('biab.revalidation_secret');
        if (! $secret) {
            return ['ok' => false, 'reason' => 'no_secret_configured'];
        }

        $parsed = self::parseSignature($signatureHeader);
        if (! $parsed) {
            return ['ok' => false, 'reason' => 'missing_or_malformed_signature'];
        }

        if (abs(time() - $parsed['t']) > self::REPLAY_WINDOW_SECONDS) {
            return ['ok' => false, 'reason' => 'replay_window_expired'];
        }

        $expected = hash_hmac('sha256', $parsed['t'].'.'.$rawBody, $secret);
        if (! hash_equals($expected, $parsed['v1'])) {
            return ['ok' => false, 'reason' => 'signature_mismatch'];
        }

        $payload = json_decode($rawBody, true);
        if (! is_array($payload)) {
            return ['ok' => false, 'reason' => 'body_not_json'];
        }

        if (
            ($payload['event'] ?? null) !== 'content.published'
            || ! is_array($payload['tags'] ?? null)
            || ! is_string($payload['orgId'] ?? null)
        ) {
            return ['ok' => false, 'reason' => 'body_shape_invalid'];
        }

        return ['ok' => true, 'payload' => $payload];
    }

    /** @return array{t: int, v1: string}|null */
    private static function parseSignature(?string $header): ?array
    {
        if (! $header) {
            return null;
        }

        $t = null;
        $v1 = null;
        foreach (explode(',', $header) as $part) {
            $pair = explode('=', trim($part), 2);
            if (count($pair) !== 2) {
                continue;
            }
            if ($pair[0] === 't') {
                $t = is_numeric($pair[1]) ? (int) $pair[1] : null;
            } elseif ($pair[0] === 'v1') {
                $v1 = $pair[1];
            }
        }

        if ($t === null || ! $v1) {
            return null;
        }

        return ['t' => $t, 'v1' => $v1];
    }
}
