import { env } from "$env/dynamic/private";

import { robotsProxyUrl, seoProxyConfig } from "$lib/server/biab-parallel";

import type { RequestHandler } from "./$types";

/**
 * Proxy the auto-generated robots.txt from BIAB. The platform endpoint
 * flips to `Disallow: /` automatically when the org's billing is fully
 * suspended (60+ days) so search engines treat the outage as temporary —
 * that SEO-rescue lives entirely on the platform side. When BIAB isn't
 * configured we serve a permissive default.
 */
const DEFAULT_ROBOTS = "User-agent: *\nAllow: /\n";

export const GET: RequestHandler = async () => {
	const cfg = seoProxyConfig();
	const url = robotsProxyUrl();
	if (!cfg || !url) {
		return new Response(DEFAULT_ROBOTS, {
			status: 200,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}
	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${cfg.apiKey}` },
		});
		if (!response.ok) {
			return new Response(DEFAULT_ROBOTS, {
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
	} catch (err) {
		if (env.NODE_ENV === "development") {
			console.warn(
				`[biab] robots proxy failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
		return new Response(DEFAULT_ROBOTS, {
			status: 200,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}
};
