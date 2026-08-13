<?php

namespace App\Biab\Resources;

use App\Biab\Client;

/**
 * Newsletter / update subscribers. Backs the Subscribe section.
 *
 * Followers ride the site ACTIONS endpoint rather than a route of their own:
 * `POST sites/{siteId}/actions/{actionName}` with the arguments wrapped in
 * `{ payload: … }`. Same envelope for every named action, so `run()` is
 * reusable for any other one the org exposes.
 */
class Followers
{
    public function __construct(private readonly Client $client)
    {
    }

    /** @return array<string, mixed> */
    public function join(string $email, ?string $name = null, ?string $source = null): array
    {
        return $this->run('followers.join', array_filter([
            'email' => $email,
            'name' => $name,
            'source' => $source,
        ], static fn ($v) => $v !== null));
    }

    /** @return array<string, mixed> */
    public function me(string $email): array
    {
        return $this->run('followers.me', ['email' => $email]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function run(string $actionName, array $payload = []): array
    {
        return $this->client->post(
            $this->client->sitePath('actions/'.rawurlencode($actionName)),
            ['payload' => (object) $payload],
        );
    }
}
