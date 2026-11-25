<?php

namespace Tests\Unit;

use App\Support\Reviews;
use PHPUnit\Framework\TestCase;

/** The reviews' rules, which must agree with reviews.ts in the other BD starters. */
final class ReviewsTest extends TestCase
{
    public function test_summary_breaks_the_rating_down_by_stars(): void
    {
        $summary = Reviews::summarize([
            'rating' => 4.1,
            'totalCount' => 14,
            'counts' => [
                ['rating' => 5, 'count' => 8],
                ['rating' => 4, 'count' => 3],
                ['rating' => 2, 'count' => 1],
                ['rating' => 1, 'count' => 2],
                ['rating' => 9, 'count' => 5],
            ],
        ]);

        $this->assertSame(4.1, $summary['average']);
        $this->assertSame(14, $summary['total']);
        $this->assertSame([5, 4, 3, 2, 1], array_column($summary['histogram'], 'stars'));
        $this->assertSame([8, 3, 0, 1, 2], array_column($summary['histogram'], 'count'));
        $this->assertEqualsWithDelta(8 / 14, $summary['histogram'][0]['share'], 1e-9);
    }

    public function test_summary_with_no_bundle_has_no_average(): void
    {
        $summary = Reviews::summarize(null, 3);

        $this->assertNull($summary['average']);
        $this->assertSame(3, $summary['total']);
        $this->assertSame(0.0, $summary['histogram'][0]['share']);
    }

    public function test_links_open_only_on_named_platforms_and_the_web(): void
    {
        $this->assertSame('https://maps.google.com/?r=1', Reviews::link(['source' => 'google', 'reviewUrl' => 'https://maps.google.com/?r=1']));
        $this->assertNull(Reviews::link(['source' => 'yelp', 'reviewUrl' => 'javascript:alert(1)']));
        $this->assertNull(Reviews::link(['source' => 'other', 'reviewUrl' => 'https://example.com/r']));
        $this->assertNull(Reviews::webUrl('//example.com/x.jpg'));
        $this->assertNull(Reviews::platformName('other'));
        $this->assertSame('Other', Reviews::sourceLabel('other'));
        $this->assertNull(Reviews::sourceParam('tripadvisor'));
        $this->assertSame(['google', 'other'], Reviews::sourcesIn([['source' => 'google'], ['source' => 'other'], ['source' => 'google']]));
    }

    public function test_names_stars_and_dates(): void
    {
        $this->assertSame('Anonymous', Reviews::reviewerName(['reviewerName' => '  ']));
        $this->assertSame('É', Reviews::initial(['reviewerName' => 'élodie']));
        $this->assertSame('★★★★☆', Reviews::stars(4.1));
        $this->assertSame('☆☆☆☆☆', Reviews::stars(null));
        $this->assertSame('Nov 20, 2026', Reviews::date('2026-11-20T15:00:00Z'));
        $this->assertSame('', Reviews::date('not a date'));
    }

    public function test_a_written_review_is_checked(): void
    {
        $this->assertSame(['ok' => false, 'error' => 'Choose a rating from 1 to 5 stars.'], Reviews::check(['rating' => 6, 'body' => 'Good']));
        $this->assertSame(['ok' => false, 'error' => 'Choose a rating from 1 to 5 stars.'], Reviews::check(['rating' => 4.5, 'body' => 'Good']));
        $this->assertSame(['ok' => false, 'error' => 'Write a few words about your experience.'], Reviews::check(['rating' => 4, 'body' => '   ']));
        $this->assertSame(['ok' => false, 'error' => 'Reviews are up to 5,000 characters.'], Reviews::check(['rating' => 4, 'body' => str_repeat('a', 5001)]));
        $this->assertSame(
            ['ok' => true, 'review' => ['rating' => 4, 'body' => 'Good fitting.']],
            Reviews::check(['rating' => 4, 'title' => ' ', 'body' => ' Good fitting. ']),
        );
        $this->assertSame(200, mb_strlen(Reviews::check(['rating' => 5, 'title' => str_repeat('t', 300), 'body' => 'x'])['review']['title']));
    }
}
