<?php

namespace App\Biab\Resources;

use App\Biab\Client;

/** Posts, categories, tags, threaded comments, reactions. */
class Blog
{
    public function __construct(private readonly Client $client)
    {
    }

    /** @return array<string, mixed> */
    public function listPosts(?int $limit = null, int|string|null $cursor = null, ?string $categoryId = null): array
    {
        return $this->client->get('blog/posts', [
            'limit' => $limit,
            'cursor' => $cursor,
            'categoryId' => $categoryId,
        ]);
    }

    /** @return array<string, mixed> */
    public function getPost(string $slug): array
    {
        return $this->client->get('blog/posts/'.rawurlencode($slug));
    }

    /** @return array<string, mixed> */
    public function listCategories(): array
    {
        return $this->client->get('blog/categories');
    }

    /** @return array<string, mixed> */
    public function listTags(): array
    {
        return $this->client->get('blog/tags');
    }

    /** @return array<string, mixed> */
    public function listComments(string $slug, ?int $limit = null, int|string|null $cursor = null): array
    {
        return $this->client->get('blog/posts/'.rawurlencode($slug).'/comments', [
            'limit' => $limit,
            'cursor' => $cursor,
        ]);
    }
}
