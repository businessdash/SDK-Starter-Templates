import { buildSitemap, minimalSitemapXml } from "@businessdash/sdk/sitemap";

import { env } from "@/env";
import { getBd } from "@/server/lib/bd";

/**
 * The sitemap, assembled from three sources.
 *
 * 1. **Your own pages** — `STATIC_PATHS`. The platform cannot know these exist.
 * 2. **What BusinessDash owns the shape of** — published site-builder pages,
 *    legal documents, materialised programmatic pages.
 * 3. **Content mapped onto YOUR routes** — the `routes` map below. The platform
 *    knows the org has 40 posts; only you know where they render.
 *
 * Everything in `routes` is opt-in. Delete a line and those URLs vanish, which
 * is right for a business without that surface: a mobile mechanic with no
 * storefront should not advertise product URLs that 404. A missing URL
 * costs one page's indexing; a sitemap full of 404s costs trust in every URL.
 *
 * The customer portal and the other token-gated surfaces are excluded
 * automatically — a crawler following one gets a login redirect.
 */
export const revalidate = 300;

/** Pages that live in THIS repo. Keep in step with `src/app/`. */
const STATIC_PATHS = [
	"/",
	"/services",
	// [bd:store]
	"/store",
	"/store/wishlist",
	"/store/compare",
	// [/bd:store]
	// [bd:subscriptions]
	"/store/subscriptions",
	// [/bd:subscriptions]
	// [bd:blog]
	"/blog",
	// [/bd:blog]
	"/todos",
	"/my-account",
];

function siteOrigin(): string {
	const raw = env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
	return raw.replace(/\/+$/, "");
}

export async function GET() {
	const baseUrl = siteOrigin();
	const client = getBd();

	// Unconfigured: one honest URL rather than an empty <urlset>, which would
	// affirmatively tell crawlers the site has no pages.
	if (!client) {
		return new Response(minimalSitemapXml(baseUrl), {
			headers: { "Content-Type": "application/xml; charset=utf-8" },
		});
	}

	const xml = await buildSitemap({
		client,
		siteId: env.NEXT_PUBLIC_BD_SITE_ID ?? env.BD_SITE_ID ?? "",
		baseUrl,
		staticPaths: STATIC_PATHS,
		routes: {
			// Where THIS starter renders them. Change if you move the routes;
			// delete if you drop the surface.
			// [bd:store]
			product: "/store",
			// [/bd:store]
			// [bd:blog]
			blog: "/blog",
			// [/bd:blog]
		},
		onSkip: (section, reason) =>
			console.info(`[sitemap] skipped ${section}: ${reason}`),
	});

	return new Response(xml, {
		headers: { "Content-Type": "application/xml; charset=utf-8" },
	});
}
