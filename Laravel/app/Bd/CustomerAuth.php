<?php

namespace App\Bd;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * One step of customer sign-in at BD — `auth/customer/*`, which runs it
 * through WorkOS. Shared by the JSON routes (`BdCustomerAuthController`, for
 * apps and pages that bring their own screen) and the sign-in screen on
 * /my-account (`App\Livewire\SignIn`).
 */
final class CustomerAuth
{
    /** path => [method, signs someone in] */
    public const ROUTES = [
        'options' => ['GET', false],
        'sign-in' => ['POST', true],
        'sign-up' => ['POST', false],
        'forgot-password' => ['POST', false],
        'verify' => ['POST', true],
        'id-token' => ['POST', true],
    ];

    public const UNAVAILABLE = 'Sign-in isn\'t available just now. Try again in a minute.';

    /** @param  array<string, mixed>|null  $body */
    public static function forward(?Client $client, string $path, ?array $body = null): CustomerAnswer
    {
        if (! $client) {
            return CustomerAnswer::refused(503, 'unavailable', 'Sign-in isn\'t set up yet.');
        }
        $route = self::ROUTES[$path] ?? null;
        if (! $route) {
            return CustomerAnswer::refused(404, 'not_found', 'Not found.');
        }
        [$method, $signsIn] = $route;

        try {
            $response = $client->once($method, "auth/customer/{$path}", $method === 'POST' ? $body : null);
        } catch (\Throwable) {
            return CustomerAnswer::refused(502, 'unavailable', self::UNAVAILABLE);
        }

        $reply = $response->json();
        $reply = is_array($reply) ? $reply : [];
        if ($response->failed()) {
            // BD's own answer (wrong password, expired code…), passed on.
            $status = $response->status();
            $message = is_string($reply['message'] ?? null) && trim($reply['message']) !== ''
                ? $reply['message']
                : ($status === 429 ? 'That\'s a lot of tries. Wait a few minutes, then try again.' : self::UNAVAILABLE);
            $code = is_string($reply['error'] ?? null)
                ? $reply['error']
                : ($status === 429 ? 'too_many_tries' : 'unavailable');

            return CustomerAnswer::refused($status >= 400 && $status <= 599 ? $status : 502, $code, $message);
        }

        if (! $signsIn) {
            return CustomerAnswer::answered($reply);
        }
        // Sign-in can answer "confirm your email first" (a code was sent).
        if (is_string($reply['pendingId'] ?? null) && ! array_key_exists('sessionToken', $reply)) {
            return CustomerAnswer::answered($reply);
        }
        if (! is_string($reply['sessionToken'] ?? null) || ! is_string($reply['expiresAt'] ?? null)
            || strtotime($reply['expiresAt']) === false) {
            return CustomerAnswer::refused(502, 'unavailable', self::UNAVAILABLE);
        }

        return CustomerAnswer::signedIn($reply['sessionToken'], $reply['expiresAt'], $reply);
    }

    /** The httpOnly `bd_session` cookie — the token never reaches page scripts. */
    public static function sessionCookie(Request $request, string $token, string $expiresAt): Cookie
    {
        $expires = strtotime($expiresAt) ?: (time() + 60 * 60 * 24 * 7);

        return cookie(
            name: config('bd.session_cookie'),
            value: $token,
            minutes: max(1, (int) round(($expires - time()) / 60)),
            path: '/',
            domain: null,
            secure: $request->isSecure(),
            httpOnly: true,
            raw: false,
            sameSite: 'lax',
        );
    }
}
