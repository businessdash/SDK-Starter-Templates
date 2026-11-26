// [bd-file:store]
import type { StorefrontProductReviewsResponse } from "@businessdash/sdk/contracts";
import { For, Show } from "solid-js";

import { reviewDate } from "../../../lib/shop/shop";
import { ShopStars } from "../ShopStars";

/** The product's reviews: the average, each review, and Show more reviews. */
export function ProductReviews(props: {
	reviews: StorefrontProductReviewsResponse | null;
	moreHref: string | null;
}) {
	return (
		<section class="product-section" id="reviews">
			<h2 class="product-section__title">Reviews</h2>
			<Show
				when={props.reviews && props.reviews.items.length > 0 && props.reviews}
				fallback={<p class="reviews__none">No reviews yet.</p>}
			>
				{(reviews) => (
					<>
						<p class="reviews__summary">
							<ShopStars rating={reviews().avgRating} />
							<strong>{`${reviews().avgRating.toFixed(1)} out of 5`}</strong>
							<span>{`from ${reviews().totalCount} reviews`}</span>
						</p>
						<div class="review-list">
							<For each={reviews().items}>
								{(review) => (
									<article class="review">
										<div class="review__head">
											<ShopStars rating={review.rating} />
											<span class="review__name">
												{review.reviewerName || "Verified buyer"}
											</span>
											<span class="review__date">
												{reviewDate(review.createdAt)}
											</span>
										</div>
										<Show when={review.title}>
											<p class="review__title">{review.title}</p>
										</Show>
										<Show when={review.content || review.body}>
											<p class="review__body">
												{review.content || review.body}
											</p>
										</Show>
									</article>
								)}
							</For>
						</div>
						<Show when={props.moreHref}>
							{(href) => (
								<a class="bd-btn bd-btn--ghost reviews__more" href={href()}>
									Show more reviews
								</a>
							)}
						</Show>
					</>
				)}
			</Show>
		</section>
	);
}
