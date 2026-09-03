<?php

declare(strict_types=1);

namespace App\Bd;

/**
 * Render the org's per-page SEO into head tags.
 * 
 * The marketing page bundle carries a `seo` object for the page you asked for:
 * title, description, canonical, noIndex, Open Graph, Twitter card, keywords,
 * JSON-LD and hreflang. Reading four of those and forgetting the rest is the
 * normal failure, and the two people forget are `noIndex` and `canonical` --
 * exactly the two where being wrong is expensive and silent.
 * 
 * Rules that matter, matching the TypeScript `seo-core`:
 * 
 *   * Open Graph falls back to the page's own title/description. A missing
 *     og:title renders a shared link as a bare URL.
 *   * A RELATIVE canonical is dropped rather than emitted. Crawlers resolve it
 *     against whatever URL they fetched, so on a parameterised URL it points
 *     somewhere nobody intended; a missing canonical is recoverable, a wrong one
 *     consolidates ranking onto the wrong page.
 *   * `robots` is always emitted, both ways. Absence means "index", so relying on
 *     absence to express noindex is catastrophic.
 *   * Values are escaped. SEO text is org-authored and a stray quote would break
 *     out of the attribute.
 */
final class Seo
{
    /**
     * @param  array<string, mixed>|null  $seo  the bundle's `seo` object
     * @return list<array{tag: string, attrs: array<string, string>, children?: string}>
     */
    public static function headTags(?array $seo, ?string $baseUrl = null): array
    {
        if ($seo === null) {
            return [];
        }

        $title = self::text($seo['seoTitle'] ?? null);
        $description = self::text($seo['seoDescription'] ?? null);
        $canonical = self::absolute($seo['canonicalUrl'] ?? null, $baseUrl);
        $noIndex = ($seo['noIndex'] ?? false) === true;

        $tags = [];
        if ($title !== null) {
            $tags[] = ['tag' => 'title', 'attrs' => [], 'children' => $title];
        }
        if ($description !== null) {
            $tags[] = self::meta('name', 'description', $description);
        }
        $keywords = $seo['keywords'] ?? [];
        if (is_array($keywords) && $keywords !== []) {
            $tags[] = self::meta('name', 'keywords', implode(', ', $keywords));
        }
        $tags[] = self::meta('name', 'robots', $noIndex ? 'noindex, nofollow' : 'index, follow');

        // Open Graph, falling back to the page's own title/description.
        $ogTitle = self::text($seo['ogTitle'] ?? null) ?? $title;
        $ogDescription = self::text($seo['ogDescription'] ?? null) ?? $description;
        $ogImage = self::absolute($seo['ogImageUrl'] ?? null, $baseUrl);

        if ($ogTitle !== null) {
            $tags[] = self::meta('property', 'og:title', $ogTitle);
        }
        if ($ogDescription !== null) {
            $tags[] = self::meta('property', 'og:description', $ogDescription);
        }
        if ($ogImage !== null) {
            $tags[] = self::meta('property', 'og:image', $ogImage);
        }
        if ($canonical !== null) {
            $tags[] = self::meta('property', 'og:url', $canonical);
        }
        $tags[] = self::meta('property', 'og:type', 'website');

        $card = self::text($seo['twitterCard'] ?? null) ?? 'summary_large_image';
        $tags[] = self::meta('name', 'twitter:card', $card);
        if ($ogTitle !== null) {
            $tags[] = self::meta('name', 'twitter:title', $ogTitle);
        }
        if ($ogDescription !== null) {
            $tags[] = self::meta('name', 'twitter:description', $ogDescription);
        }
        if ($ogImage !== null) {
            $tags[] = self::meta('name', 'twitter:image', $ogImage);
        }

        if ($canonical !== null) {
            $tags[] = ['tag' => 'link', 'attrs' => ['rel' => 'canonical', 'href' => $canonical]];
        }
        foreach (($seo['hreflang'] ?? []) as $lang => $href) {
            $resolved = self::absolute($href, $baseUrl);
            if ($resolved !== null) {
                $tags[] = ['tag' => 'link', 'attrs' => ['rel' => 'alternate', 'hreflang' => (string) $lang, 'href' => $resolved]];
            }
        }
        foreach (($seo['jsonldNodes'] ?? []) as $node) {
            $tags[] = [
                'tag' => 'script',
                'attrs' => ['type' => 'application/ld+json'],
                'children' => json_encode($node, JSON_UNESCAPED_SLASHES),
            ];
        }

        return $tags;
    }

    /** Ready-to-echo HTML for a Blade layout. */
    public static function render(?array $seo, ?string $baseUrl = null): string
    {
        $out = [];
        foreach (self::headTags($seo, $baseUrl) as $tag) {
            $attrs = [];
            foreach ($tag['attrs'] as $key => $value) {
                $attrs[] = $key.'="'.htmlspecialchars($value, ENT_QUOTES, 'UTF-8').'"';
            }
            $joined = implode(' ', $attrs);

            if ($tag['tag'] === 'title') {
                $out[] = '<title>'.htmlspecialchars($tag['children'] ?? '', ENT_QUOTES, 'UTF-8').'</title>';
            } elseif ($tag['tag'] === 'script') {
                // `<` is what closes the script early; escaping the whole
                // payload would corrupt the JSON instead.
                $payload = str_replace('<', '\\u003c', $tag['children'] ?? '');
                $out[] = '<script '.$joined.'>'.$payload.'</script>';
            } else {
                $out[] = '<'.$tag['tag'].' '.$joined.'>';
            }
        }

        return implode("\n", $out);
    }

    /** @return array{tag: string, attrs: array<string, string>} */
    private static function meta(string $key, string $name, string $content): array
    {
        return ['tag' => 'meta', 'attrs' => [$key => $name, 'content' => $content]];
    }

    private static function text(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private static function absolute(mixed $url, ?string $baseUrl): ?string
    {
        $value = self::text($url);
        if ($value === null) {
            return null;
        }
        if (preg_match('#^([a-z][a-z0-9+.-]*:|//)#i', $value) === 1) {
            return $value;
        }
        if ($baseUrl === null || trim($baseUrl) === '') {
            return null; // see the note about relative canonicals above
        }

        return rtrim($baseUrl, '/').(str_starts_with($value, '/') ? '' : '/').$value;
    }
}
