/**
 * The business's reviews: the rating over all of them with a bar per star,
 * a platform filter, each review with its photos and a link to it on Google
 * or Yelp, more on demand, and writing one.
 *
 *   GET  /reviews?source=yelp          the page (the filter is a plain link)
 *   GET  /sections/reviews-more?offset=10&source=yelp
 *                                      the next page, swapped in by htmx
 *   POST /reviews/write                JSON from <bd-review-writer>
 *
 * The rules (the breakdown, platform names, safe links, what a review must
 * be) are src/shop/reviews.ts, the same in every BD starter. The page is
 * laid out from the reviews' parts in src/sections/reviews/: the rating
 * summary, the platform filter and a card per review.
 */
import { getBd, getSession, portalFor } from "./bd";
import { cached } from "./cache";
import { html, render, type Raw } from "./html";
import { SESSION_COOKIE, errBlock, getCookie, page } from "./layout";
import { ratingSummary } from "./sections/reviews/rating-summary";
import { reviewCard } from "./sections/reviews/review-card";
import { reviewFilter } from "./sections/reviews/review-filter";
import {
	checkReview,
	REVIEW_PAGE_SIZE,
	reviewSourceParam,
	sourceLabel,
	sourcesIn,
	summarizeReviews,
	type BundleReviewTotals,
	type ReviewSource,
	type WallReview,
} from "./shop/reviews";

const NOT_CONFIGURED = "BusinessDash isn't configured yet — set BD_API_KEY and BD_SITE_ID.";

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
	});
}

type ReviewPage = { items: WallReview[]; totalCount: number; nextOffset: number | null };

async function reviewPage(offset: number, source: ReviewSource | undefined): Promise<ReviewPage> {
	const bd = getBd();
	if (!bd) return { items: [], totalCount: 0, nextOffset: null };
	return (await cached(`reviews:${source ?? "all"}:${offset}`, ["bd:reviews"], () =>
		bd.reviews.list({ limit: REVIEW_PAGE_SIZE, offset, source }),
	)) as ReviewPage;
}

export async function reviewsPage(url: URL, sessionCookie: string | null): Promise<string> {
	const bd = getBd();
	const source = reviewSourceParam(url.searchParams.get("source"));
	let body: Raw;
	if (!bd) {
		body = errBlock(NOT_CONFIGURED);
	} else {
		try {
			const [bundle, first, newest, session] = await Promise.all([
				cached("bundle:home:en", ["bd:marketing"], () => bd.marketing.getPageBundle({ pageKey: "home", locale: "en" })).catch(
					() => null,
				),
				reviewPage(0, source),
				// The platforms for the filter, from the newest 50.
				cached("reviews:sources", ["bd:reviews"], () => bd.reviews.list({ limit: 50 })).catch(() => null),
				getSession(sessionCookie),
			]);
			const totals = (bundle as { reviews?: BundleReviewTotals | null } | null)?.reviews ?? null;
			const summary = summarizeReviews(totals, first.totalCount);
			const sources = sourcesIn(newest?.items ?? first.items);
			body = html`${ratingSummary(summary, Boolean(session))}
				${reviewFilter(sources, source)}
				${
					first.items.length
						? html`<ul class="review-wall" id="review-list">${reviewItems(first, source)}</ul>`
						: html`<p class="reviews-empty">${
								source
									? `No ${sourceLabel(source)} reviews yet.`
									: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."
							}</p>`
				}`;
		} catch (err) {
			body = errBlock(err);
		}
	}
	return page({
		origin: url.origin,
		title: "Reviews",
		description: "What customers say.",
		styles: ["/bd-reviews.css"],
		modules: ["/shop/reviews-elements.js"],
		body: html`<header class="page__head"><h1 class="page__title">Reviews</h1><p class="page__sub">What customers say.</p></header>${body}`,
	});
}

/** The next page, for the "Show more reviews" button. */
export async function reviewsMore(url: URL): Promise<string> {
	const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
	const source = reviewSourceParam(url.searchParams.get("source"));
	try {
		return render(reviewItems(await reviewPage(offset, source), source));
	} catch (err) {
		return render(html`<li>${errBlock(err)}</li>`);
	}
}

function reviewItems(res: ReviewPage, source: ReviewSource | undefined): Raw {
	const more =
		res.nextOffset != null
			? html`<li class="reviews-more" id="review-more"><button class="btn btn--ghost" hx-get="${`/sections/reviews-more?offset=${res.nextOffset}${source ? `&source=${source}` : ""}`}" hx-target="#review-more" hx-swap="outerHTML">Show more reviews</button></li>`
			: "";
	return html`${res.items.map(reviewCard)}${more}`;
}

/** `{ rating, title?, body }` from <bd-review-writer>, for the signed-in customer. */
export async function writeReview(req: Request): Promise<Response> {
	if (!getBd()) return json({ ok: false, error: "Reviews aren't connected yet." }, 503);
	// A JSON body only: a form on another site can't send one.
	if (!req.headers.get("content-type")?.includes("application/json")) return json({ ok: false, error: "Send JSON." }, 415);
	const session = await getSession(getCookie(req, SESSION_COOKIE));
	if (!session) return json({ ok: false, error: "Sign in to write a review." }, 401);
	const checked = checkReview(((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
	if (!checked.ok) return json({ ok: false, error: checked.error }, 400);
	try {
		await portalFor(session).submitReview(checked.review);
		return json({ ok: true });
	} catch {
		return json({ ok: false, error: "Couldn't send your review. Try again." }, 502);
	}
}
