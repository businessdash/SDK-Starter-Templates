import { env } from "$env/dynamic/private";

import { seoProxyConfig, sitemapProxyUrl } from "$lib/server/biab-parallel";

import type { RequestHandler } from "./$types";

/**
 * Proxy the auto-generated sitemap from BIAB. The platform endpoint
 * enumerates every materialised parallel-page URL, applies per-page crawl
 * rules, and switches to an empty body when the org's billing is fully
 * suspended (60+ days) — none of that logic lives here. When BIAB isn't
 * configured we serve a valid empty sitemap so crawlers don't 404.
 */
const EMPTY_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;

export const GET: RequestHandler = async () => {
	const cfg = seoProxyConfig();
	const url = sitemapProxyUrl();
	if (!cfg || !url) {
		return new Response(EMPTY_SITEMAP, {
			status: 200,
			headers: { "Content-Type": "application/xml; charset=utf-8" },
		});
	}
	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${cfg.apiKey}` },
		});
		if (!response.ok) {
			return new Response(EMPTY_SITEMAP, {
				status: 200,
				headers: { "Content-Type": "application/xml; charset=utf-8" },
			});
		}
		const body = await response.text();
		return new Response(body, {
			status: 200,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=60, s-maxage=60",
			},
		});
	} catch (err) {
		if (env.NODE_ENV === "development") {
			console.warn(
				`[biab] sitemap proxy failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
		return new Response(EMPTY_SITEMAP, {
			status: 200,
			headers: { "Content-Type": "application/xml; charset=utf-8" },
		});
	}
};
