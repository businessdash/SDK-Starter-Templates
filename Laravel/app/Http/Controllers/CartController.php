<?php

namespace App\Http\Controllers;

use App\Bd\Bd;
use App\Bd\Client;
use App\Support\CartVisitor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Cart + checkout hand-off.
 *
 * The visitor token lives in an httpOnly cookie on this domain; the cart
 * itself lives at BD (App\Support\CartVisitor). Nothing about the cart is
 * in the session or the DB, which is why this works unchanged behind a load
 * balancer with no sticky sessions.
 */
class CartController extends Controller
{
    public function show(Request $request): View
    {
        $token = CartVisitor::token($request);

        $cart = $token
            ? Bd::attempt(static fn (Client $c) => $c->cart($token)->get(), default: null)
            : null;

        return view('pages.cart', [
            'cart' => $cart,
            'cartCount' => (int) data_get($cart, 'itemCount', 0),
        ]);
    }

    /**
     * Add to the cart, for `<bd-product>` on the product page: JSON
     * `{ productId, variantId?, quantity?, options? }` in; `{ ok, itemCount }`
     * or `{ ok: false, error }` out. The first add mints the visitor's cart
     * cookie. The element sends the page's CSRF token (the `csrf-token` meta
     * in the layout) as `X-CSRF-Token`, which Laravel checks as for a form.
     */
    public function addJson(Request $request): JsonResponse
    {
        $reply = static fn (array $body, int $status = 200) => response()
            ->json($body, $status)
            ->header('Cache-Control', 'no-store');
        if (! Bd::configured()) {
            return $reply(['ok' => false, 'error' => "The store isn't connected yet."], 503);
        }
        if (! $request->isJson()) {
            return $reply(['ok' => false, 'error' => 'Send JSON.'], 415);
        }
        $productId = $request->json('productId');
        if (! is_string($productId) || $productId === '') {
            return $reply(['ok' => false, 'error' => 'Choose a product.'], 400);
        }
        $quantity = max(1, min(99, (int) ($request->json('quantity') ?? 1)));
        $variantId = $request->json('variantId');
        $options = array_filter(
            (array) ($request->json('options') ?? []),
            static fn ($value) => is_string($value),
        );

        [$token, $cookie] = CartVisitor::ensure($request);
        $cart = Bd::attempt(static fn (Client $c) => $c->cart($token)->addItem(array_filter([
            'productId' => $productId,
            'quantity' => $quantity,
            'variantId' => is_string($variantId) && $variantId !== '' ? $variantId : null,
            'options' => $options !== [] ? $options : null,
        ], static fn ($value) => $value !== null)));

        $response = $cart === null
            ? $reply(['ok' => false, 'error' => "Couldn't add that to your cart. Try again."], 502)
            : $reply(['ok' => true, 'itemCount' => (int) data_get($cart, 'itemCount', 0)]);

        return $cookie ? $response->withCookie($cookie) : $response;
    }

    public function addItem(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'productId' => ['required', 'string'],
            'quantity' => ['nullable', 'integer', 'min:1'],
        ]);

        [$token, $cookie] = CartVisitor::ensure($request);

        Bd::attempt(static fn (Client $c) => $c->cart($token)->addItem([
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

        $token = CartVisitor::token($request);
        if ($token) {
            Bd::attempt(static fn (Client $c) => $c->cart($token)
                ->updateItem($itemId, ['quantity' => $validated['quantity']]));
        }

        return redirect()->route('cart');
    }

    public function removeItem(Request $request, string $itemId): RedirectResponse
    {
        $token = CartVisitor::token($request);
        if ($token) {
            Bd::attempt(static fn (Client $c) => $c->cart($token)->removeItem($itemId));
        }

        return redirect()->route('cart');
    }

    public function applyCoupon(Request $request): RedirectResponse
    {
        $validated = $request->validate(['code' => ['required', 'string', 'max:80']]);
        $token = CartVisitor::token($request);

        if ($token) {
            $result = Bd::attempt(
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
        $token = CartVisitor::token($request);
        if ($token) {
            Bd::attempt(static fn (Client $c) => $c->cart($token)->removeCoupon());
        }

        return redirect()->route('cart');
    }

    public function clear(Request $request): RedirectResponse
    {
        $token = CartVisitor::token($request);
        if ($token) {
            Bd::attempt(static fn (Client $c) => $c->cart($token)->clear());
        }

        return redirect()->route('cart');
    }

    /**
     * Hand off to Stripe. 303 so the browser re-issues the redirect as GET —
     * a 302 after POST is technically allowed to repeat the POST.
     */
    public function checkout(Request $request): RedirectResponse
    {
        $token = CartVisitor::token($request);
        if (! $token) {
            return redirect()->route('cart');
        }

        $session = Bd::attempt(static fn (Client $c) => $c->checkout($token)->start([
            // Stripe substitutes the real id for the placeholder on success.
            'successUrl' => route('store.order').'?session_id={CHECKOUT_SESSION_ID}',
            'cancelUrl' => route('cart'),
        ]));

        $url = $session['stripeUrl'] ?? null;
        if (! is_string($url)) {
            return redirect()->route('cart')->with('cart_error', 'Could not start checkout.');
        }

        return redirect()->away($url, 303);
    }
}
