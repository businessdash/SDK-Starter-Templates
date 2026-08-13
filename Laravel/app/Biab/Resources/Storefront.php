<?php

namespace App\Biab\Resources;

use App\Biab\Client;

/** Products, categories, and the per-product detail reads behind a shop. */
class Storefront
{
    public function __construct(private readonly Client $client)
    {
    }

    /** @return array<string, mixed> */
    public function listProducts(?int $limit = null, int|string|null $cursor = null, ?string $categoryId = null): array
    {
        return $this->client->get('storefront/products', [
            'limit' => $limit,
            'cursor' => $cursor,
            'categoryId' => $categoryId,
        ]);
    }

    /**
     * The full shop grid: enriched cards plus `categoryCounts` and the
     * catalog-wide `priceRange` for a filter sidebar.
     *
     * `sort` is one of featured | newest | price-asc | price-desc | rating-desc.
     *
     * @return array<string, mixed>
     */
    public function listProductsWithMeta(
        ?string $search = null,
        ?string $categoryId = null,
        ?int $minPriceCents = null,
        ?int $maxPriceCents = null,
        ?int $minRating = null,
        ?string $sort = null,
        ?int $limit = null,
        int|string|null $cursor = null,
    ): array {
        return $this->client->get('storefront/products', [
            'meta' => '1',
            'search' => $search,
            'categoryId' => $categoryId,
            'minPriceCents' => $minPriceCents,
            'maxPriceCents' => $maxPriceCents,
            'minRating' => $minRating,
            'sort' => $sort,
            'limit' => $limit,
            'cursor' => $cursor,
        ]);
    }

    /** @return array<string, mixed> */
    public function listCategories(): array
    {
        return $this->client->get('storefront/categories');
    }

    /** @return array<string, mixed> */
    public function getProduct(string $productId): array
    {
        return $this->client->get('storefront/products/'.rawurlencode($productId));
    }

    /** @return array<string, mixed> */
    public function getProductReviews(string $productId, ?int $limit = null, int|string|null $cursor = null): array
    {
        return $this->client->get('storefront/products/'.rawurlencode($productId).'/reviews', [
            'limit' => $limit,
            'cursor' => $cursor,
        ]);
    }

    /** @return array<string, mixed> */
    public function getRelatedProducts(string $productId, ?int $limit = null): array
    {
        return $this->client->get('storefront/products/'.rawurlencode($productId).'/related', [
            'limit' => $limit,
        ]);
    }

    /** @return array<string, mixed> */
    public function getProductAddons(string $productId): array
    {
        return $this->client->get('storefront/products/'.rawurlencode($productId).'/addons');
    }
}
