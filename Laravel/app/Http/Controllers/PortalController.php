<?php

namespace App\Http\Controllers;

use App\Biab\Auth;
use App\Biab\Biab;
use App\Biab\Client;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Customer portal. Everything here is per-customer, so nothing is cached —
 * `Biab::attempt()` rather than `Biab::remember()`.
 */
class PortalController extends Controller
{
    public function index(Request $request): View|RedirectResponse
    {
        $session = $this->session($request);
        if (! $session) {
            return redirect('/api/biab-auth/sign-in?returnTo=/my-account');
        }

        $token = $request->cookie(config('biab.session_cookie'));

        $work = Biab::attempt(
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
            return redirect('/api/biab-auth/sign-in?returnTo=/my-account');
        }

        $token = $request->cookie(config('biab.session_cookie'));

        $result = Biab::attempt(static fn (Client $c) => $c
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

        $cookie = $request->cookie(config('biab.session_cookie'));

        return $auth->session(is_string($cookie) ? $cookie : null);
    }
}
