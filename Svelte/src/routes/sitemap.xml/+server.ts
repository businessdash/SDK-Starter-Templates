import { buildSitemap, minimalSitemapXml } from "@businessdash/sdk/sitemap";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

import { biab } from "$lib/server/biab";
import type { RequestHandler } from "./$types";

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
const STATIC_PATHS = ["/", "/services", "/reviews", "/updates", "/store", "/todos"];

export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = url.origin;

	if (!biab) {
		return new Response(minimalSitemapXml(baseUrl), {
			headers: { "Content-Type": "application/xml; charset=utf-8" },
		});
	}

	const xml = await buildSitemap({
		client: biab,
		siteId: publicEnv.PUBLIC_BIAB_SITE_ID ?? env.BIAB_SITE_ID ?? "",
		baseUrl,
		staticPaths: STATIC_PATHS,
		routes: { blog: "/updates", product: "/store" },
		onSkip: (section, reason) =>
			console.info(`[sitemap] skipped ${section}: ${reason}`),
	});

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=300",
		},
	});
};
