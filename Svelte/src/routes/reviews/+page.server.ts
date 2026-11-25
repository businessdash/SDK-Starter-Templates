import { fail } from '@sveltejs/kit';
import type { ReviewWallItem } from '@businessdash/sdk/contracts';

import type { Actions, PageServerLoad } from './$types';

import {
	checkReview,
	REVIEW_PAGE_SIZE,
	reviewSourceParam,
	sourcesIn,
	summarizeReviews
} from '#lib/bd/reviews.ts';
import { bd } from '#lib/server/bd.ts';
import { fetchBundleSafe, getReviewsFromBundle } from '#lib/server/bd-bundle.ts';
import { getCustomerSession, SESSION_COOKIE, submitReviewAs } from '#lib/server/bd-portal.ts';

/**
 * The business's reviews: the rating over all of them with a bar per star
 * (the marketing bundle's `reviews`), a platform filter (`?source=`), each
 * review with its photos and a link to it on Google or Yelp, and "Show more"
 * (`?shown=`), all plain links. Writing one is the `write` action below.
 * The rules are `#lib/bd/reviews.ts`, the same in every BD starter.
 */
const MOST_SHOWN = 200;

type ReviewPage = { items: ReviewWallItem[]; totalCount: number; nextOffset: number | null };

/** The first `shown` reviews, newest first, read a page of up to 50 at a time. */
async function firstReviews(
	shown: number,
	source: ReturnType<typeof reviewSourceParam>
): Promise<ReviewPage> {
	const items: ReviewWallItem[] = [];
	let next: number | null = 0;
	let totalCount = 0;
	while (bd && next != null && items.length < shown) {
		const page = await bd.reviews.list({
			limit: Math.min(50, shown - items.length),
			offset: next,
			source
		});
		items.push(...page.items);
		totalCount = page.totalCount;
		next = page.nextOffset;
		if (page.items.length === 0) break;
	}
	return { items, totalCount, nextOffset: next };
}

export const load: PageServerLoad = async ({ url, cookies }) => {
	const source = reviewSourceParam(url.searchParams.get('source'));
	const asked = Number(url.searchParams.get('shown')) || REVIEW_PAGE_SIZE;
	const shown = Math.min(
		MOST_SHOWN,
		Math.max(REVIEW_PAGE_SIZE, asked - (asked % REVIEW_PAGE_SIZE))
	);
	if (!bd) {
		return {
			configured: false as const,
			summary: summarizeReviews(null),
			sources: [],
			source,
			reviews: [],
			moreHref: null,
			signedIn: false
		};
	}
	const [bundleResult, first, newest, session] = await Promise.all([
		fetchBundleSafe('home', 'en'),
		firstReviews(shown, source).catch(
			() => ({ items: [], totalCount: 0, nextOffset: null }) as ReviewPage
		),
		// The platforms for the filter, from the newest 50.
		bd.reviews.list({ limit: 50 }).catch(() => null),
		getCustomerSession(cookies.get(SESSION_COOKIE))
	]);
	const totals = bundleResult.status === 'ok' ? getReviewsFromBundle(bundleResult.bundle) : null;
	const more = new URLSearchParams(
		source
			? { source, shown: String(shown + REVIEW_PAGE_SIZE) }
			: { shown: String(shown + REVIEW_PAGE_SIZE) }
	);
	return {
		configured: true as const,
		summary: summarizeReviews(totals, first.totalCount),
		sources: sourcesIn(newest?.items ?? first.items),
		source,
		reviews: first.items,
		moreHref:
			first.nextOffset != null && shown < MOST_SHOWN ? `/reviews?${more}#review-${shown}` : null,
		signedIn: session !== null
	};
};

export const actions: Actions = {
	/** `rating`, `title`, `body` from the review writer, for the signed-in customer. */
	write: async ({ request, cookies }) => {
		if (!bd) return fail(503, { error: "Reviews aren't connected yet." });
		const session = await getCustomerSession(cookies.get(SESSION_COOKIE));
		if (!session) return fail(401, { error: 'Sign in to write a review.' });
		const form = await request.formData();
		const checked = checkReview({
			rating: form.get('rating'),
			title: form.get('title'),
			body: form.get('body')
		});
		if (!checked.ok) return fail(400, { error: checked.error });
		try {
			await submitReviewAs(session, checked.review);
			return { sent: true };
		} catch {
			return fail(502, { error: "Couldn't send your review. Try again." });
		}
	}
};
