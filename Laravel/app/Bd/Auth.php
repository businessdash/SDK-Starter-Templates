<?php

namespace App\Bd;

/**
 * Tenant sign-in / sign-up / sign-out.
 *
 * The flow, end to end:
 *
 *   GET  /api/bd-auth/sign-in?returnTo=/my-account
 *        → POST auth/start → 302 to the platform-hosted auth page
 *   GET  /api/bd-auth/callback?code=…&state=…
 *        → POST auth/exchange → httpOnly `bd_session` cookie → 302 returnTo
 *   GET  /api/bd-auth/sign-out
 *        → POST auth/sign-out → clear the cookie → 302 home
 *
 * The cookie lives on THIS app's domain, so ordinary Laravel middleware and
 * Blade can read it. The bearer key never leaves the server, and the browser
 * never sees a token other than its own opaque session value.
 *
 * `auth/me` takes the session in a lowercase `x-bd-session` header — note
 * that this differs from the `X-BD-Session-Token` header the cart and
 * customer-portal routes use. They are not interchangeable.
 */
class Auth
{
    public function __construct(
        private readonly Client $client,
        private readonly string $callbackUrl,
    ) {
    }

    public static function fromConfig(?Client $client = null): ?self
    {
        $client ??= Client::fromConfig();
        $callback = config('bd.auth_callback_url');

        if (! $client || ! $callback) {
            return null;
        }

        return new self($client, $callback);
    }

    /**
     * Where to send the browser to begin. `$intent` is "sign-in" or "sign-up".
     * `returnTo` must be absolute — the platform validates it against the
     * registered redirect URIs.
     */
    public function startUrl(string $intent, string $returnTo, ?string $loginHint = null): string
    {
        $response = $this->client->post('auth/start', array_filter([
            'intent' => $intent === 'sign-up' ? 'sign-up' : 'sign-in',
            'returnTo' => $this->absolutize($returnTo),
            'redirectUri' => $this->callbackUrl,
            'loginHint' => $loginHint,
        ], static fn ($v) => $v !== null));

        return $response['url'];
    }

    /**
     * Trade the callback's `code` for a session.
     *
     * @return array{sessionToken: string, expiresAt: string}
     */
    public function exchange(string $code, string $state): array
    {
        $response = $this->client->post('auth/exchange', [
            'code' => $code,
            'state' => $state,
            'redirectUri' => $this->callbackUrl,
        ]);

        return [
            'sessionToken' => $response['sessionToken'],
            'expiresAt' => $response['expiresAt'],
        ];
    }

    /**
     * Validate a cookie value. Returns null for absent / expired / revoked —
     * never throws, so a stale cookie renders as a signed-out page rather
     * than a 500.
     *
     * @return array<string, mixed>|null
     */
    public function session(?string $cookieValue): ?array
    {
        if (! $cookieValue) {
            return null;
        }

        try {
            return $this->client->get('auth/me', [], ['x-bd-session' => $cookieValue]);
        } catch (\Throwable) {
            return null;
        }
    }

    public function signOut(): void
    {
        try {
            $this->client->post('auth/sign-out');
        } catch (\Throwable) {
            // Best effort. The cookie is cleared either way — a failed
            // server-side revoke must not strand the user signed in locally.
        }
    }

    /**
     * The platform round-trips `returnTo` inside the OAuth `state` as
     * base64url JSON. Decode defensively: a malformed state is a redirect
     * target an attacker controls.
     */
    public function returnToFromState(?string $state, string $fallback = '/'): string
    {
        if (! $state) {
            return $fallback;
        }

        $padded = strtr($state, '-_', '+/');
        $decoded = base64_decode($padded, true);
        if ($decoded === false) {
            return $fallback;
        }

        $parsed = json_decode($decoded, true);
        $returnTo = is_array($parsed) ? ($parsed['returnTo'] ?? null) : null;
        if (! is_string($returnTo) || $returnTo === '') {
            return $fallback;
        }

        // Only ever redirect somewhere on this site.
        $path = parse_url($returnTo, PHP_URL_PATH) ?: '/';
        $query = parse_url($returnTo, PHP_URL_QUERY);

        return $query ? $path.'?'.$query : $path;
    }

    private function absolutize(string $returnTo): string
    {
        if (str_starts_with($returnTo, 'http://') || str_starts_with($returnTo, 'https://')) {
            return $returnTo;
        }

        return rtrim(config('bd.site_origin'), '/').'/'.ltrim($returnTo, '/');
    }
}
