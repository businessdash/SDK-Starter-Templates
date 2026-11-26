import { html, jsonScript, type Raw } from "../../html";
import { type ReviewSummary, reviewStars } from "../../shop/reviews";

/**
 * The business's rating: the average, its stars, how many reviews, a bar
 * per star, and writing a review. `<bd-review-writer>`
 * (src/shop/reviews-elements.ts) posts a written review to `writeUrl`;
 * signed out, it's a link to sign in.
 */
export function ratingSummary(
	summary: ReviewSummary,
	signedIn: boolean,
	{ writeUrl = "/reviews/write", signInHref = "/my-account?next=%2Freviews" } = {},
): Raw {
	const writer = html`<div class="reviews-summary__write">
		<bd-review-writer data-write-url="${writeUrl}" data-sign-in-href="${signInHref}">
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
				(row) => html`<li aria-label="${`${row.stars} ${row.stars === 1 ? "star" : "stars"}: ${row.count}`}">
					<span>${row.stars} ★</span>
					<span class="reviews-bars__track"><span class="reviews-bars__fill" style="${`width:${Math.round(row.share * 100)}%`}"></span></span>
					<span>${row.count}</span>
				</li>`,
			)}
		</ul>
		${writer}
	</section>`;
}
