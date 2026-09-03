<?php

namespace App\Http\Controllers;

use App\Bd\Auth;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Mounts the whole tenant-auth flow at `/api/bd-auth/{action}`.
 *
 * `BD_AUTH_CALLBACK_URL` must point at this route's `callback` action and
 * be registered as a redirect URI on the BD site, or `auth/start` refuses.
 */
class BdAuthController extends Controller
{
    public function __invoke(Request $request, string $action)
    {
        $auth = Auth::fromConfig();
        if (! $auth) {
            return response('BD auth is not configured.', 503);
        }

        return match ($action) {
            'sign-in', 'sign-up' => $this->start($request, $auth, $action),
            'callback' => $this->callback($request, $auth),
            'sign-out' => $this->signOut($request, $auth),
            default => response('Not found', 404),
        };
    }

    private function start(Request $request, Auth $auth, string $intent)
    {
        $returnTo = $request->query('returnTo', '/my-account');

        try {
            return redirect()->away($auth->startUrl(
                $intent,
                is_string($returnTo) ? $returnTo : '/my-account',
                $request->query('loginHint'),
            ));
        } catch (\Throwable $e) {
            // Plain text, not an exception page: a failed redirect here is
            // almost always a missing `tenant_auth:public` scope or an
            // unregistered redirect URI, and the message says which.
            return response(
                "Sign-in could not start.\n\n".$e->getMessage()."\n\n".
                "Check that the API key carries the tenant_auth scope and that\n".
                'BD_AUTH_CALLBACK_URL is registered as a redirect URI.',
                502
            )->header('Content-Type', 'text/plain; charset=utf-8');
        }
    }

    private function callback(Request $request, Auth $auth)
    {
        $code = $request->query('code');
        $state = $request->query('state');

        if (! is_string($code) || $code === '') {
            return response('Missing code', 400);
        }
        if (! is_string($state) || trim($state) === '') {
            return response('Missing OAuth state', 400);
        }

        try {
            $session = $auth->exchange($code, $state);
        } catch (\Throwable $e) {
            return response('Sign-in failed: '.$e->getMessage(), 400);
        }

        $expiresAt = strtotime($session['expiresAt']) ?: (time() + 60 * 60 * 24 * 7);
        $minutes = max(1, (int) round(($expiresAt - time()) / 60));

        return redirect($auth->returnToFromState($state, '/my-account'))
            ->withCookie(cookie(
                name: config('bd.session_cookie'),
                value: $session['sessionToken'],
                minutes: $minutes,
                path: '/',
                domain: null,
                secure: $request->isSecure(),
                httpOnly: true,
                raw: false,
                sameSite: 'lax',
            ));
    }

    private function signOut(Request $request, Auth $auth): Response
    {
        $auth->signOut();

        $response = $request->isMethod('POST')
            ? response()->json(['ok' => true])
            : redirect('/');

        return $response->withCookie(
            cookie()->forget(config('bd.session_cookie'), '/')
        );
    }
}
