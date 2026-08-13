<?php

namespace App\Biab\Resources;

use App\Biab\Client;

/** The org-wide review wall (per-product reviews live on Storefront). */
class Reviews
{
    public function __construct(private readonly Client $client)
    {
    }

    /** @return array<string, mixed> */
    public function list(?int $limit = null, ?int $offset = null): array
    {
        return $this->client->get('reviews', [
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }
}
