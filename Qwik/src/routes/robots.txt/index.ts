import type { RequestHandler } from "@builder.io/qwik-city";

import { getBd } from "../../lib/bd";

/**
 * Proxy the auto-generated robots.txt from BD. The platform endpoint
 * switches to `Disallow: /` automatically when the org's billing is fully
 * suspended (60+ days) so search engines treat the outage as temporary —
 * that SEO-rescue lives entirely on the platform side.
 *
 * `client.parallelPages.robotsUrl()` returns the path fragment relative to
 * the SDK's base URL; we resolve it against the configured base.
 */

const DEFAULT_ROBOTS = "User-agent: *\nAllow: /\n";

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

export const onGet: RequestHandler = async ({ send }) => {
	const bd = getBd();
	const apiKey = process.env.BD_API_KEY;
	const rawBaseUrl =
		process.env.PUBLIC_BD_PACKAGE_API_BASE_URL ??
		process.env.BD_PACKAGE_API_BASE_URL;
	if (!bd || !apiKey || !rawBaseUrl) {
		send(
			new Response(DEFAULT_ROBOTS, {
				status: 200,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			}),
		);
		return;
	}
	const url = `${normalizeBaseUrl(rawBaseUrl)}/${bd.parallelPages.robotsUrl()}`;
	try {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!res.ok) {
			send(
				new Response(DEFAULT_ROBOTS, {
					status: 200,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				}),
			);
			return;
		}
		const body = await res.text();
		send(
			new Response(body, {
				status: 200,
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					"Cache-Control": "public, max-age=60, s-maxage=60",
				},
			}),
		);
	} catch {
		send(
			new Response(DEFAULT_ROBOTS, {
				status: 200,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			}),
		);
	}
};
