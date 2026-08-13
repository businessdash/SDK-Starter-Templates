import type { APIRoute } from "astro";

import { biab } from "../../../lib/biab";

export const prerender = false;

/**
 * GET /api/biab/reviews?offset=&limit=&source=
 *
 * Paginates the reviews wall via `reviews.list(...)` for the "load more"
 * island. The aggregate (average / count) rides the marketing bundle and is
 * server-rendered on the page; this endpoint fetches deeper pages on demand.
 * Returns `{ items, totalCount, nextOffset }`.
 */
export const GET: APIRoute = async ({ url }) => {
	if (!biab) {
		return Response.json({ items: [], totalCount: 0, nextOffset: null });
	}
	const offsetStr = url.searchParams.get("offset");
	const limitStr = url.searchParams.get("limit");
	const source = url.searchParams.get("source");
	try {
		const res = await biab.reviews.list({
			offset: offsetStr ? Number(offsetStr) : undefined,
			limit: limitStr ? Number(limitStr) : 10,
			source:
				source === "google" ||
				source === "yelp" ||
				source === "housecall_pro" ||
				source === "other"
					? source
					: undefined,
		});
		return Response.json(res);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Couldn't load reviews.";
		return Response.json({ error: message }, { status: 502 });
	}
};
