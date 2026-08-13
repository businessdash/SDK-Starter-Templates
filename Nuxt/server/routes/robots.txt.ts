/**
 * GET /robots.txt
 *
 * Proxy the auto-generated robots.txt from BIAB. The platform endpoint
 * switches to `Disallow: /` automatically when the org's billing is
 * fully suspended, so crawlers treat the outage as temporary — that
 * SEO-rescue lives entirely on the platform side. The relative path
 * comes from `client.parallelPages.robotsUrl()`.
 *
 * Falls back to an allow-all robots when BIAB isn't configured or the
 * upstream call fails.
 *
 * NOTE: a static `public/robots.txt` ships in the starter; once BIAB is
 * configured, delete it so this dynamic route takes over (Nitro serves
 * `public/` files ahead of server routes).
 */
const ALLOW_ALL = "User-agent: *\nAllow: /\n";

export default defineEventHandler(async (event) => {
	setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");

	const biab = getBiab();
	const cfg = getBiabBaseConfig();
	if (!biab || !cfg) return ALLOW_ALL;

	const path = biab.parallelPages.robotsUrl(); // e.g. sites/<id>/robots.txt
	const url = `${cfg.baseUrl}/${path.replace(/^\//, "")}`;
	try {
		const res = await globalThis.fetch(url, {
			headers: { Authorization: `Bearer ${cfg.apiKey}` },
		});
		if (!res.ok) return ALLOW_ALL;
		setResponseHeader(event, "Cache-Control", "public, max-age=60, s-maxage=60");
		return await res.text();
	} catch {
		return ALLOW_ALL;
	}
});
