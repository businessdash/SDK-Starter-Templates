import type { ReviewWallListResponse } from "@businessdash/sdk/contracts";

/**
 * GET /api/biab/reviews?limit=&offset=&source=
 *
 * One page of the public review wall. `reviews.list(...)` returns the
 * aggregate `totalCount` alongside the items and a `nextOffset` cursor,
 * so the reviews page can show "N reviews", render the first page, and
 * "load more" by passing the returned offset back in.
 *
 * Returns an empty page (totalCount 0) when BIAB isn't configured.
 */
export type ReviewsPageResult = {
	items: ReviewWallListResponse["items"];
	totalCount: number;
	nextOffset: number | null;
};

export default defineEventHandler(
	async (event): Promise<ReviewsPageResult> => {
		const biab = getBiab();
		if (!biab) return { items: [], totalCount: 0, nextOffset: null };

		const query = getQuery(event);
		const limit = query.limit ? Number(query.limit) : 10;
		const offset = query.offset ? Number(query.offset) : 0;
		const source = query.source as ReviewsPageResult["items"][number]["source"] | undefined;

		try {
			const res = await biab.reviews.list({
				limit,
				offset,
				...(source ? { source } : {}),
			});
			return {
				items: res.items,
				totalCount: res.totalCount,
				nextOffset: res.nextOffset,
			};
		} catch {
			return { items: [], totalCount: 0, nextOffset: null };
		}
	},
);
