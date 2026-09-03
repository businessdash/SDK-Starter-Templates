import type { APIRoute } from "astro";
import { buildSitemap, minimalSitemapXml } from "@businessdash/sdk/sitemap";

import { bd, getBdEnv } from "../lib/bd";

export const prerender = false;

/**
 * The sitemap, assembled from three sources.
 *
 * 1. **Your own pages** — `STATIC_PATHS` below. The platform cannot know these
 *    exist, so they are declared by hand. Add a route, add it here.
 * 2. **What BusinessDash owns the shape of** — published site-builder pages,
 *    published legal documents, and every materialised programmatic page.
 * 3. **Content, mapped onto YOUR routes** — the `routes` map. BusinessDash
 *    knows the org has 40 posts; only you know they render at `/updates/[slug]`.
 *
 * ## Everything in `routes` is opt-in, and omission is the safe default
 *
 * Delete a line and those URLs vanish from the sitemap. That is the correct
 * behaviour for a business that does not have that surface — a mobile mechanic
 * with no storefront should not advertise `/store/{id}` URLs that 404, and the
 * org would fail the entitlement check anyway.
 *
 * A missing URL costs the indexing of one page. A sitemap full of 404s costs
 * trust in every URL in the file.
 *
 * The customer portal and the other token-gated surfaces are excluded
 * automatically — a crawler following one gets a login redirect.
 */

/** Pages that live in THIS repo. Keep in step with `src/pages/`. */
const STATIC_PATHS = [
	"/",
	"/services",
	"/reviews",
	"/updates",
	"/store",
	"/todos",
];

export const GET: APIRoute = async ({ site }) => {
	// Astro fills `site` from the `site` option in astro.config. Set it —
	// a sitemap of relative URLs is not a valid sitemap.
	const baseUrl = site?.origin ?? "https://example.com";

	// Unconfigured: one honest URL rather than an empty <urlset>, which would
	// affirmatively tell crawlers the site has no pages.
	if (!bd) {
		return new Response(minimalSitemapXml(baseUrl), {
			status: 200,
			headers: { "Content-Type": "application/xml; charset=utf-8" },
		});
	}

	const xml = await buildSitemap({
		client: bd,
		siteId: getBdEnv()?.siteId ?? "",
		baseUrl,
		staticPaths: STATIC_PATHS,
		routes: {
			// This starter renders posts at /updates/[slug] and products at
			// /store/[id]. Change these if you move those routes; delete them if
			// you drop the surface.
			blog: "/updates",
			product: "/store",
		},
		onSkip: (section, reason) => {
			// Worth watching during setup — the difference between a deliberate
			// omission and one you discover months later in Search Console.
			console.info(`[sitemap] skipped ${section}: ${reason}`);
		},
	});

	return new Response(xml, {
		status: 200,
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=300, s-maxage=300",
		},
	});
};
