<?php

namespace App\Bd\Resources;

use App\Bd\Client;

/**
 * The business's own reviews (Google, Yelp, Housecall Pro and the dashboard);
 * a product's reviews live on Storefront. The average and the stars
 * breakdown ride the marketing bundle's `reviews`.
 */
class Reviews
{
    public function __construct(private readonly Client $client) {}

    /**
     * One page, newest first: `{ items, totalCount, nextOffset }`. `$source`
     * narrows to one platform (google, yelp, housecall_pro, other).
     *
     * @return array<string, mixed>
     */
    public function list(?int $limit = null, ?int $offset = null, ?string $source = null): array
    {
        return $this->client->get('reviews', [
            'limit' => $limit,
            'offset' => $offset,
            'source' => $source,
        ]);
    }
}
