<?php

namespace App\Http\Controllers;

use App\Biab\Biab;
use App\Biab\Webhook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * `POST /api/biab/revalidate` — BIAB tells this site content changed, and
 * the site drops exactly the cache tags named in the payload. No polling,
 * and edits go live immediately.
 *
 * `$request->getContent()` is the RAW body. Do not swap it for `all()` or
 * `json()`: re-encoding changes bytes and the HMAC stops matching.
 */
class WebhookController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $result = Webhook::verify(
            $request->getContent(),
            $request->header('X-BIAB-Signature'),
        );

        if (! $result['ok']) {
            // 400, not 500 — a bad signature is the caller's problem, and a
            // 5xx would make BIAB retry a request that can never succeed.
            return response()->json(['error' => $result['reason']], 400);
        }

        $tags = array_values(array_filter(
            $result['payload']['tags'] ?? [],
            static fn ($t) => is_string($t) && $t !== ''
        ));

        if ($tags) {
            Biab::forget($tags);
        }

        return response()->json(['ok' => true, 'purged' => count($tags)]);
    }
}
