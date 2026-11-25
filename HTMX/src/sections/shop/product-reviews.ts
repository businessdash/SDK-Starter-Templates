// [bd-file:store]
import type { StorefrontProductReviewsResponse } from "@businessdash/sdk/contracts";
import { html, type Raw } from "../../html";
import { reviewDate } from "../../shop/shop";
import { starRating } from "./star-rating";

/** The product's reviews: the average, each review, and Show more reviews. */
export function productReviews(
	reviews: StorefrontProductReviewsResponse | null,
	{ moreHref = null }: { moreHref?: string | null } = {},
): Raw {
	return html`<section class="product-section" id="reviews">
		<h2 class="product-section__title">Reviews</h2>
		${
			reviews && reviews.items.length > 0
				? html`<p class="reviews__summary">${starRating(reviews.avgRating)}<strong>${`${reviews.avgRating.toFixed(1)} out of 5`}</strong><span>${`from ${reviews.totalCount} reviews`}</span></p>
					<div class="review-list">${reviews.items.map(
						(review) => html`<article class="review">
							<div class="review__head">${starRating(review.rating)}<span class="review__name">${review.reviewerName || "Verified buyer"}</span><span class="review__date">${reviewDate(review.createdAt)}</span></div>
							${review.title ? html`<p class="review__title">${review.title}</p>` : ""}
							${review.content || review.body ? html`<p class="review__body">${review.content || review.body}</p>` : ""}
						</article>`,
					)}</div>
					${moreHref ? html`<a class="bd-btn bd-btn--ghost reviews__more" href="${moreHref}">Show more reviews</a>` : ""}`
				: html`<p class="reviews__none">No reviews yet.</p>`
		}
	</section>`;
}
