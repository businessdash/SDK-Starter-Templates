<?php

namespace App\Support;

/**
 * The business reviews' rules: the rating over every review and its stars
 * breakdown, what each platform is called, which links are safe to open,
 * and what a written review must be. The same rules as `reviews.ts` in the
 * other BD starters (public/shop/reviews.js here, for the writer element).
 */
class Reviews
{
    public const PAGE_SIZE = 10;

    /** The longest review BD takes. */
    public const MAX_LENGTH = 5000;

    public const SENT = "Thanks! Your review shows once it's approved.";

    private const PLATFORMS = ['google' => 'Google', 'yelp' => 'Yelp', 'housecall_pro' => 'Housecall Pro'];

    private const SOURCES = ['google', 'yelp', 'housecall_pro', 'other'];

    /**
     * The average, the count and the breakdown (5 stars down to 1, each with
     * its share of all reviews); empty stars count 0.
     *
     * @param  array<string, mixed>|null  $totals  the marketing bundle's `reviews`
     * @return array{average: float|null, total: int, histogram: list<array{stars: int, count: int, share: float}>}
     */
    public static function summarize(?array $totals, int $fallbackTotal = 0): array
    {
        $byStars = [];
        foreach ((array) ($totals['counts'] ?? []) as $row) {
            $stars = $row['rating'] ?? null;
            $count = (int) ($row['count'] ?? 0);
            if (is_int($stars) && $stars >= 1 && $stars <= 5 && $count > 0) {
                $byStars[$stars] = ($byStars[$stars] ?? 0) + $count;
            }
        }
        $counted = array_sum($byStars);
        $total = isset($totals['totalCount']) && is_numeric($totals['totalCount'])
            ? (int) $totals['totalCount']
            : ($counted ?: $fallbackTotal);
        $rating = $totals['rating'] ?? null;

        return [
            'average' => is_numeric($rating) ? (float) $rating : null,
            'total' => $total,
            'histogram' => array_map(static fn (int $stars) => [
                'stars' => $stars,
                'count' => $byStars[$stars] ?? 0,
                'share' => $counted > 0 ? ($byStars[$stars] ?? 0) / $counted : 0.0,
            ], [5, 4, 3, 2, 1]),
        ];
    }

    /** "Google", "Yelp", "Housecall Pro"; null for a review added in the dashboard. */
    public static function platformName(mixed $source): ?string
    {
        return is_string($source) ? (self::PLATFORMS[$source] ?? null) : null;
    }

    /** A filter chip's name: the platform, or "Other". */
    public static function sourceLabel(mixed $source): string
    {
        return self::platformName($source) ?? 'Other';
    }

    /** A `source` query value BD accepts, or null. */
    public static function sourceParam(mixed $value): ?string
    {
        return is_string($value) && in_array($value, self::SOURCES, true) ? $value : null;
    }

    /**
     * The platforms among some reviews, in the order first seen.
     *
     * @param  iterable<array<string, mixed>>  $reviews
     * @return list<string>
     */
    public static function sourcesIn(iterable $reviews): array
    {
        $seen = [];
        foreach ($reviews as $review) {
            $source = self::sourceParam($review['source'] ?? null);
            if ($source !== null && ! in_array($source, $seen, true)) {
                $seen[] = $source;
            }
        }

        return $seen;
    }

    /** @param  array<string, mixed>  $review  The review on its own site; web links only. */
    public static function link(array $review): ?string
    {
        if (self::platformName($review['source'] ?? null) === null) {
            return null;
        }

        return self::webUrl($review['reviewUrl'] ?? null);
    }

    /** An http(s) address, or null. */
    public static function webUrl(mixed $url): ?string
    {
        if (! is_string($url) || $url === '') {
            return null;
        }
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = parse_url($url, PHP_URL_HOST);

        return ($scheme === 'https' || $scheme === 'http') && is_string($host) && $host !== '' ? $url : null;
    }

    /** @param  array<string, mixed>  $review */
    public static function reviewerName(array $review): string
    {
        $name = trim((string) ($review['reviewerName'] ?? ''));

        return $name !== '' ? $name : 'Anonymous';
    }

    /** @param  array<string, mixed>  $review  The first letter of the name, for an avatar with no photo. */
    public static function initial(array $review): string
    {
        return mb_strtoupper(mb_substr(self::reviewerName($review), 0, 1));
    }

    /** "★★★★☆", rounded to whole stars. */
    public static function stars(mixed $rating): string
    {
        $full = max(0, min(5, (int) round((float) $rating)));

        return str_repeat('★', $full).str_repeat('☆', 5 - $full);
    }

    /** "Nov 20, 2026", or "" for a date that isn't one. */
    public static function date(mixed $iso): string
    {
        if (! is_string($iso) || $iso === '') {
            return '';
        }
        try {
            return (new \DateTimeImmutable($iso))->setTimezone(new \DateTimeZone('UTC'))->format('M j, Y');
        } catch (\Exception) {
            return '';
        }
    }

    /**
     * A written review, checked: the fields BD takes, or why it can't go.
     *
     * @param  array<string, mixed>  $input
     * @return array{ok: true, review: array{rating: int, title?: string, body: string}}|array{ok: false, error: string}
     */
    public static function check(array $input): array
    {
        $rating = $input['rating'] ?? null;
        if (! is_int($rating) && ! (is_string($rating) && ctype_digit($rating))) {
            return ['ok' => false, 'error' => 'Choose a rating from 1 to 5 stars.'];
        }
        $rating = (int) $rating;
        if ($rating < 1 || $rating > 5) {
            return ['ok' => false, 'error' => 'Choose a rating from 1 to 5 stars.'];
        }
        $body = is_string($input['body'] ?? null) ? trim($input['body']) : '';
        if ($body === '') {
            return ['ok' => false, 'error' => 'Write a few words about your experience.'];
        }
        if (mb_strlen($body) > self::MAX_LENGTH) {
            return ['ok' => false, 'error' => 'Reviews are up to 5,000 characters.'];
        }
        $title = is_string($input['title'] ?? null) ? mb_substr(trim($input['title']), 0, 200) : '';

        return ['ok' => true, 'review' => $title !== ''
            ? ['rating' => $rating, 'title' => $title, 'body' => $body]
            : ['rating' => $rating, 'body' => $body]];
    }
}
