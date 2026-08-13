import { getBiab, getServerConfig } from "~/lib/biab.server";

/**
 * Proxy the auto-generated sitemap from BIAB (resource route → `/sitemap.xml`).
 *
 * The platform endpoint enumerates every materialised parallel-page URL,
 * applies per-page crawl rules, and switches to an empty body when the org's
 * billing is fully suspended — none of that logic lives here. We resolve the
 * upstream path from `client.parallelPages.sitemapUrl()` and stream it through.
 *
 * Falls back to an empty (but valid) sitemap when unconfigured or upstream
 * errors, so crawlers never see a 500.
 */

const EMPTY_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;

function emptySitemap() {
	return new Response(EMPTY_SITEMAP, {
		status: 200,
		headers: { "Content-Type": "application/xml; charset=utf-8" },
	});
}

export async function loader() {
	const cfg = getServerConfig();
	const biab = getBiab();
	if (!cfg || !biab) return emptySitemap();
	try {
		const path = biab.parallelPages.sitemapUrl().replace(/^\//, "");
		const upstream = `${cfg.baseUrl.replace(/\/$/, "")}/${path}`;
		const res = await fetch(upstream, {
			headers: { Authorization: `Bearer ${cfg.apiKey}` },
		});
		if (!res.ok) return emptySitemap();
		const body = await res.text();
		return new Response(body, {
			status: 200,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=60, s-maxage=60",
			},
		});
	} catch {
		return emptySitemap();
	}
}
