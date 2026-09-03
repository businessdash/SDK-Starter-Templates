import { getBd, getServerConfig } from "~/lib/bd.server";

/**
 * Proxy the auto-generated robots.txt from BD (resource route → `/robots.txt`).
 *
 * The platform endpoint switches to `Disallow: /` automatically when the org's
 * billing is fully suspended so search engines treat the outage as temporary —
 * that SEO-rescue lives entirely on the platform side. We resolve the upstream
 * path from `client.parallelPages.robotsUrl()` and stream it through.
 *
 * Falls back to an allow-all robots when unconfigured or upstream errors.
 */

const ALLOW_ALL = "User-agent: *\nAllow: /\n";

function allowAll() {
	return new Response(ALLOW_ALL, {
		status: 200,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

export async function loader() {
	const cfg = getServerConfig();
	const bd = getBd();
	if (!cfg || !bd) return allowAll();
	try {
		const path = bd.parallelPages.robotsUrl().replace(/^\//, "");
		const upstream = `${cfg.baseUrl.replace(/\/$/, "")}/${path}`;
		const res = await fetch(upstream, {
			headers: { Authorization: `Bearer ${cfg.apiKey}` },
		});
		if (!res.ok) return allowAll();
		const body = await res.text();
		return new Response(body, {
			status: 200,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Cache-Control": "public, max-age=60, s-maxage=60",
			},
		});
	} catch {
		return allowAll();
	}
}
