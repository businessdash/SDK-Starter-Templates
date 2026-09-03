<?php

namespace App\Http\Controllers;

use App\Bd\Bd;
use App\Bd\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Same-origin proxy for the `<bd-form>` web component.
 *
 * The component renders the full form schema client-side — conditional
 * blocks, availability pickers, file uploads — which a hand-written Blade
 * fragment can't match. It needs to reach the API, but the bearer key must
 * not go to the browser. So the browser talks to THIS route, and this route
 * talks to BD with the key.
 *
 * That is the whole reason a Laravel consumer never has to reimplement the
 * form renderer.
 */
class FormProxyController extends Controller
{
    public function schema(string $slug): JsonResponse
    {
        $schema = Bd::attempt(static fn (Client $c) => $c->forms()->schema($slug));

        return $schema
            ? response()->json($schema)
            : response()->json(['error' => 'form_unavailable'], 502);
    }

    public function submit(Request $request, string $slug): JsonResponse
    {
        $payload = $request->json()->all();
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        $result = Bd::attempt(static fn (Client $c) => $c->forms()->submit(
            $slug,
            $data,
            submitterEmail: is_string($payload['submitterEmail'] ?? null) ? $payload['submitterEmail'] : null,
            submitterName: is_string($payload['submitterName'] ?? null) ? $payload['submitterName'] : null,
            source: 'laravel-starter',
            referrer: $request->header('referer'),
        ));

        return $result
            ? response()->json($result)
            : response()->json(['ok' => false, 'reason' => 'transport_error'], 502);
    }
}
