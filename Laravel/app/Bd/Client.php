<?php

namespace App\Bd;

use App\Bd\Resources\Blog;
use App\Bd\Resources\Cart;
use App\Bd\Resources\Chatbot;
use App\Bd\Resources\Checkout;
use App\Bd\Resources\DataModel;
use App\Bd\Resources\Followers;
use App\Bd\Resources\Forms;
use App\Bd\Resources\Marketing;
use App\Bd\Resources\Notifications;
use App\Bd\Resources\ParallelPages;
use App\Bd\Resources\Portal;
use App\Bd\Resources\Scheduling;
use App\Bd\Resources\Reviews;
use App\Bd\Resources\Storefront;
use App\Bd\Resources\Subscriptions;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * Transport for the BD Package API.
 *
 * Deliberately thin — the platform surface is plain REST with a bearer key,
 * so this is a typed-ish wrapper around Laravel's HTTP client rather than a
 * port of the TypeScript SDK. Responses come back as PHP arrays.
 *
 * Two things it does NOT leave to the caller, because getting them wrong is
 * silent rather than loud:
 *
 *  1. The access gate. A read that hits an expired plan returns HTTP 200 with
 *     `{ available: false, … }` in the body — a naive client renders that as
 *     an empty page. Every response passes through `guardAccess()`.
 *  2. The `Origin` header. Server-to-server calls have no browser origin, but
 *     the platform gates on it, so it is sent explicitly from config.
 */
class Client
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $apiKey,
        private readonly string $siteId,
        private readonly string $siteOrigin,
    ) {
    }

    /**
     * Build from config. Returns null when the app isn't wired to BD yet,
     * so every page can fall back to local content instead of 500ing —
     * `php artisan serve` on a fresh clone should still render.
     */
    public static function fromConfig(): ?self
    {
        $host = config('bd.host');
        $key = config('bd.api_key');
        $siteId = config('bd.site_id');

        if (! $host || ! $key || ! $siteId) {
            return null;
        }

        return new self(
            baseUrl: rtrim($host, '/').'/api/package/v1',
            apiKey: $key,
            siteId: $siteId,
            siteOrigin: config('bd.site_origin'),
        );
    }

    public function siteId(): string
    {
        return $this->siteId;
    }

    /**
     * One request. `$headers` carries the per-call BD headers —
     * `X-BD-Cart-Visitor`, `X-BD-Session-Token`,
     * `X-BD-Customer-Portal-Org`.
     *
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>|null  $body
     * @param  array<string, string>  $headers
     * @return array<string, mixed>
     */
    public function request(
        string $method,
        string $path,
        array $query = [],
        ?array $body = null,
        array $headers = [],
    ): array {
        $response = $this->pending($headers)->send(
            $method,
            $this->baseUrl.'/'.ltrim($path, '/'),
            array_filter([
                'query' => $this->normaliseQuery($query) ?: null,
                'json' => $body,
            ], static fn ($v) => $v !== null),
        );

        $decoded = $response->json();
        $decoded = is_array($decoded) ? $decoded : [];

        $this->guardAccess($decoded, $path, $response->status());

        if ($response->failed()) {
            throw new BdApiException(
                status: $response->status(),
                path: $path,
                message: is_string($decoded['message'] ?? null)
                    ? $decoded['message']
                    : "BD API request failed with status {$response->status()}.",
                body: $decoded,
            );
        }

        return $decoded;
    }

    /** @param array<string, mixed> $query */
    public function get(string $path, array $query = [], array $headers = []): array
    {
        return $this->request('GET', $path, $query, null, $headers);
    }

    /** @param array<string, mixed> $body */
    public function post(string $path, ?array $body = null, array $headers = [], array $query = []): array
    {
        return $this->request('POST', $path, $query, $body ?? [], $headers);
    }

    /** @param array<string, mixed> $body */
    public function patch(string $path, ?array $body = null, array $headers = []): array
    {
        return $this->request('PATCH', $path, [], $body ?? [], $headers);
    }

    public function delete(string $path, array $headers = []): array
    {
        return $this->request('DELETE', $path, [], null, $headers);
    }

    /** Path prefix for every site-scoped route. */
    public function sitePath(string $suffix): string
    {
        return 'sites/'.rawurlencode($this->siteId).'/'.ltrim($suffix, '/');
    }

    // ── Resource namespaces ────────────────────────────────────────────────

    public function storefront(): Storefront
    {
        return new Storefront($this);
    }

    public function cart(?string $visitorToken = null, ?string $sessionToken = null): Cart
    {
        return new Cart($this, $visitorToken, $sessionToken);
    }

    public function checkout(?string $visitorToken = null, ?string $sessionToken = null): Checkout
    {
        return new Checkout($this, $visitorToken, $sessionToken);
    }

    public function blog(): Blog
    {
        return new Blog($this);
    }

    public function forms(): Forms
    {
        return new Forms($this);
    }

    public function reviews(): Reviews
    {
        return new Reviews($this);
    }

    public function subscriptions(): Subscriptions
    {
        return new Subscriptions($this);
    }

    public function marketing(): Marketing
    {
        return new Marketing($this);
    }

    public function parallelPages(): ParallelPages
    {
        return new ParallelPages($this);
    }

    public function followers(): Followers
    {
        return new Followers($this);
    }

    public function dataModel(): DataModel
    {
        return new DataModel($this);
    }

    /** Session-scoped customer portal. `$organizationId` pins the org. */
    public function portal(string $sessionToken, ?string $organizationId = null): Portal
    {
        return new Portal($this, $sessionToken, $organizationId);
    }

    /**
     * Notification preferences and destination verification.
     *
     * `$organizationId` chooses WHOSE settings — preferences are stored per
     * (org, customer), so a customer who buys from three businesses has three
     * independent matrices. Pass an id from `portal()->myOtherCustomerOrgs()`.
     */
    public function notifications(string $sessionToken, ?string $organizationId = null): Notifications
    {
        return new Notifications($this, $sessionToken, $organizationId);
    }

    /**
     * The Front Desk chatbot. `$sessionToken` resumes an existing thread;
     * omit it and call `session()` to mint one.
     */
    public function chatbot(?string $sessionToken = null): Chatbot
    {
        return new Chatbot($this, $sessionToken);
    }

    /** Booking and conference calls for a site. */
    public function scheduling(string $siteId): Scheduling
    {
        return new Scheduling($this, $siteId);
    }

    // ── Internals ──────────────────────────────────────────────────────────

    /** @param array<string, string> $headers */
    private function pending(array $headers): PendingRequest
    {
        return Http::withToken($this->apiKey)
            ->withHeaders(array_merge([
                'Accept' => 'application/json',
                // Server-to-server calls carry no browser Origin, but the
                // platform gates on it. Send the site's real public origin.
                'Origin' => $this->siteOrigin,
            ], $headers))
            ->timeout(15)
            ->retry(2, 200, throw: false);
    }

    /**
     * Flatten for the query string: booleans as "true"/"false" (PHP would
     * otherwise send "1"/""), nulls dropped, arrays repeated per value.
     *
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    private function normaliseQuery(array $query): array
    {
        $out = [];
        foreach ($query as $key => $value) {
            if ($value === null) {
                continue;
            }
            if (is_bool($value)) {
                $out[$key] = $value ? 'true' : 'false';

                continue;
            }
            $out[$key] = $value;
        }

        return $out;
    }

    /**
     * The billing / entitlement gate. Reads signal it in a 200 body, writes
     * with a 402 — both become one exception so callers branch on `reason`
     * and never render a silently empty page.
     *
     * @param  array<string, mixed>  $body
     */
    private function guardAccess(array $body, string $path, int $status): void
    {
        $isGateBody = ($body['available'] ?? null) === false
            && in_array($body['reason'] ?? null, ['plan_required', 'payment_required', 'service_suspended'], true)
            && is_string($body['upgradeUrl'] ?? null)
            && is_string($body['message'] ?? null);

        if (! $isGateBody) {
            return;
        }

        throw new BdAccessRejectedException(
            reason: $body['reason'],
            upgradeUrl: $body['upgradeUrl'],
            message: $body['message'],
            status: $status,
        );
    }
}
