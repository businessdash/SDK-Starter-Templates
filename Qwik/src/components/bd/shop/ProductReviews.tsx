// [bd-file:store]
import type { StorefrontProductReviewsResponse } from "@businessdash/sdk/contracts";

import { reviewDate } from "../../../lib/shop/shop";
import { ShopStars } from "../ShopStars";

/** The product's reviews: the average, each review, and Show more reviews. */
export function ProductReviews({
	reviews,
	moreHref,
}: {
	reviews: StorefrontProductReviewsResponse | null;
	moreHref: string | null;
}) {
	return (
		<section class="product-section" id="reviews">
			<h2 class="product-section__title">Reviews</h2>
			{reviews && reviews.items.length > 0 ? (
				<>
					<p class="reviews__summary">
						<ShopStars rating={reviews.avgRating} />
						<strong>{`${reviews.avgRating.toFixed(1)} out of 5`}</strong>
						<span>{`from ${reviews.totalCount} reviews`}</span>
					</p>
					<div class="review-list">
						{reviews.items.map((review) => (
							<article class="review" key={review.id}>
								<div class="review__head">
									<ShopStars rating={review.rating} />
									<span class="review__name">
										{review.reviewerName || "Verified buyer"}
									</span>
									<span class="review__date">
										{reviewDate(review.createdAt)}
									</span>
								</div>
								{review.title ? (
									<p class="review__title">{review.title}</p>
								) : null}
								{review.content || review.body ? (
									<p class="review__body">{review.content || review.body}</p>
								) : null}
							</article>
						))}
					</div>
					{moreHref ? (
						<a class="bd-btn bd-btn--ghost reviews__more" href={moreHref}>
							Show more reviews
						</a>
					) : null}
				</>
			) : (
				<p class="reviews__none">No reviews yet.</p>
			)}
		</section>
	);
}
