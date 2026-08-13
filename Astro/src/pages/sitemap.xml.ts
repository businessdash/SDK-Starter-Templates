import type { APIRoute } from "astro";

import { biab, getBiabEnv } from "../lib/biab";

export const prerender = false;

/**
 * Proxy the auto-generated sitemap from BIAB. The platform endpoint enumerates
 * every materialised parallel-page URL, applies per-page crawl rules, and
 * switches to an empty body when the org's billing is fully suspended (60+
 * days) — none of that logic lives here.
 *
 * `parallelPages.sitemapUrl()` returns the API-relative path; we resolve it
 * against the normalized base URL and forward the Bearer key. Falls back to an
 * empty (valid) sitemap when BIAB is unconfigured or the upstream errors.
 */

const EMPTY_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;

function emptyResponse(): Response {
	return new Response(EMPTY_SITEMAP, {
		status: 200,
		headers: { "Content-Type": "application/xml; charset=utf-8" },
	});
}

export const GET: APIRoute = async () => {
	const env = getBiabEnv();
	if (!env || !biab) return emptyResponse();
	const url = `${env.baseUrl}/${biab.parallelPages.sitemapUrl()}`;
	try {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${env.apiKey}` },
		});
		if (!res.ok) return emptyResponse();
		const body = await res.text();
		return new Response(body, {
			status: 200,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=60, s-maxage=60",
			},
		});
	} catch {
		return emptyResponse();
	}
};
