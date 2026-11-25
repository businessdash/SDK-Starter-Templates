import type { ReviewWallItem } from "@businessdash/sdk/contracts";
import {
	type BundleReviewTotals,
	REVIEW_PAGE_SIZE,
	type ReviewSource,
	reviewSourceParam,
	type ReviewSummary,
	sourcesIn,
	summarizeReviews,
} from "#shared/bd/reviews";

/**
 * GET /api/bd/reviews/page?source=&shown=
 *
 * The reviews page, ready to show: the rating over all the business's
 * reviews with its count per star (the marketing bundle's `reviews`), the
 * first `shown` reviews (from one platform with `source`), the platforms
 * for the filter, the "Show more" link, and whether the visitor can write
 * one. The rules are `#shared/bd/reviews`, the same in every BD starter.
 */
export type ReviewsPageData = {
	configured: boolean;
	summary: ReviewSummary;
	sources: ReviewSource[];
	source: ReviewSource | null;
	reviews: ReviewWallItem[];
	moreHref: string | null;
	signedIn: boolean;
};

const MOST_SHOWN = 200;

export default defineEventHandler(async (event): Promise<ReviewsPageData> => {
	const query = getQuery(event);
	const source = reviewSourceParam(query.source) ?? null;
	const asked = Number(query.shown) || REVIEW_PAGE_SIZE;
	const shown = Math.min(MOST_SHOWN, Math.max(REVIEW_PAGE_SIZE, asked - (asked % REVIEW_PAGE_SIZE)));
	const bd = getBd();
	if (!bd) {
		return { configured: false, summary: summarizeReviews(null), sources: [], source, reviews: [], moreHref: null, signedIn: false };
	}

	// The first `shown`, newest first, a page of up to 50 at a time.
	const first = async () => {
		const items: ReviewWallItem[] = [];
		let next: number | null = 0;
		let totalCount = 0;
		while (next != null && items.length < shown) {
			const page = await bd.reviews.list({ limit: Math.min(50, shown - items.length), offset: next, source: source ?? undefined });
			items.push(...page.items);
			totalCount = page.totalCount;
			next = page.nextOffset;
			if (page.items.length === 0) break;
		}
		return { items, totalCount, nextOffset: next };
	};

	const [bundle, page, newest, session] = await Promise.all([
		bd.marketing.getPageBundle({ pageKey: "home", locale: "en" }).catch(() => null),
		first().catch(() => ({ items: [] as ReviewWallItem[], totalCount: 0, nextOffset: null })),
		// The platforms for the filter, from the newest 50.
		bd.reviews.list({ limit: 50 }).catch(() => null),
		getCustomerSession(event).catch(() => null),
	]);
	const totals = (bundle as { reviews?: BundleReviewTotals | null } | null)?.reviews ?? null;
	const more = new URLSearchParams(source ? { source } : {});
	more.set("shown", String(shown + REVIEW_PAGE_SIZE));
	return {
		configured: true,
		summary: summarizeReviews(totals, page.totalCount),
		sources: sourcesIn(newest?.items ?? page.items),
		source,
		reviews: page.items,
		moreHref: page.nextOffset != null && shown < MOST_SHOWN ? `/reviews?${more}#review-${shown}` : null,
		signedIn: session !== null,
	};
});
