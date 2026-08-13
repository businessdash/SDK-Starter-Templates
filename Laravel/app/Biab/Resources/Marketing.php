<?php

namespace App\Biab\Resources;

use App\Biab\Client;

/**
 * Schema-driven marketing content.
 *
 * `biab.config.ts` declares the SHAPE (run `npm run sync-schema` to push it);
 * the dashboard fills in the CONTENT; `getPageBundle()` reads it back. Every
 * section here should render a local fallback when the bundle is missing, so
 * a fresh clone with no BIAB env still shows a complete page.
 */
class Marketing
{
    public function __construct(private readonly Client $client)
    {
    }

    /** @return array<string, mixed> */
    public function getPageBundle(string $pageKey = 'home', ?string $locale = null): array
    {
        return $this->client->get($this->client->sitePath('marketing/bundle'), [
            'pageKey' => $pageKey,
            'locale' => $locale,
        ]);
    }

    /** @return array<string, mixed> */
    public function getPublishedSchema(): array
    {
        return $this->client->get($this->client->sitePath('marketing/published-schema'));
    }

    /** @return array<string, mixed> */
    public function getLocales(): array
    {
        return $this->client->get($this->client->sitePath('marketing/locales'));
    }

    /** @return array<string, mixed> */
    public function branding(): array
    {
        return $this->client->get($this->client->sitePath('branding'));
    }
}
