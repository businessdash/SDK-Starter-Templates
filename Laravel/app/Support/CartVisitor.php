<?php

namespace App\Support;

use App\Bd\Bd;
use App\Bd\Client;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * The visitor's cart token: an httpOnly cookie on this domain, minted on the
 * first add. The cart itself lives at BD, keyed on whatever arrives in
 * `X-BD-Cart-Visitor`, so nothing about it is in the session or the DB.
 */
class CartVisitor
{
    public static function token(Request $request): ?string
    {
        $token = $request->cookie(config('bd.cart_cookie'));

        return is_string($token) && $token !== '' ? $token : null;
    }

    /**
     * The token, minting one on first write. Returns the token plus the
     * cookie to attach (null when one already existed).
     *
     * The token is just an opaque id WE generate — there is no round trip to
     * mint one. (`cart/session` exists but mints a tokenized iframe-embed
     * URL, which is a different feature.)
     *
     * @return array{0: string, 1: ?Cookie}
     */
    public static function ensure(Request $request): array
    {
        $existing = self::token($request);
        if ($existing) {
            return [$existing, null];
        }

        $token = (string) Str::uuid();

        // 30 days, httpOnly — the browser never needs to read this.
        $cookie = cookie(
            name: config('bd.cart_cookie'),
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

    /** The items in this visitor's cart, for the store bar; 0 without a cart. */
    public static function itemCount(Request $request): int
    {
        $token = self::token($request);
        if (! $token) {
            return 0;
        }
        $cart = Bd::attempt(static fn (Client $c) => $c->cart($token)->get(), default: null);

        return (int) data_get($cart, 'itemCount', 0);
    }
}
