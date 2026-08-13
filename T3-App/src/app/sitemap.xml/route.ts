/**
 * Proxy the auto-generated sitemap from BIAB. The platform endpoint enumerates
 * every materialised parallel-page URL, applies per-page crawl rules, and
 * switches to an empty body when the org's billing is fully suspended (60+
 * days) — none of that logic lives here.
 *
 * Falls back to an empty (valid) sitemap when BIAB env isn't configured so the
 * route never 500s on a fresh checkout.
 */
export const revalidate = 60;

const EMPTY_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

export async function GET() {
	const apiKey = process.env.BIAB_API_KEY;
	const siteId = process.env.BIAB_SITE_ID;
	const baseUrl = process.env.BIAB_PACKAGE_API_BASE_URL;
	if (!apiKey || !siteId || !baseUrl) {
		return new Response(EMPTY_SITEMAP, {
			status: 200,
			headers: { "Content-Type": "application/xml" },
		});
	}
	const url = `${normalizeBaseUrl(baseUrl)}/sites/${encodeURIComponent(siteId)}/sitemap.xml`;
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${apiKey}` },
		next: { revalidate: 60, tags: ["biab:sitemap", "biab:parallel-pages"] },
	});
	if (!response.ok) {
		return new Response(EMPTY_SITEMAP, {
			status: 200,
			headers: { "Content-Type": "application/xml" },
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
}
