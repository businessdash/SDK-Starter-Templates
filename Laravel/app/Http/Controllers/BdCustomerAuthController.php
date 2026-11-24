<?php

namespace App\Http\Controllers;

use App\Bd\Client;
use App\Bd\CustomerAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Customer sign-in as JSON, at `/api/bd-auth/customer/{path}` — the PHP twin
 * of the JS SDK's `createAuthHandler` customer routes, for apps and pages
 * that bring their own screen — and the "Continue with …" links the screen
 * on /my-account (`App\Livewire\SignIn`) uses.
 *
 *   GET  options                      the business's name, colours, providers
 *   POST sign-in | verify | id-token  → sets the httpOnly `bd_session` cookie
 *   POST sign-up | forgot-password    → { pendingId, expiresAt } (a code is sent)
 *   GET  oauth/{google|apple|github|discord}?returnTo=/path
 *        → PKCE verifier in a short httpOnly cookie, then to WorkOS's link
 *   GET  oauth/callback?bd_oauth_code=…
 *        → redeemed with that verifier, `bd_session` set, back to returnTo
 *
 * Every step is BD's `auth/customer/*`, which runs it through WorkOS — the
 * same accounts as BD's hosted sign-in. The key stays on this server and the
 * session token never reaches page scripts.
 *
 * POSTs must be JSON (a cross-site form can't send that without a CORS
 * preflight), which is why the path is outside Laravel's CSRF check.
 */
class BdCustomerAuthController extends Controller
{
    private const PROVIDERS = ['apple', 'google', 'github', 'discord'];

    private const PKCE_COOKIE = 'bd_oauth_pkce';

    private const OAUTH_PATH = '/api/bd-auth/customer/oauth';

    public function __invoke(Request $request, string $path)
    {
        $client = Client::fromConfig();
        if (! $client) {
            return $this->problem(503, 'unavailable', 'Sign-in isn\'t set up yet.');
        }

        if (str_starts_with($path, 'oauth/')) {
            return $this->oauth($request, $client, substr($path, strlen('oauth/')));
        }

        $route = CustomerAuth::ROUTES[$path] ?? null;
        if (! $route) {
            return $this->problem(404, 'not_found', 'Not found.');
        }
        [$method] = $route;
        if (! $request->isMethod($method)) {
            return $this->problem(405, 'method_not_allowed', "Use {$method} for customer/{$path}.");
        }

        $body = null;
        if ($method === 'POST') {
            if (! str_contains(strtolower((string) $request->header('Content-Type')), 'application/json')) {
                return $this->problem(415, 'unsupported_media_type', 'Send JSON.');
            }
            $body = json_decode($request->getContent(), true);
            if (! is_array($body) || array_is_list($body) && $body !== []) {
                return $this->problem(400, 'invalid_json', 'Check the form and try again.');
            }
        }

        $answer = CustomerAuth::forward($client, $path, $body);
        if (! $answer->isSignedIn()) {
            // The business's options, a code on its way, or BD's own refusal.
            return $answer->isAnswered()
                ? response()->json($answer->body)->header('Cache-Control', 'no-store')
                : $this->problem($answer->status, $answer->code, $answer->message);
        }

        // The token goes in the httpOnly cookie, never to the page.
        return response()
            ->json([
                'user' => $answer->body['user'] ?? null,
                'organizationId' => $answer->body['organizationId'] ?? null,
                'role' => $answer->body['role'] ?? null,
                'expiresAt' => $answer->expiresAt,
            ])
            ->header('Cache-Control', 'no-store')
            ->withCookie(CustomerAuth::sessionCookie($request, $answer->token, $answer->expiresAt));
    }

    private function oauth(Request $request, Client $client, string $rest): RedirectResponse|JsonResponse
    {
        if (! $request->isMethod('GET')) {
            return $this->problem(405, 'method_not_allowed', "Use GET for customer/oauth/{$rest}.");
        }

        if ($rest === 'callback') {
            $returnTo = $this->samePath($request->query('bd_return_to')) ?? '/my-account';
            $forget = cookie()->forget(self::PKCE_COOKIE, self::OAUTH_PATH);

            $failed = $request->query('bd_oauth_error');
            if (is_string($failed) && $failed !== '') {
                $message = $request->query('bd_oauth_message');

                return $this->land($returnTo, [
                    'bd_oauth_error' => $failed === 'cancelled' ? 'cancelled' : 'failed',
                    'bd_oauth_message' => is_string($message) && $message !== '' ? $message : 'Sign-in didn\'t finish. Try again.',
                ])->withCookie($forget);
            }

            $code = $request->query('bd_oauth_code');
            $verifier = $request->cookie(self::PKCE_COOKIE);
            if (! is_string($code) || $code === '' || ! is_string($verifier) || $verifier === '') {
                return $this->land($returnTo, [
                    'bd_oauth_error' => 'failed',
                    'bd_oauth_message' => 'That sign-in took too long, or started in another browser. Try again.',
                ])->withCookie($forget);
            }

            try {
                $response = $client->once('POST', 'auth/customer/oauth/exchange', [
                    'code' => $code,
                    'codeVerifier' => $verifier,
                ]);
            } catch (\Throwable) {
                $response = null;
            }
            $session = $response?->json();
            if (! $response || $response->failed() || ! is_string($session['sessionToken'] ?? null) || ! is_string($session['expiresAt'] ?? null)) {
                $message = is_array($session) && is_string($session['message'] ?? null)
                    ? $session['message']
                    : 'Sign-in didn\'t finish. Try again.';

                return $this->land($returnTo, ['bd_oauth_error' => 'failed', 'bd_oauth_message' => $message])
                    ->withCookie($forget);
            }

            return $this->land($returnTo, [])
                ->withCookie($forget)
                ->withCookie(CustomerAuth::sessionCookie($request, $session['sessionToken'], $session['expiresAt']));
        }

        if (! in_array($rest, self::PROVIDERS, true)) {
            return $this->problem(404, 'not_found', 'Not found.');
        }

        $returnTo = $this->samePath($request->query('returnTo')) ?? '/my-account';
        $verifier = $this->base64Url(random_bytes(32));
        $challenge = $this->base64Url(hash('sha256', $verifier, true));

        try {
            $response = $client->once('POST', 'auth/customer/oauth/start', [
                'provider' => $rest,
                'redirectUri' => $client->siteOrigin().self::OAUTH_PATH.'/callback',
                'returnTo' => $returnTo,
                'codeChallenge' => $challenge,
            ]);
        } catch (\Throwable) {
            $response = null;
        }
        $start = $response?->json();
        if (! $response || $response->failed() || ! is_string($start['url'] ?? null)) {
            $message = is_array($start) && is_string($start['message'] ?? null)
                ? $start['message']
                : 'That sign-in isn\'t available just now. Try again, or use your email.';

            return $this->land($returnTo, ['bd_oauth_error' => 'failed', 'bd_oauth_message' => $message]);
        }

        return redirect()->away($start['url'])->withCookie(cookie(
            name: self::PKCE_COOKIE,
            value: $verifier,
            minutes: 10,
            path: self::OAUTH_PATH,
            domain: null,
            secure: $request->isSecure(),
            httpOnly: true,
            raw: false,
            sameSite: 'lax',
        ));
    }

    private function land(string $path, array $params): RedirectResponse
    {
        $query = $params ? (str_contains($path, '?') ? '&' : '?').http_build_query($params) : '';

        return redirect($path.$query, 303)->header('Cache-Control', 'no-store');
    }

    /** A path on this site, or null: one leading `/`, no `//`, `\` or control characters. */
    private function samePath(mixed $raw): ?string
    {
        if (! is_string($raw) || ! str_starts_with($raw, '/') || str_starts_with($raw, '//')) {
            return null;
        }
        if (preg_match('/[\\\\\x00-\x1f\x7f]/', $raw)) {
            return null;
        }

        return $raw;
    }

    private function base64Url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    private function problem(int $status, string $code, string $message): JsonResponse
    {
        return response()
            ->json(['error' => $code, 'message' => $message], $status)
            ->header('Cache-Control', 'no-store');
    }
}
