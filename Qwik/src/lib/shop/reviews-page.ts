/**
 * The reviews page's data, gathered on the server: the rating over all the
 * business's reviews with its count per star (the marketing bundle's
 * `reviews`), the first `shown` reviews (from one platform with `source`),
 * the platforms for the filter, and the "Show more" link. The same as the
 * React BD starters'; each passes its own client and bundle.
 */
import {
	type BundleReviewTotals,
	REVIEW_PAGE_SIZE,
	type ReviewSource,
	type ReviewSummary,
	reviewSourceParam,
	sourcesIn,
	summarizeReviews,
	type WallReview,
} from "./reviews";

/** Everything the reviews page shows; `ReviewsView` draws it. */
export type ReviewsPageData = {
	configured: boolean;
	summary: ReviewSummary;
	sources: ReviewSource[];
	source: ReviewSource | null;
	reviews: WallReview[];
	moreHref: string | null;
	signedIn: boolean;
};

type ReviewList = (query: {
	limit: number;
	offset?: number;
	source?: ReviewSource;
}) => Promise<{
	items: WallReview[];
	totalCount: number;
	nextOffset: number | null;
}>;

const MOST_SHOWN = 200;

export async function loadReviewsPage({
	params,
	list,
	totals,
	signedIn,
}: {
	params: URLSearchParams;
	/** `bd.reviews.list`, or null when BD isn't configured. */
	list: ReviewList | null;
	totals: Promise<BundleReviewTotals | null | undefined>;
	signedIn: Promise<boolean>;
}): Promise<ReviewsPageData> {
	const source = reviewSourceParam(params.get("source")) ?? null;
	const asked = Number(params.get("shown")) || REVIEW_PAGE_SIZE;
	const shown = Math.min(
		MOST_SHOWN,
		Math.max(REVIEW_PAGE_SIZE, asked - (asked % REVIEW_PAGE_SIZE)),
	);
	if (!list) {
		return {
			configured: false,
			summary: summarizeReviews(null),
			sources: [],
			source,
			reviews: [],
			moreHref: null,
			signedIn: false,
		};
	}

	// The first `shown`, newest first, a page of up to 50 at a time.
	const first = async () => {
		const items: WallReview[] = [];
		let next: number | null = 0;
		let totalCount = 0;
		while (next != null && items.length < shown) {
			const page = await list({
				limit: Math.min(50, shown - items.length),
				offset: next,
				source: source ?? undefined,
			});
			items.push(...page.items);
			totalCount = page.totalCount;
			next = page.nextOffset;
			if (page.items.length === 0) break;
		}
		return { items, totalCount, nextOffset: next };
	};

	const [bundleTotals, page, newest, isSignedIn] = await Promise.all([
		totals.catch(() => null),
		first().catch(() => ({
			items: [] as WallReview[],
			totalCount: 0,
			nextOffset: null,
		})),
		// The platforms for the filter, from the newest 50.
		list({ limit: 50 }).catch(() => null),
		signedIn.catch(() => false),
	]);
	const more = new URLSearchParams(source ? { source } : {});
	more.set("shown", String(shown + REVIEW_PAGE_SIZE));
	return {
		configured: true,
		summary: summarizeReviews(bundleTotals, page.totalCount),
		sources: sourcesIn(newest?.items ?? page.items),
		source,
		reviews: page.items,
		moreHref:
			page.nextOffset != null && shown < MOST_SHOWN
				? `/reviews?${more}#review-${shown}`
				: null,
		signedIn: isSignedIn,
	};
}
