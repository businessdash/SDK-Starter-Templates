<?php

namespace App\Bd\Resources;

use App\Bd\Client;

/** Subscription plans + the Stripe checkout hand-off for one. */
class Subscriptions
{
    public function __construct(private readonly Client $client)
    {
    }

    /** @return array<string, mixed> */
    public function list(): array
    {
        return $this->client->get('subscriptions');
    }

    /** @return array<string, mixed> */
    public function get(string $id): array
    {
        return $this->client->get('subscriptions/'.rawurlencode($id));
    }

    /**
     * @param  array<string, mixed>  $input  successUrl / cancelUrl / customerEmail
     * @return array<string, mixed>
     */
    public function checkout(string $id, array $input): array
    {
        return $this->client->post('subscriptions/'.rawurlencode($id).'/checkout', $input);
    }
}
