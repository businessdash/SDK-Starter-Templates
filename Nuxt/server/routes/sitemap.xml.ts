/**
 * GET /sitemap.xml
 *
 * Proxy the auto-generated sitemap from BIAB. The platform endpoint
 * enumerates every materialised parallel-page URL, applies per-page
 * crawl rules, and switches to an empty body when the org's billing is
 * fully suspended — none of that logic lives here. The relative path
 * comes from `client.parallelPages.sitemapUrl()`; we resolve it against
 * the normalized API base URL.
 *
 * Falls back to a valid empty sitemap when BIAB isn't configured or the
 * upstream call fails, so the route never 500s.
 */
const EMPTY_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;

export default defineEventHandler(async (event) => {
	setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");

	const biab = getBiab();
	const cfg = getBiabBaseConfig();
	if (!biab || !cfg) return EMPTY_SITEMAP;

	const path = biab.parallelPages.sitemapUrl(); // e.g. sites/<id>/sitemap.xml
	const url = `${cfg.baseUrl}/${path.replace(/^\//, "")}`;
	try {
		const res = await globalThis.fetch(url, {
			headers: { Authorization: `Bearer ${cfg.apiKey}` },
		});
		if (!res.ok) return EMPTY_SITEMAP;
		setResponseHeader(event, "Cache-Control", "public, max-age=60, s-maxage=60");
		return await res.text();
	} catch {
		return EMPTY_SITEMAP;
	}
});
