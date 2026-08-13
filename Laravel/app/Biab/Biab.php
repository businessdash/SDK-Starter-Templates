<?php

namespace App\Biab;

use Illuminate\Support\Facades\Cache;

/**
 * The app-facing entry point. Controllers talk to this, not to Client.
 *
 * Three jobs:
 *  - hand out a memoised Client (or null when BIAB isn't configured yet)
 *  - cache reads under the tags the revalidate webhook busts
 *  - turn an access-gate rejection into "render the local fallback"
 *
 * The null-client path matters more than it looks: every section falls back
 * to local content, so `git clone && php artisan serve` renders a complete
 * site with no credentials at all. That is what makes this a starter rather
 * than a demo you can't run.
 */
class Biab
{
    private static ?Client $client = null;

    private static bool $resolved = false;

    public static function client(): ?Client
    {
        if (! self::$resolved) {
            self::$client = Client::fromConfig();
            self::$resolved = true;
        }

        return self::$client;
    }

    /** True once a site id is present — drives the "not connected" banner. */
    public static function configured(): bool
    {
        return (bool) config('biab.site_id');
    }

    public static function auth(): ?Auth
    {
        return Auth::fromConfig(self::client());
    }

    /** Host root for dashboard deep links. */
    public static function host(): string
    {
        return config('biab.host');
    }

    /**
     * Read through the cache, tagged so the publish webhook can drop exactly
     * what changed. Falls back to `$default` on ANY failure — an expired plan,
     * a network blip, or BIAB simply not being configured. A marketing site
     * must not 500 because a CMS read failed.
     *
     * @template T
     *
     * @param  array<int, string>  $tags
     * @param  callable(Client): T  $read
     * @param  T  $default
     * @return T
     */
    public static function remember(string $key, array $tags, callable $read, mixed $default = null): mixed
    {
        $client = self::client();
        if (! $client) {
            return $default;
        }

        $store = Cache::supportsTags() ? Cache::tags($tags) : Cache::store();

        try {
            return $store->remember(
                'biab:'.$key,
                config('biab.cache_ttl'),
                static fn () => $read($client),
            );
        } catch (BiabAccessRejectedException|BiabApiException $e) {
            report($e);

            return $default;
        }
    }

    /**
     * Uncached read with the same swallow-and-fall-back contract. For
     * anything per-visitor — cart, portal — where caching would leak one
     * customer's data to the next.
     *
     * @template T
     *
     * @param  callable(Client): T  $read
     * @param  T  $default
     * @return T
     */
    public static function attempt(callable $read, mixed $default = null): mixed
    {
        $client = self::client();
        if (! $client) {
            return $default;
        }

        try {
            return $read($client);
        } catch (BiabAccessRejectedException|BiabApiException $e) {
            report($e);

            return $default;
        }
    }

    /** True when the failure means the org's site is suspended or lapsed. */
    public static function isUnavailable(\Throwable $e): bool
    {
        return $e instanceof BiabAccessRejectedException
            && in_array($e->reason, ['payment_required', 'service_suspended'], true);
    }

    /** @param array<int, string> $tags */
    public static function forget(array $tags): void
    {
        if (Cache::supportsTags()) {
            Cache::tags($tags)->flush();
        } else {
            Cache::flush();
        }
    }
}
