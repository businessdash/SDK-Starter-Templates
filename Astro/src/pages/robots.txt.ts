import type { APIRoute } from "astro";

import { biab, getBiabEnv } from "../lib/biab";

export const prerender = false;

/**
 * Proxy the auto-generated robots.txt from BIAB. The platform endpoint
 * switches to `Disallow: /` automatically when the org's billing is fully
 * suspended (60+ days) so search engines treat the outage as temporary —
 * that SEO-rescue lives entirely on the platform side.
 *
 * Falls back to a permissive default when BIAB is unconfigured or the upstream
 * errors.
 */

const ALLOW_ALL = "User-agent: *\nAllow: /\n";

function fallbackResponse(): Response {
	return new Response(ALLOW_ALL, {
		status: 200,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

export const GET: APIRoute = async () => {
	const env = getBiabEnv();
	if (!env || !biab) return fallbackResponse();
	const url = `${env.baseUrl}/${biab.parallelPages.robotsUrl()}`;
	try {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${env.apiKey}` },
		});
		if (!res.ok) return fallbackResponse();
		const body = await res.text();
		return new Response(body, {
			status: 200,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Cache-Control": "public, max-age=60, s-maxage=60",
			},
		});
	} catch {
		return fallbackResponse();
	}
};
