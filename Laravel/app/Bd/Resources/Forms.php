<?php

namespace App\Bd\Resources;

use App\Bd\Client;

/**
 * Org-defined forms — schema in, submission out.
 *
 * The raw calls. To show a form, use `<livewire:bd-form slug="…" />`
 * (App\Livewire\BdForm): it draws the whole schema on this server with the
 * forms engine in app/Bd/Forms (conditions, steps, calculations, uploads)
 * and submits through its own client, App\Bd\Forms\PackageBackend.
 *
 * `submit()` also happens to be the documented CREATE path for a custom
 * collection: point a form's output at the collection and POST here.
 */
class Forms
{
    public function __construct(private readonly Client $client) {}

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
