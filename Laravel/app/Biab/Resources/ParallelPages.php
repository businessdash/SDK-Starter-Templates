<?php

namespace App\Biab\Resources;

use App\Biab\Client;

/**
 * Programmatic SEO. One template × N variant tuples — `/services/{service}/{area}`
 * and friends — rendered by the platform so the copy stays editable in the
 * dashboard rather than hard-coded here.
 *
 * `listVariants()` is what a sitemap iterates.
 */
class ParallelPages
{
    public function __construct(private readonly Client $client)
    {
    }

    /** @return array<string, mixed> */
    public function list(): array
    {
        return $this->client->get($this->client->sitePath('parallel-pages'));
    }

    /** @return array<string, mixed> */
    public function listVariants(string $key): array
    {
        return $this->client->get(
            $this->client->sitePath('parallel-pages/'.rawurlencode($key).'/variants')
        );
    }

    /**
     * @param  array<string, string>  $params  one value per variant axis
     * @return array<string, mixed>
     */
    public function render(string $key, array $params): array
    {
        return $this->client->get(
            $this->client->sitePath('parallel-pages/'.rawurlencode($key).'/render'),
            $params
        );
    }
}
