<?php

namespace Tests\Unit;

use App\Support\PostHtml;
use PHPUnit\Framework\TestCase;

/**
 * Replays post-html-parity.json: post HTML, and what the TypeScript
 * safePostHtml the JavaScript starters ship gives back. Every case must
 * agree, or a post would render one way here and another there, and a case
 * that one sanitizer lets through could be a script on this site.
 */
final class PostHtmlParityTest extends TestCase
{
    public function test_safe_rebuilds_post_html_as_typescript_does(): void
    {
        $fixture = json_decode((string) file_get_contents(__DIR__.'/../Fixtures/post-html-parity.json'), true);
        $failures = [];
        foreach ($fixture['cases'] as $case) {
            $got = PostHtml::safe($case['input']);
            if ($got !== $case['output']) {
                $failures[] = json_encode($case['input'])."\n  gave ".json_encode($got)."\n  want ".json_encode($case['output']);
            }
        }

        $this->assertSame([], $failures);
    }

    public function test_reading_time_and_dates(): void
    {
        $this->assertSame(3, PostHtml::readingMinutes('<p>'.str_repeat('word ', 700).'</p>'));
        $this->assertSame(1, PostHtml::readingMinutes(''));
        $this->assertSame('November 18, 2026', PostHtml::date('2026-11-18T15:00:00.000Z'));
        $this->assertSame('', PostHtml::date(null));
    }
}
