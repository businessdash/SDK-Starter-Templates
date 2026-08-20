import { buildSitemap, minimalSitemapXml } from "@businessdash/sdk/sitemap";

import { getBiab } from "../utils/biab";

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

/** Pages that live in THIS repo. Keep in step with `app/pages/`. */
const STATIC_PATHS = [
	"/",
	"/services",
	"/reviews",
	"/updates",
	"/store",
	"/todos",
	"/cart",
	"/subscriptions",
];

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();
	const baseUrl = (
		(config.public.siteUrl as string | undefined) ??
		getRequestURL(event).origin
	).replace(/\/+$/, "");

	const client = getBiab();
	const xml = client
		? await buildSitemap({
				client,
				siteId: (config.biabSiteId as string | undefined) ?? "",
				baseUrl,
				staticPaths: STATIC_PATHS,
				routes: { blog: "/updates", product: "/store" },
				onSkip: (section, reason) =>
					console.info(`[sitemap] skipped ${section}: ${reason}`),
			})
		: minimalSitemapXml(baseUrl);

	setHeader(event, "Content-Type", "application/xml; charset=utf-8");
	setHeader(event, "Cache-Control", "public, max-age=300");
	return xml;
});
