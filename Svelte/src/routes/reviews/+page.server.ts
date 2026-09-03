import type { PageServerLoad } from "./$types";

import { bd } from "$lib/server/bd";
import {
	fetchBundleSafe,
	getReviewsFromBundle,
} from "$lib/server/bd-bundle";

/**
 * Reviews wall. The aggregate (average + count) rides the marketing
 * bundle; the first page of full review bodies comes from
 * `reviews.list(...)`. "Load more" then pages forward against the
 * `/api/bd/reviews` endpoint. Bundle review items and wall items have
 * DIFFERENT shapes — we map the wall items here and pass them on.
 */
const PAGE_SIZE = 10;

export const load: PageServerLoad = async () => {
	if (!bd) {
		return {
			configured: false as const,
			average: null,
			totalCount: 0,
			items: [],
			nextOffset: null,
		};
	}

	const [bundleResult, firstPage] = await Promise.all([
		fetchBundleSafe("home", "en"),
		bd.reviews.list({ limit: PAGE_SIZE, offset: 0 }).catch(() => null),
	]);

	const aggregate =
		bundleResult.status === "ok"
			? getReviewsFromBundle(bundleResult.bundle)
			: null;

	return {
		configured: true as const,
		average: aggregate?.rating ?? null,
		totalCount: firstPage?.totalCount ?? aggregate?.totalCount ?? 0,
		items: firstPage?.items ?? [],
		nextOffset: firstPage?.nextOffset ?? null,
	};
};
