<?php

declare(strict_types=1);

namespace App\Biab;

/**
 * Turn a company profile's `socials` map into a render-ready list of links.
 *
 * There is no endpoint for this. Social handles arrive on the branding /
 * page bundle as a plain map, and every consumer has to do the same three
 * things with them: drop the empties, work out the real URL, and put them in a
 * stable order. Doing that in a Blade template is how a site ends up linking
 * to `https://@acme` and reshuffling its social row whenever an unrelated
 * field is edited.
 *
 * The platform table is generated from `biab-dev/src/socials.ts` (see
 * `SocialPlatforms`), so adding a platform upstream reaches every language.
 */
final class Socials
{
    /**
     * Resolve one stored value into a real URL.
     *
     * Orgs type these by hand, so the same field arrives as
     * `https://instagram.com/acme`, `acme`, `@acme` or `instagram.com/acme`:
     *
     *  - anything already absolute (http, https, mailto:, tel:) is left alone —
     *    the org meant that link;
     *  - a known platform prefixes its handle, dropping a leading `@`;
     *  - anything else is assumed to be a bare domain and gets `https://`.
     *
     * @param  array<string, mixed>  $platform
     */
    public static function href(string $value, array $platform): string
    {
        $v = trim($value);

        if (preg_match('#^(https?://|mailto:|tel:)#i', $v) === 1) {
            return $v;
        }

        $prefix = $platform['hrefPrefix'] ?? null;
        if (is_string($prefix) && $prefix !== '') {
            return $prefix.ltrim($v, '@');
        }

        return 'https://'.ltrim($v, '/');
    }

    /**
     * Turn the `socials` map into a render-ready list.
     *
     * Returned in the platform table's canonical order rather than whatever
     * order the keys arrived in, so a site's social row does not reshuffle
     * itself. Empty values and unknown keys are dropped; the first value wins
     * if a platform somehow appears twice.
     *
     * @param  array<string, mixed>|null  $socials
     * @return list<array{key: string, label: string, iconSlug: string|null, url: string}>
     */
    public static function resolve(?array $socials): array
    {
        if ($socials === null) {
            return [];
        }

        $present = [];
        foreach ($socials as $rawKey => $rawValue) {
            if (! is_string($rawValue)) {
                continue;
            }
            $value = trim($rawValue);
            if ($value === '') {
                continue;
            }
            $platform = self::platformFor((string) $rawKey);
            if ($platform === null || isset($present[$platform['key']])) {
                continue;
            }
            $present[$platform['key']] = $value;
        }

        $out = [];
        foreach (SocialPlatforms::ALL as $platform) {
            $value = $present[$platform['key']] ?? null;
            if ($value === null) {
                continue;
            }
            $out[] = [
                'key' => $platform['key'],
                'label' => $platform['label'],
                'iconSlug' => $platform['iconSlug'],
                'url' => self::href($value, $platform),
            ];
        }

        return $out;
    }

    /**
     * Case-insensitive platform lookup — these keys come from stored JSON,
     * where `twitterX`, `twitterx` and `TWITTERX` are all plausible.
     *
     * @return array<string, mixed>|null
     */
    public static function platformFor(string $key): ?array
    {
        $needle = strtolower($key);
        foreach (SocialPlatforms::ALL as $platform) {
            if (strtolower($platform['key']) === $needle) {
                return $platform;
            }
        }

        return null;
    }
}
