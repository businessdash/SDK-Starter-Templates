/**
 * The business reviews' shared rules: the rating over every review and its
 * stars breakdown, what each platform is called, which links are safe to
 * open, and what a written review must be. The same rules in every BD
 * starter, so the reviews read the same on every site.
 *
 * Two places the reviews come from:
 *   - The marketing bundle's `reviews`: the average, the count and the
 *     count per star over ALL the business's reviews (plus a first few).
 *   - `reviews.list({ limit, offset, source })`: the reviews a page at a
 *     time, newest first, optionally from one platform.
 */

export type ReviewSource = "google" | "yelp" | "housecall_pro" | "other";

/** One review from `reviews.list`. */
export interface WallReview {
	id: string;
	source: string;
	rating: number;
	text: string;
	reviewUrl: string | null;
	reviewerName: string;
	reviewerImageUrl: string | null;
	photos?: string[];
	timeCreated: string;
	verified: boolean;
}

/** The bundle's `reviews`, as far as the summary reads it. */
export interface BundleReviewTotals {
	rating?: number | null;
	totalCount?: number | null;
	counts?: { rating: number; count: number }[];
}

export interface ReviewSummary {
	/** null when the business has no rated reviews. */
	average: number | null;
	total: number;
	/** 5 stars down to 1; `share` is the part of all reviews, 0 to 1. */
	histogram: { stars: number; count: number; share: number }[];
}

export const REVIEW_PAGE_SIZE = 10;
/** The longest review BD takes. */
export const REVIEW_MAX_LENGTH = 5000;

const PLATFORMS: Record<string, string> = {
	google: "Google",
	yelp: "Yelp",
	housecall_pro: "Housecall Pro",
};

/** The average, the count and the breakdown; empty stars count 0. */
export function summarizeReviews(
	totals: BundleReviewTotals | null | undefined,
	fallbackTotal = 0,
): ReviewSummary {
	const byStars = new Map<number, number>();
	for (const row of totals?.counts ?? []) {
		if (
			Number.isInteger(row.rating) &&
			row.rating >= 1 &&
			row.rating <= 5 &&
			row.count > 0
		) {
			byStars.set(row.rating, (byStars.get(row.rating) ?? 0) + row.count);
		}
	}
	const counted = [...byStars.values()].reduce((sum, n) => sum + n, 0);
	const total = totals?.totalCount ?? (counted || fallbackTotal);
	const average =
		typeof totals?.rating === "number" && Number.isFinite(totals.rating)
			? totals.rating
			: null;
	return {
		average,
		total,
		histogram: [5, 4, 3, 2, 1].map((stars) => {
			const count = byStars.get(stars) ?? 0;
			return { stars, count, share: counted > 0 ? count / counted : 0 };
		}),
	};
}

/** "Google", "Yelp", "Housecall Pro"; null for a review added in the dashboard. */
export function platformName(source: string | null | undefined): string | null {
	return (source && PLATFORMS[source]) || null;
}

/** A filter chip's name: the platform, or "Other". */
export function sourceLabel(source: string | null | undefined): string {
	return platformName(source) ?? "Other";
}

/** A `source` query value BD accepts, or undefined. */
export function reviewSourceParam(value: unknown): ReviewSource | undefined {
	return value === "google" ||
		value === "yelp" ||
		value === "housecall_pro" ||
		value === "other"
		? value
		: undefined;
}

/** The platforms among some reviews, in the order first seen. */
export function sourcesIn(
	reviews: readonly { source: string }[],
): ReviewSource[] {
	const seen: ReviewSource[] = [];
	for (const review of reviews) {
		const source = reviewSourceParam(review.source);
		if (source && !seen.includes(source)) seen.push(source);
	}
	return seen;
}

/** The review on its own site; web links only. */
export function reviewLink(review: {
	reviewUrl: string | null;
	source: string;
}): string | null {
	if (!review.reviewUrl || !platformName(review.source)) return null;
	try {
		const url = new URL(review.reviewUrl);
		return url.protocol === "https:" || url.protocol === "http:"
			? url.href
			: null;
	} catch {
		return null;
	}
}

/** A web address for an image, or null. */
export function safeImage(url: string | null | undefined): string | null {
	if (!url) return null;
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" || parsed.protocol === "http:"
			? parsed.href
			: null;
	} catch {
		return null;
	}
}

export function reviewerName(review: { reviewerName?: string | null }): string {
	return review.reviewerName?.trim() || "Anonymous";
}

/** The first letter of the name, for an avatar with no photo. */
export function reviewerInitial(review: {
	reviewerName?: string | null;
}): string {
	return reviewerName(review).charAt(0).toUpperCase();
}

/** "★★★★☆", rounded to whole stars. */
export function reviewStars(rating: number): string {
	const full = Math.min(5, Math.max(0, Math.round(rating)));
	return "★".repeat(full) + "☆".repeat(5 - full);
}

/** "Nov 20, 2026", or "" for a date that isn't one. */
export function formatReviewDate(iso: string | null | undefined): string {
	const date = iso ? new Date(iso) : null;
	return date && !Number.isNaN(date.getTime())
		? date.toLocaleDateString("en-US", {
				year: "numeric",
				month: "short",
				day: "numeric",
				timeZone: "UTC",
			})
		: "";
}

/** A written review, checked: the fields BD takes, or why it can't go. */
export function checkReview(input: {
	rating?: unknown;
	title?: unknown;
	body?: unknown;
}):
	| { ok: true; review: { rating: number; title?: string; body: string } }
	| { ok: false; error: string } {
	const rating = Number(input.rating);
	if (!Number.isInteger(rating) || rating < 1 || rating > 5)
		return { ok: false, error: "Choose a rating from 1 to 5 stars." };
	const body = typeof input.body === "string" ? input.body.trim() : "";
	if (!body)
		return { ok: false, error: "Write a few words about your experience." };
	if (body.length > REVIEW_MAX_LENGTH)
		return { ok: false, error: "Reviews are up to 5,000 characters." };
	const title =
		typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
	return {
		ok: true,
		review: title ? { rating, title, body } : { rating, body },
	};
}

/** What a customer sees once their review is in. */
export const REVIEW_SENT = "Thanks! Your review shows once it's approved.";
