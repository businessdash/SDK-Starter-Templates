<?php

namespace App\Biab\Resources;

use App\Biab\Client;

/**
 * Checkout hand-off. `start()` returns a Stripe Checkout URL — redirect to
 * it with a 303 so the browser re-issues as GET.
 *
 * Payment never touches this app: no card data crosses this process, which
 * is what keeps a Laravel consumer out of PCI scope.
 */
class Checkout
{
    public function __construct(
        private readonly Client $client,
        private readonly ?string $visitorToken = null,
        private readonly ?string $sessionToken = null,
    ) {
    }

    /**
     * @param  array<string, mixed>  $input  successUrl / cancelUrl / customerEmail …
     * @return array<string, mixed>
     */
    public function start(array $input): array
    {
        return $this->client->post('checkout/start', $input, $this->headers());
    }

    /** @return array<string, mixed> */
    public function get(string $sessionId): array
    {
        return $this->client->get('checkout/'.rawurlencode($sessionId), [], $this->headers());
    }

    /** @return array<string, string> */
    private function headers(): array
    {
        $out = [];
        if ($this->visitorToken) {
            $out['X-BIAB-Cart-Visitor'] = $this->visitorToken;
        }
        if ($this->sessionToken) {
            $out['X-BIAB-Session-Token'] = $this->sessionToken;
        }

        return $out;
    }
}
