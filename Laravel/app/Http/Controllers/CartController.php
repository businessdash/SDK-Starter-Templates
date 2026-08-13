<?php

namespace App\Http\Controllers;

use App\Biab\Biab;
use App\Biab\Client;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Cart + checkout hand-off.
 *
 * The visitor token lives in an httpOnly cookie on this domain; the cart
 * itself lives at BIAB. Nothing about the cart is in the session or the DB,
 * which is why this works unchanged behind a load balancer with no sticky
 * sessions.
 */
class CartController extends Controller
{
    public function show(Request $request): View
    {
        $token = $this->visitorToken($request);

        $cart = $token
            ? Biab::attempt(static fn (Client $c) => $c->cart($token)->get(), default: null)
            : null;

        return view('pages.cart', ['cart' => $cart]);
    }

    public function addItem(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'productId' => ['required', 'string'],
            'quantity' => ['nullable', 'integer', 'min:1'],
        ]);

        [$token, $cookie] = $this->ensureVisitorToken($request);
        if (! $token) {
            return back()->with('cart_error', 'Store is not configured.');
        }

        Biab::attempt(static fn (Client $c) => $c->cart($token)->addItem([
            'productId' => $validated['productId'],
            'quantity' => $validated['quantity'] ?? 1,
        ]));

        $response = redirect()->route('cart');

        return $cookie ? $response->withCookie($cookie) : $response;
    }

    public function updateItem(Request $request, string $itemId): RedirectResponse
    {
        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:0'],
        ]);

        $token = $this->visitorToken($request);
        if ($token) {
            Biab::attempt(static fn (Client $c) => $c->cart($token)
                ->updateItem($itemId, ['quantity' => $validated['quantity']]));
        }

        return redirect()->route('cart');
    }

    public function removeItem(Request $request, string $itemId): RedirectResponse
    {
        $token = $this->visitorToken($request);
        if ($token) {
            Biab::attempt(static fn (Client $c) => $c->cart($token)->removeItem($itemId));
        }

        return redirect()->route('cart');
    }

    public function applyCoupon(Request $request): RedirectResponse
    {
        $validated = $request->validate(['code' => ['required', 'string', 'max:80']]);
        $token = $this->visitorToken($request);

        if ($token) {
            $result = Biab::attempt(
                static fn (Client $c) => $c->cart($token)->applyCoupon($validated['code'])
            );
            if (! $result) {
                return redirect()->route('cart')->with('cart_error', 'That code did not apply.');
            }
        }

        return redirect()->route('cart');
    }

    public function removeCoupon(Request $request): RedirectResponse
    {
        $token = $this->visitorToken($request);
        if ($token) {
            Biab::attempt(static fn (Client $c) => $c->cart($token)->removeCoupon());
        }

        return redirect()->route('cart');
    }

    public function clear(Request $request): RedirectResponse
    {
        $token = $this->visitorToken($request);
        if ($token) {
            Biab::attempt(static fn (Client $c) => $c->cart($token)->clear());
        }

        return redirect()->route('cart');
    }

    /**
     * Hand off to Stripe. 303 so the browser re-issues the redirect as GET —
     * a 302 after POST is technically allowed to repeat the POST.
     */
    public function checkout(Request $request): RedirectResponse
    {
        $token = $this->visitorToken($request);
        if (! $token) {
            return redirect()->route('cart');
        }

        $session = Biab::attempt(static fn (Client $c) => $c->checkout($token)->start([
            // Stripe substitutes the real id for the placeholder on success.
            'successUrl' => route('store').'?session_id={CHECKOUT_SESSION_ID}',
            'cancelUrl' => route('cart'),
        ]));

        $url = $session['stripeUrl'] ?? null;
        if (! is_string($url)) {
            return redirect()->route('cart')->with('cart_error', 'Could not start checkout.');
        }

        return redirect()->away($url, 303);
    }

    private function visitorToken(Request $request): ?string
    {
        $token = $request->cookie(config('biab.cart_cookie'));

        return is_string($token) && $token !== '' ? $token : null;
    }

    /**
     * Mint a visitor token on first write. Returns the token plus the cookie
     * to attach (null when one already existed).
     *
     * The token is just an opaque id WE generate — there is no round trip to
     * mint one. The platform keys the cart on whatever arrives in
     * `X-BIAB-Cart-Visitor`. (`cart/session` exists but mints a tokenized
     * iframe-embed URL, which is a different feature.)
     *
     * @return array{0: ?string, 1: ?\Symfony\Component\HttpFoundation\Cookie}
     */
    private function ensureVisitorToken(Request $request): array
    {
        $existing = $this->visitorToken($request);
        if ($existing) {
            return [$existing, null];
        }

        $token = (string) \Illuminate\Support\Str::uuid();

        // 30 days, httpOnly — the browser never needs to read this.
        $cookie = cookie(
            name: config('biab.cart_cookie'),
            value: $token,
            minutes: 60 * 24 * 30,
            path: '/',
            domain: null,
            secure: $request->isSecure(),
            httpOnly: true,
            raw: false,
            sameSite: 'lax',
        );

        return [$token, $cookie];
    }
}
