<?php

namespace App\Support;

/**
 * A blog post's HTML, made safe to put on the page, and the small things
 * every post shows (reading time, date).
 *
 * Why the post body is rebuilt, not trusted: a post's `content` is HTML
 * written in the BusinessDash editor, and the API returns it as it was
 * saved. Anyone who can write a post could otherwise put a script on this
 * site. `safe()` reads the HTML and writes out only the tags and attributes
 * on the lists below, with every value escaped again; everything else
 * becomes text. Nothing from the input reaches the page without being
 * rebuilt, so there is no pattern to slip past.
 *
 * The same rules as `safePostHtml` in the other BD starters, line for line.
 */
class PostHtml
{
    private const ALLOWED_TAGS = [
        'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'del', 'div', 'em',
        'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
        'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong',
        'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
    ];

    private const VOID_TAGS = ['br', 'hr', 'img'];

    /** Tags whose whole content goes, not only the tag. */
    private const DROPPED_WITH_CONTENT = [
        'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'textarea', 'select',
    ];

    private const ALLOWED_ATTRIBUTES = [
        '*' => ['title', 'id', 'class'],
        'a' => ['href'],
        'img' => ['src', 'alt', 'width', 'height', 'loading'],
        'td' => ['colspan', 'rowspan'],
        'th' => ['colspan', 'rowspan', 'scope'],
        'ol' => ['start'],
    ];

    private const URL_ATTRIBUTES = ['href', 'src'];

    private const TAG = '/\G<\/?([a-zA-Z][a-zA-Z0-9]*)\b((?:[^>"\']|"[^"]*"|\'[^\']*\')*+)>/';

    private const ATTRIBUTE = '/([^\s"\'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'>]+)))?/';

    /** Make a post's HTML safe to render (see the note at the top). */
    public static function safe(string $html): string
    {
        $out = '';
        $open = [];
        $i = 0;
        $length = strlen($html);
        $dropping = null;
        while ($i < $length) {
            $lt = strpos($html, '<', $i);
            if ($lt === false) {
                if ($dropping === null) {
                    $out .= self::escapeText(substr($html, $i));
                }
                break;
            }
            if ($dropping === null) {
                $out .= self::escapeText(substr($html, $i, $lt - $i));
            }
            if (substr_compare($html, '<!--', $lt, 4) === 0) {
                $end = strpos($html, '-->', $lt + 4);
                $i = $end === false ? $length : $end + 3;

                continue;
            }
            if (preg_match(self::TAG, $html, $match, 0, $lt) !== 1) {
                if ($dropping === null) {
                    $out .= '&lt;';
                }
                $i = $lt + 1;

                continue;
            }
            $i = $lt + strlen($match[0]);
            $closing = str_starts_with($match[0], '</');
            $name = strtolower($match[1]);
            if ($dropping !== null) {
                if ($closing && $name === $dropping) {
                    $dropping = null;
                }

                continue;
            }
            if (in_array($name, self::DROPPED_WITH_CONTENT, true)) {
                if (! $closing && ! str_ends_with($match[0], '/>')) {
                    $dropping = $name;
                }

                continue;
            }
            if (! in_array($name, self::ALLOWED_TAGS, true)) {
                continue;
            }
            if ($closing) {
                $at = array_search($name, array_reverse($open, true), true);
                if ($at === false) {
                    continue;
                }
                // Close anything left open inside it, so the nesting stays whole.
                while (count($open) > $at) {
                    $out .= '</'.array_pop($open).'>';
                }

                continue;
            }
            $allowed = array_merge(self::ALLOWED_ATTRIBUTES['*'], self::ALLOWED_ATTRIBUTES[$name] ?? []);
            $attributes = '';
            $external = false;
            preg_match_all(self::ATTRIBUTE, $match[2], $found, PREG_SET_ORDER | PREG_UNMATCHED_AS_NULL);
            foreach ($found as $attribute) {
                $key = strtolower($attribute[1] ?? '');
                if (! in_array($key, $allowed, true)) {
                    continue;
                }
                $value = $attribute[2] ?? $attribute[3] ?? $attribute[4] ?? '';
                if (in_array($key, self::URL_ATTRIBUTES, true)) {
                    $url = self::safeUrl($value);
                    if ($url === null) {
                        continue;
                    }
                    $value = $url;
                    if ($key === 'href' && preg_match('/^https?:/i', $url) === 1) {
                        $external = true;
                    }
                }
                $attributes .= ' '.$key.'="'.self::escapeAttribute($value).'"';
            }
            if ($name === 'a' && $external) {
                $attributes .= ' target="_blank" rel="noopener noreferrer nofollow"';
            }
            if ($name === 'img' && preg_match('/\sloading=/', $attributes) !== 1) {
                $attributes .= ' loading="lazy"';
            }
            $out .= '<'.$name.$attributes.'>';
            if (! in_array($name, self::VOID_TAGS, true)) {
                $open[] = $name;
            }
        }
        while ($open !== []) {
            $out .= '</'.array_pop($open).'>';
        }

        return $out;
    }

    /** Minutes to read a post, at 230 words a minute; tags don't count. */
    public static function readingMinutes(string $html): int
    {
        $text = trim((string) preg_replace('/<[^>]*>/', ' ', $html));
        $words = $text === '' ? 0 : count(preg_split('/\s+/', $text, -1, PREG_SPLIT_NO_EMPTY) ?: []);

        return max(1, (int) round($words / 230));
    }

    /** "November 18, 2026", or '' without a date. */
    public static function date(?string $iso): string
    {
        if ($iso === null || $iso === '') {
            return '';
        }
        $time = strtotime($iso);

        return $time === false ? '' : date('F j, Y', $time);
    }

    private static function escapeText(string $value): string
    {
        // An entity already in the text (&amp; &#8217;) stays one.
        $value = (string) preg_replace('/&(?![a-zA-Z][a-zA-Z0-9]{1,31};|#[0-9]{1,7};|#x[0-9a-fA-F]{1,6};)/', '&amp;', $value);

        return str_replace(['<', '>'], ['&lt;', '&gt;'], $value);
    }

    private static function escapeAttribute(string $value): string
    {
        return str_replace('"', '&quot;', self::escapeText($value));
    }

    private static function decodeEntities(string $value): string
    {
        // Leading zeros count for nothing (&#0000106; is "j"); a number too big
        // to be a character becomes U+FFFD, as it does in a browser.
        $codePoint = static function (string $digits, int $base): string {
            $digits = ltrim($digits, '0');
            $n = strlen($digits) > 8 ? 0 : (int) intval($digits === '' ? '0' : $digits, $base);
            $char = $n > 0 ? mb_chr($n, 'UTF-8') : false;

            return $char === false ? "\u{FFFD}" : $char;
        };
        $value = (string) preg_replace_callback('/&#x([0-9a-f]+);?/i', static fn ($m) => $codePoint($m[1], 16), $value);
        $value = (string) preg_replace_callback('/&#([0-9]+);?/', static fn ($m) => $codePoint($m[1], 10), $value);

        return str_ireplace(['&colon;', '&tab;', '&newline;', '&amp;'], [':', "\t", "\n", '&'], $value);
    }

    /** http(s), mailto, tel, a path on this site, or a #fragment. */
    private static function safeUrl(string $raw): ?string
    {
        // Browsers ignore control characters and whitespace inside a scheme
        // ("java\nscript:"), so they are removed before the check.
        $value = preg_replace('/[\x{0000}-\x{0020}\x{007f}-\x{009f}]/u', '', self::decodeEntities($raw));
        if ($value === null) {
            return null; // not UTF-8: nothing to link to
        }
        if (preg_match('/^(https?:|mailto:|tel:)/i', $value) === 1) {
            return trim($raw);
        }
        if (preg_match('/^[a-z][a-z0-9+.-]*:/i', $value) === 1) {
            return null;
        }
        if (str_starts_with($value, '//')) {
            return null;
        }

        return trim($raw);
    }
}
