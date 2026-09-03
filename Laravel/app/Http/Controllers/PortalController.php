<?php

namespace App\Http\Controllers;

use App\Bd\Auth;
use App\Bd\Bd;
use App\Bd\Client;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Customer portal. Everything here is per-customer, so nothing is cached —
 * `Bd::attempt()` rather than `Bd::remember()`.
 */
class PortalController extends Controller
{
    public function index(Request $request): View|RedirectResponse
    {
        $session = $this->session($request);
        if (! $session) {
            return redirect('/api/bd-auth/sign-in?returnTo=/my-account');
        }

        $token = $request->cookie(config('bd.session_cookie'));

        $work = Bd::attempt(
            static fn (Client $c) => $c->portal($token, $session['organizationId'] ?? null)->getWork(),
            default: null,
        );

        return view('pages.my-account', [
            'user' => $session['user'] ?? null,
            'work' => $work,
        ]);
    }

    public function submitReview(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'body' => ['required', 'string', 'max:4000'],
        ]);

        $session = $this->session($request);
        if (! $session) {
            return redirect('/api/bd-auth/sign-in?returnTo=/my-account');
        }

        $token = $request->cookie(config('bd.session_cookie'));

        $result = Bd::attempt(static fn (Client $c) => $c
            ->portal($token, $session['organizationId'] ?? null)
            ->submitReview([
                'rating' => $validated['rating'],
                'body' => $validated['body'],
            ]));

        return back()->with(
            'review_status',
            $result ? 'Thanks for the review.' : 'Could not submit that review.'
        );
    }

    /** @return array<string, mixed>|null */
    private function session(Request $request): ?array
    {
        $auth = Auth::fromConfig();
        if (! $auth) {
            return null;
        }

        $cookie = $request->cookie(config('bd.session_cookie'));

        return $auth->session(is_string($cookie) ? $cookie : null);
    }
}
