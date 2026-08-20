import { buildSitemap, minimalSitemapXml } from "@businessdash/sdk/sitemap";
import type { LoaderFunctionArgs } from "react-router";

import { getBiab } from "~/lib/biab.server";

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

/** Pages that live in THIS repo. Keep in step with `app/routes/`. */
const STATIC_PATHS = ["/", "/services", "/reviews", "/store", "/book"];

export async function loader({ request }: LoaderFunctionArgs) {
	const baseUrl = new URL(request.url).origin;
	const client = getBiab();

	const xml = client
		? await buildSitemap({
				client,
				siteId: process.env.BIAB_SITE_ID ?? "",
				baseUrl,
				staticPaths: STATIC_PATHS,
				routes: { product: "/store" },
				onSkip: (section, reason) =>
					console.info(`[sitemap] skipped ${section}: ${reason}`),
			})
		: minimalSitemapXml(baseUrl);

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=300",
		},
	});
}
