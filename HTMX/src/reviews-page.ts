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
 * be) are src/shop/reviews.ts, the same in every BD starter.
 */
import { getBd, getSession, portalFor } from "./bd";
import { cached } from "./cache";
import { html, raw, render, type Raw } from "./html";
import { SESSION_COOKIE, errBlock, getCookie, page } from "./layout";
import {
	checkReview,
	formatReviewDate,
	platformName,
	REVIEW_PAGE_SIZE,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewSourceParam,
	reviewStars,
	safeImage,
	sourceLabel,
	sourcesIn,
	summarizeReviews,
	type BundleReviewTotals,
	type ReviewSource,
	type WallReview,
} from "./shop/reviews";

const NOT_CONFIGURED = "BusinessDash isn't configured yet — set BD_API_KEY and BD_SITE_ID.";

function jsonScript(value: unknown): Raw {
	return raw(`<script type="application/json">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`);
}

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
			body = html`${summaryBlock(summary, Boolean(session))}
				${sources.length > 1 ? filterBlock(sources, source) : ""}
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

function summaryBlock(summary: ReturnType<typeof summarizeReviews>, signedIn: boolean): Raw {
	const writer = html`<div class="reviews-summary__write">
		<bd-review-writer data-write-url="/reviews/write" data-sign-in-href="/my-account?next=%2Freviews">
			${jsonScript({ signedIn })}
		</bd-review-writer>
	</div>`;
	if (summary.average === null) return html`<section class="reviews-summary" aria-label="Write a review">${writer}</section>`;
	return html`<section class="reviews-summary" aria-label="Rating">
		<div class="reviews-summary__score">
			<span class="reviews-summary__average">${summary.average.toFixed(1)}</span>
			<span class="review-stars" role="img" aria-label="${`${summary.average.toFixed(1)} out of 5`}">${reviewStars(summary.average)}</span>
			<span class="reviews-summary__count">${summary.total} ${summary.total === 1 ? "review" : "reviews"}</span>
		</div>
		<ul class="reviews-bars">
			${summary.histogram.map(
				(row) => html`<li aria-label="${`${row.stars} stars: ${row.count}`}">
					<span>${row.stars} ★</span>
					<span class="reviews-bars__track"><span class="reviews-bars__fill" style="${`width:${Math.round(row.share * 100)}%`}"></span></span>
					<span>${row.count}</span>
				</li>`,
			)}
		</ul>
		${writer}
	</section>`;
}

function filterBlock(sources: ReviewSource[], active: ReviewSource | undefined): Raw {
	return html`<nav aria-label="Platform">
		<ul class="reviews-filter">
			<li><a href="/reviews" aria-current="${active ? "false" : "true"}">All</a></li>
			${sources.map(
				(s) => html`<li><a href="${`/reviews?source=${s}`}" aria-current="${active === s ? "true" : "false"}">${sourceLabel(s)}</a></li>`,
			)}
		</ul>
	</nav>`;
}

function reviewItems(res: ReviewPage, source: ReviewSource | undefined): Raw {
	const more =
		res.nextOffset != null
			? html`<li class="reviews-more" id="review-more"><button class="btn btn--ghost" hx-get="${`/sections/reviews-more?offset=${res.nextOffset}${source ? `&source=${source}` : ""}`}" hx-target="#review-more" hx-swap="outerHTML">Show more reviews</button></li>`
			: "";
	return html`${res.items.map(reviewCard)}${more}`;
}

function reviewCard(r: WallReview): Raw {
	const avatar = safeImage(r.reviewerImageUrl);
	const platform = platformName(r.source);
	const link = reviewLink(r);
	const photos = (r.photos ?? []).map(safeImage).filter((p): p is string => p !== null);
	return html`<li class="review-card">
		<div class="review-card__head">
			${avatar ? html`<img class="review-card__avatar" src="${avatar}" alt="" loading="lazy" />` : html`<span class="review-card__avatar" aria-hidden="true">${reviewerInitial(r)}</span>`}
			<div>
				<p class="review-card__name">${reviewerName(r)}</p>
				<p class="review-card__meta"><span class="review-stars" role="img" aria-label="${`${r.rating} out of 5`}">${reviewStars(r.rating)}</span> · ${formatReviewDate(r.timeCreated)}</p>
			</div>
		</div>
		<p class="review-card__text">${r.text}</p>
		${
			photos.length
				? html`<ul class="review-card__photos" aria-label="Photos from the reviewer">${photos.map((p) => html`<li><img src="${p}" alt="" loading="lazy" /></li>`)}</ul>`
				: ""
		}
		${
			platform || r.verified
				? html`<p class="review-card__foot">
			${platform ? html`<span class="review-card__platform">${platform}</span>` : ""}
			${r.verified ? html`<span class="review-card__verified">✓ Verified</span>` : ""}
			${link && platform ? html`<a class="review-card__link" href="${link}" target="_blank" rel="noopener noreferrer">Read on ${platform}</a>` : ""}
		</p>`
				: ""
		}
	</li>`;
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
