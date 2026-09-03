/**
 * Proxy the auto-generated robots.txt from BD. The platform endpoint
 * switches to `Disallow: /` automatically when the org's billing is fully
 * suspended (60+ days) so search engines treat the outage as temporary — that
 * SEO-rescue lives entirely on the platform side.
 *
 * Falls back to an "allow all" body when BD env isn't configured.
 */
export const revalidate = 60;

const ALLOW_ALL = "User-agent: *\nAllow: /\n";

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

export async function GET() {
	const apiKey = process.env.BD_API_KEY;
	const siteId = process.env.BD_SITE_ID;
	const baseUrl = process.env.BD_PACKAGE_API_BASE_URL;
	if (!apiKey || !siteId || !baseUrl) {
		return new Response(ALLOW_ALL, {
			status: 200,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}
	const url = `${normalizeBaseUrl(baseUrl)}/sites/${encodeURIComponent(siteId)}/robots.txt`;
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${apiKey}` },
		next: {
			revalidate: 60,
			tags: ["bd:robots", "bd:billing-state", "bd:parallel-pages"],
		},
	});
	if (!response.ok) {
		return new Response(ALLOW_ALL, {
			status: 200,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}
	const body = await response.text();
	return new Response(body, {
		status: 200,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=60, s-maxage=60",
		},
	});
}
