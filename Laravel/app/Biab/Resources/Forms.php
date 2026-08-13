<?php

namespace App\Biab\Resources;

use App\Biab\Client;

/**
 * Org-defined forms — schema in, submission out.
 *
 * Two ways to render one, and this starter ships both:
 *
 *  1. Server-side. `schema()` here, hand-render the fields in Blade,
 *     `submit()` on POST. Full control, no JS — but you own conditional
 *     blocks, availability pickers and file uploads yourself.
 *  2. The `<biab-form>` web component from the CDN, pointed at this app's
 *     own `/api/biab/forms/*` proxy. It renders the whole schema, including
 *     the parts a hand-rolled server fragment can't, and the bearer key
 *     still never leaves this process.
 *
 * `submit()` also happens to be the documented CREATE path for a custom
 * collection: point a form's output at the collection and POST here.
 */
class Forms
{
    public function __construct(private readonly Client $client)
    {
    }

    /** @return array<string, mixed> */
    public function schema(string $slug): array
    {
        return $this->client->get('forms/'.rawurlencode($slug));
    }

    /**
     * @param  array<string, mixed>  $data  values keyed by field id
     * @return array<string, mixed>
     */
    public function submit(
        string $slug,
        array $data,
        ?string $submitterEmail = null,
        ?string $submitterName = null,
        bool $dryRun = false,
        ?string $source = null,
        ?string $referrer = null,
    ): array {
        return $this->client->post('forms/'.rawurlencode($slug), array_filter([
            'data' => $data,
            'submitterEmail' => $submitterEmail,
            'submitterName' => $submitterName,
            'dryRun' => $dryRun ?: null,
            'source' => $source,
            'referrer' => $referrer,
        ], static fn ($v) => $v !== null));
    }
}
