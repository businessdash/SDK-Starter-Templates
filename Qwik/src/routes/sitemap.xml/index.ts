import type { RequestHandler } from "@builder.io/qwik-city";
import { buildSitemap, minimalSitemapXml } from "@businessdash/sdk/sitemap";

import { getBiab } from "../../lib/biab";

/**
 * The sitemap, assembled from three sources: your own pages, what BusinessDash
 * owns the shape of (site pages, legal documents, programmatic pages), and
 * platform content mapped onto YOUR routes.
 *
 * Everything in `routes` is opt-in — delete a line and those URLs vanish, which
 * is right for a business without that surface. A missing URL costs one page's
 * indexing; a sitemap full of 404s costs trust in every URL in the file. The
 * customer portal and other token-gated paths are excluded automatically.
 */

/** Pages that live in THIS repo. Keep in step with `src/routes/`. */
const STATIC_PATHS = [
	"/",
	"/services",
	"/reviews",
	"/updates",
	"/store",
	"/todos",
	"/subscriptions",
];

export const onGet: RequestHandler = async ({ send, url, env }) => {
	const baseUrl = url.origin;
	const client = getBiab();

	const xml = client
		? await buildSitemap({
				client,
				siteId:
					env.get("PUBLIC_BIAB_SITE_ID") ?? env.get("BIAB_SITE_ID") ?? "",
				baseUrl,
				staticPaths: STATIC_PATHS,
				routes: { blog: "/updates", product: "/store" },
				onSkip: (section, reason) =>
					console.info(`[sitemap] skipped ${section}: ${reason}`),
			})
		: minimalSitemapXml(baseUrl);

	send(
		new Response(xml, {
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=300",
			},
		}),
	);
};
