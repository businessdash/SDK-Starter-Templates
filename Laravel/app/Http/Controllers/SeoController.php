<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;

/**
 * SEO / AEO files, proxied from BIAB.
 *
 * These have to be served from THIS domain — a sitemap on biab.app says
 * nothing about your site, and `/llms.txt` is the only path answer engines
 * look at. The org curates the content in the dashboard (Marketing → AI
 * Distribution for llms.txt); this app relays the bytes.
 *
 * Two different upstreams, which is easy to get wrong:
 *  - sitemap.xml / robots.txt are SITE-SCOPED PACKAGE routes and need the
 *    bearer key: `/api/package/v1/sites/{siteId}/…`
 *  - llms.txt is a PUBLIC feed route with no auth at all:
 *    `/api/public/ai-feed/{siteId}/llms.txt`
 *
 * Everything degrades to a valid empty document rather than a 500 — a
 * crawler may read a 5xx robots.txt as "disallow everything".
 */
class SeoController extends Controller
{
    public function sitemap(): Response
    {
        $empty = '<?xml version="1.0" encoding="UTF-8"?>'
            ."\n".'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';

        return $this->relayPackage('sitemap.xml', $empty, 'application/xml; charset=utf-8');
    }

    public function robots(): Response
    {
        $host = rtrim(config('biab.site_origin'), '/');

        return $this->relayPackage(
            'robots.txt',
            "User-agent: *\nAllow: /\nSitemap: {$host}/sitemap.xml\n",
            'text/plain; charset=utf-8',
        );
    }

    /**
     * The org-curated llms.txt. Its companion PRODUCT FEED needs no route
     * here — it is already public at
     * `{host}/api/public/ai-feed/{siteId}/products`, in an OpenAI
     * merchant-feed shape you submit to feed programs as-is.
     */
    public function llmsTxt(): Response
    {
        $siteId = config('biab.site_id');
        $fallback = "# llms.txt is not configured for this site.\n";

        if (! $siteId) {
            return $this->text($fallback);
        }

        $url = rtrim(config('biab.host'), '/')
            .'/api/public/ai-feed/'.rawurlencode($siteId).'/llms.txt';

        try {
            $response = Http::timeout(10)->get($url);

            return $this->text($response->successful() ? $response->body() : $fallback);
        } catch (\Throwable) {
            return $this->text($fallback);
        }
    }

    private function relayPackage(string $suffix, string $fallback, string $contentType): Response
    {
        $siteId = config('biab.site_id');
        $key = config('biab.api_key');

        if (! $siteId || ! $key) {
            return response($fallback, 200)->header('Content-Type', $contentType);
        }

        $url = rtrim(config('biab.host'), '/')
            .'/api/package/v1/sites/'.rawurlencode($siteId).'/'.$suffix;

        try {
            $response = Http::withToken($key)
                ->withHeaders(['Origin' => rtrim(config('biab.site_origin'), '/')])
                ->timeout(10)
                ->get($url);

            $body = $response->successful() ? $response->body() : $fallback;
        } catch (\Throwable) {
            $body = $fallback;
        }

        return response($body, 200)->header('Content-Type', $contentType);
    }

    private function text(string $body): Response
    {
        return response($body, 200)->header('Content-Type', 'text/plain; charset=utf-8');
    }
}
