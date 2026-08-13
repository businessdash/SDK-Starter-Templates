import type { RequestHandler } from "@builder.io/qwik-city";

import { getBiab } from "../../lib/biab";

/**
 * Proxy the auto-generated sitemap from BIAB. The platform endpoint
 * enumerates every materialised parallel-page URL, applies per-page crawl
 * rules, and switches to an empty body when the org's billing is fully
 * suspended (60+ days) — none of that logic lives here.
 *
 * `client.parallelPages.sitemapUrl()` returns the path fragment relative to
 * the SDK's base URL; we resolve it against the configured base and stream
 * the upstream XML through.
 */

const EMPTY_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

export const onGet: RequestHandler = async ({ send }) => {
	const biab = getBiab();
	const apiKey = process.env.BIAB_API_KEY;
	const rawBaseUrl =
		process.env.PUBLIC_BIAB_PACKAGE_API_BASE_URL ??
		process.env.BIAB_PACKAGE_API_BASE_URL;
	if (!biab || !apiKey || !rawBaseUrl) {
		send(
			new Response(EMPTY_SITEMAP, {
				status: 200,
				headers: { "Content-Type": "application/xml; charset=utf-8" },
			}),
		);
		return;
	}
	const url = `${normalizeBaseUrl(rawBaseUrl)}/${biab.parallelPages.sitemapUrl()}`;
	try {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!res.ok) {
			send(
				new Response(EMPTY_SITEMAP, {
					status: 200,
					headers: { "Content-Type": "application/xml; charset=utf-8" },
				}),
			);
			return;
		}
		const body = await res.text();
		send(
			new Response(body, {
				status: 200,
				headers: {
					"Content-Type": "application/xml; charset=utf-8",
					"Cache-Control": "public, max-age=60, s-maxage=60",
				},
			}),
		);
	} catch {
		send(
			new Response(EMPTY_SITEMAP, {
				status: 200,
				headers: { "Content-Type": "application/xml; charset=utf-8" },
			}),
		);
	}
};
