<?php

namespace App\Bd\Resources;

use App\Bd\Client;

/** Posts, categories, tags, threaded comments, reactions. */
class Blog
{
    public function __construct(private readonly Client $client) {}

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

    /**
     * Comment as the signed-in customer (`$sessionToken`, the `bd_session`
     * cookie). The reply carries the comment and the moderation verdict:
     * `moderation.isApproved` false means it waits for review.
     *
     * @return array<string, mixed>
     */
    public function postComment(string $slug, string $content, string $sessionToken): array
    {
        return $this->client->post(
            'blog/posts/'.rawurlencode($slug).'/comments',
            ['content' => $content],
            ['X-BD-Session-Token' => $sessionToken],
        );
    }

    /**
     * `{ liked, likesCount }`. With a session, `liked` says whether this
     * customer already liked the post; without one it is false.
     *
     * @return array<string, mixed>
     */
    public function likeStatus(string $slug, ?string $sessionToken = null): array
    {
        return $this->client->get(
            'blog/posts/'.rawurlencode($slug).'/like',
            [],
            $sessionToken ? ['X-BD-Session-Token' => $sessionToken] : [],
        );
    }

    /**
     * Like or unlike as the signed-in customer; returns the new
     * `{ liked, likesCount }`.
     *
     * @return array<string, mixed>
     */
    public function toggleLike(string $slug, string $sessionToken): array
    {
        return $this->client->post(
            'blog/posts/'.rawurlencode($slug).'/like',
            null,
            ['X-BD-Session-Token' => $sessionToken],
        );
    }
}
