<?php

namespace App\Bd\Resources;

use App\Bd\Client;

/**
 * The org's CUSTOM DATABASE — the tables declared in
 * `bd.data-model.config.ts` and pushed with `npm run sync-data-model`.
 *
 * Distinct from Site Data collections. Reads need the `metadata:read_records`
 * scope on your key; without it the platform answers `available: false` and
 * the client raises `BdAccessRejectedException`.
 *
 * Writes go through `Forms::submit()` against the generated form — that's
 * the documented create path, and it keeps validation on the platform side.
 *
 * `object` is the object's `universalIdentifier`, NOT its display name: the
 * name can be renamed in the dashboard without breaking this code.
 */
class DataModel
{
    public function __construct(private readonly Client $client)
    {
    }

    /** @return array<string, mixed> */
    public function listRecords(string $object, ?int $limit = null, ?string $cursor = null): array
    {
        return $this->client->get($this->client->sitePath('data-model/records'), [
            'object' => $object,
            'limit' => $limit,
            'cursor' => $cursor,
        ]);
    }

    /**
     * Page through everything. Guard-railed at 50 pages so a bad cursor
     * can't spin forever.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listAllRecords(string $object, int $pageSize = 200): array
    {
        $records = [];
        $cursor = null;

        for ($page = 0; $page < 50; $page++) {
            $result = $this->listRecords($object, $pageSize, $cursor);
            foreach ($result['records'] ?? [] as $record) {
                $records[] = $record;
            }
            $cursor = $result['nextCursor'] ?? null;
            if (! $cursor) {
                break;
            }
        }

        return $records;
    }
}
