import type { LoaderFunctionArgs } from "react-router";

import { fetchReviewsPage } from "~/lib/biab-pages.server";

/**
 * Reviews-wall pagination endpoint (resource route).
 *
 * The reviews page ships the aggregate + first page from the bundle; "load
 * more" hits this route with `?offset=N` and gets the next page of WALL items
 * (`{ reviewerName, text, timeCreated, rating }`) as JSON. Server-only — the
 * SDK uses the secret key here, never the browser.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const limit = clampInt(url.searchParams.get("limit"), 10, 1, 50);
	const offset = clampInt(url.searchParams.get("offset"), 0, 0, 100000);

	const page = await fetchReviewsPage({ limit, offset });
	if (!page) {
		return Response.json({ items: [], totalCount: 0, nextOffset: null });
	}
	return Response.json({
		items: page.items.map((r) => ({
			id: r.id,
			reviewerName: r.reviewerName,
			text: r.text,
			rating: r.rating,
			timeCreated: r.timeCreated,
		})),
		totalCount: page.totalCount,
		nextOffset: page.nextOffset,
	});
}

function clampInt(
	raw: string | null,
	fallback: number,
	min: number,
	max: number,
): number {
	const n = raw == null ? NaN : Number.parseInt(raw, 10);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}
