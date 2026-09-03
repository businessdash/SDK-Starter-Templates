<?php

namespace App\Bd\Resources;

use App\Bd\Client;

/**
 * Server-side cart. All state lives at BD — this app only holds the
 * visitor token, in an httpOnly cookie, so a cart survives a page load
 * without any of it living in the browser.
 *
 * Anonymous visitor: `X-BD-Cart-Visitor`.
 * Signed-in customer: `X-BD-Session-Token` (carts merge on sign-in).
 */
class Cart
{
    public function __construct(
        private readonly Client $client,
        private readonly ?string $visitorToken = null,
        private readonly ?string $sessionToken = null,
    ) {
    }

    /** Mint a fresh anonymous visitor token. Store the result in a cookie. */
    public function createSession(): array
    {
        return $this->client->post('cart/session');
    }

    /** @return array<string, mixed> */
    public function get(): array
    {
        return $this->client->get('cart', [], $this->headers());
    }

    /** @param array<string, mixed> $input */
    public function addItem(array $input): array
    {
        return $this->client->post('cart/items', $input, $this->headers());
    }

    /** @param array<string, mixed> $input */
    public function updateItem(string $itemId, array $input): array
    {
        return $this->client->patch('cart/items/'.rawurlencode($itemId), $input, $this->headers());
    }

    public function removeItem(string $itemId): array
    {
        return $this->client->delete('cart/items/'.rawurlencode($itemId), $this->headers());
    }

    public function applyCoupon(string $code): array
    {
        return $this->client->post('cart/coupon', ['code' => $code], $this->headers());
    }

    public function removeCoupon(): array
    {
        return $this->client->delete('cart/coupon', $this->headers());
    }

    public function clear(): array
    {
        return $this->client->post('cart/clear', null, $this->headers());
    }

    /** @return array<string, string> */
    private function headers(): array
    {
        $out = [];
        if ($this->visitorToken) {
            $out['X-BD-Cart-Visitor'] = $this->visitorToken;
        }
        if ($this->sessionToken) {
            $out['X-BD-Session-Token'] = $this->sessionToken;
        }

        return $out;
    }
}
