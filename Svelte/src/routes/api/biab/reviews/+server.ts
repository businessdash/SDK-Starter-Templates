import { json } from "@sveltejs/kit";

import { biab } from "$lib/server/biab";

import type { RequestHandler } from "./$types";

/**
 * GET /api/biab/reviews?limit=&offset=&source=
 *
 * Paginates the public review wall via `reviews.list(...)`. The "Load
 * more" button on the reviews wall hits this with the previous response's
 * `nextOffset`. The bearer key stays server-side. Returns
 * `{ items, totalCount, nextOffset }` (empty when unconfigured).
 */
export const GET: RequestHandler = async ({ url }) => {
	if (!biab) {
		return json({ items: [], totalCount: 0, nextOffset: null });
	}
	const limitParam = url.searchParams.get("limit");
	const offsetParam = url.searchParams.get("offset");
	const sourceParam = url.searchParams.get("source");
	const source =
		sourceParam === "google" ||
		sourceParam === "yelp" ||
		sourceParam === "housecall_pro" ||
		sourceParam === "other"
			? sourceParam
			: undefined;
	try {
		const res = await biab.reviews.list({
			limit: limitParam ? Number(limitParam) : 10,
			offset: offsetParam ? Number(offsetParam) : 0,
			source,
		});
		return json(res);
	} catch {
		return json({ items: [], totalCount: 0, nextOffset: null });
	}
};
