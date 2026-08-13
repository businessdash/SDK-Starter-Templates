import type { ParallelPagesRenderResponse } from "@businessdash/sdk";
import type { ReviewWallListResponse } from "@businessdash/sdk/contracts";

import { cached } from "./biab-cache.server";
import { getBiab, isSuspensionError } from "./biab.server";

/**
 * Programmatic-SEO + reviews-wall reads (server-only).
 *
 * The high-level `createBiabClient()` exposes `client.parallelPages`
 * ALREADY BOUND to the site id, so we call `client.parallelPages.render(...)`
 * directly (no `client.site(siteId)` indirection). Token resolution
 * (`{service.type}`, `{area.name}`, …) happens server-side inside BIAB so
 * crawlers see fully-resolved HTML.
 */

const PARALLEL_KEY = "service-area";

export type ServiceAreaVariant = { service: string; area: string };

/** Enumerate every (service × area) variant for the index/link list. Cached
 *  under the parallel-pages tag so a publish busts it. */
export async function listServiceAreaVariants(): Promise<ServiceAreaVariant[]> {
	const biab = getBiab();
	if (!biab) return [];
	try {
		return await cached(
			"biab:parallel:service-area:variants",
			["biab:parallel-pages", "biab:sitemap"],
			async () => {
				const { variants } = await biab.parallelPages.listVariants(
					PARALLEL_KEY,
				);
				return variants
					.map((v) => ({ service: v["service"] ?? "", area: v["area"] ?? "" }))
					.filter((v) => v.service && v.area);
			},
		);
	} catch {
		return [];
	}
}

/**
 * Render one (service × area) page. Returns `null` when unconfigured or the
 * variant doesn't exist. Re-throws suspension errors so the route can render
 * a 503-style "unavailable" state.
 */
export async function renderServiceArea(
	service: string,
	area: string,
): Promise<ParallelPagesRenderResponse | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await cached(
			`biab:parallel:service-area:${service}:${area}`,
			["biab:parallel-pages"],
			() => biab.parallelPages.render(PARALLEL_KEY, { service, area }),
		);
	} catch (err) {
		if (isSuspensionError(err)) throw err;
		return null;
	}
}

/**
 * A deeper page of reviews than the bundle ships. Server-only (the SDK uses
 * the secret key). Returns `null` when unconfigured or on error so the
 * caller can stop paginating gracefully.
 */
export async function fetchReviewsPage(input: {
	limit?: number;
	offset?: number;
	source?: "google" | "yelp" | "housecall_pro" | "other";
}): Promise<ReviewWallListResponse | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await biab.reviews.list(input);
	} catch {
		return null;
	}
}
